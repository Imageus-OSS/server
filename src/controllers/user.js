import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import UserModel from '../models/user';
import APIError from '../services/APIError';
import PasswordHasher from '../services/PasswordHasher';
import S3 from '../services/S3';
import SendGrid from '../services/SendGrid';
import { logger } from '../globals';

const User = {
  register: async (req, res, next) => {
    const {
      firstName, lastName, email, username, password,
    } = req.body;

    // Hash password
    const hashedPassword = await PasswordHasher.hash(password);

    // Verification code
    const verificationCode = uuidv4();
    // create new user model with given request body
    const newUser = new UserModel(
      {
        firstName,
        lastName,
        email,
        username,
        password: hashedPassword,
        verificationCode,
      },
    );

    let user;
    try {
      user = await newUser.save();
    } catch (err) {
      // Duplicate Key Error
      if (err.code === 11000) {
        return next(new APIError(
          'Username or email taken',
          'Another username or email with the same name is already in use.',
          409,
        ));
      }
      return next(new APIError());
    }

    // Strip sensitive info
    const reifiedUser = user.toJSON();
    delete reifiedUser.password;

    const link = `http://imageus.io/verify/?id=${user.toJSON().id}&verificationCode=${verificationCode}`;

    try {
      await SendGrid.sendMessage({
        to: email,
        from: 'no-reply@imageus.io',
        subject: 'Please Verify Your Account for ImageUs',
        text: `${firstName} ${lastName},
        Please verify your account by clicking the link below:
        ${link}`,
      });
    } catch (err) {
      return next(new APIError(
        'Failed to send email',
        'An error occured while trying to send the email',
        503,
        err,
      ));
    }

    return res.status(201).send(reifiedUser);
  },

  login: async (req, res, next) => {
    let user;

    try {
      user = (await UserModel.findOne({
        username: req.body.username,
      }, '+password')
        .exec());
    } catch (err) {
      return next(new APIError());
    }

    if (!user || !await PasswordHasher.validateHash(req.body.password, user.password)) {
      return next(new APIError(
        'Incorrect Credentials',
        'Cannot Log user in',
      ));
    }

    // Strip sensitive info
    const reifiedUser = user.toJSON();
    delete reifiedUser.password;

    return res.status(200).send(reifiedUser);
  },

  delete: async (req, res, next) => {
    const { id } = req.params;
    let result;

    try {
      result = await UserModel.findOneAndDelete({ _id: id }).exec();
    } catch (err) {
      next(new APIError());
    }

    if (!result) {
      return next(new APIError(
        'User Could not be deleted',
        'No such User exists',
        404,
        `/users/${id}/`,
      ));
    }

    return res.status(204).send();
  },

  fetch: async (req, res, next) => {
    const { id } = req.params;
    let result;
    let imgURL;

    try {
      result = await UserModel.findOne({ _id: id }).exec();

      if (!result) {
        return next(new APIError(
          'Could not find User',
          `User with id ${id} could not be found.`,
          404,
          `/users/${id}`,
        ));
      }

      imgURL = await S3.getPreSignedURL(`users/${result.id}/profile.jpeg`);
    } catch (err) {
      logger.error(err);
      return next(new APIError());
    }

    const retVal = result.toJSON();
    retVal.imgURL = imgURL;

    return res.status(200).send(retVal);
  },

  update: async (req, res, next) => {
    const { id } = req.params;
    let result;

    try {
      result = await UserModel.findByIdAndUpdate(id, req.body, { new: true }).exec();
    } catch (err) {
      return next(new APIError());
    }

    if (!result) {
      return next(new APIError(
        'User could not be found',
        `User with id ${id} was not found`,
        404,
        `users/${id}`,
      ));
    }

    // If there was no file attached we're done.
    if (!req.file) {
      return res.status(200).send(result.toJSON());
    }

    const imageBuffer = await sharp(req.file.buffer)
      .jpeg()
      .toBuffer();

    const key = `users/${id}/profile.jpeg`;
    let imgURL;

    // Tack on image url
    try {
      await S3.uploadObject(key, imageBuffer);
      imgURL = await S3.getPreSignedURL(key);
    } catch (e) {
      next(new APIError());
    }

    const retVal = result.toJSON();
    retVal.imgURL = imgURL;

    return res.status(200).send(retVal);
  },

  verify: async (req, res, next) => {
    const { id } = req.params;
    let result;

    try {
      result = await UserModel.findOneAndUpdate(id, { verified: true }).exec();
    } catch (err) {
      return next(new APIError());
    }

    if (!result) {
      return next(new APIError(
        'User could not be found',
        `User with id ${id} was not found`,
        404,
        `users/${id}`,
      ));
    }

    return res.send(200).send(result.toJSON());
  },
};

export default User;
