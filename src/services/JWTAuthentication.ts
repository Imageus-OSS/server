import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import APIError from './APIError';

// 15 minutes
const defaultExpireTime = 1000 * 60 * 15;

const createToken = (payload: Record<string, unknown>, expiresIn = defaultExpireTime): string => jwt.sign(
  payload, process.env.JWT_SECRET ?? '', { expiresIn },
);

/**
 * Gets token from header and returns the decoded value if it validates
 * @returns {Object} decoded
 */
const prepareToken = (req: Request, next: NextFunction): string | Record<string, unknown> | void => {
  // get token from header
  const token = req.headers.authorization;
  if (!token) {
    return next(new APIError(
      'Invalid authorization header',
      'Bad authorization header given',
      403,
    ));
  }

  // verify the token is valid
  // try-catch is used instead of a callback so that jwt.verify works synchronously
  try {
    return jwt.verify(token, process.env.JWT_SECRET ?? '') as (string | Record<string, unknown>);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new APIError(
        'Invalid JWT token',
        'The given token has expired',
        403,
      ));
    }
    return next(new APIError(
      'Invalid JWT token',
      'The given token failed to verify as a valid token',
      403,
    ));
  }
};

// this can be called as middleware or simply caled during an API operation;
// should be called once the information needing authentication has been fetched

/**
 * Authenticates the key found in the token against toCheck's same key
 * Calls prepareToken() to extract token from header and place it into req.body
 * @param {Object} toCheck - If toCheck = { foo: bar }, token.foo will be tested for authentication
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authenticate = (req: Request, res: Response, next: NextFunction, toCheck: Record<string, unknown>): void => {
  const decoded: Record<string, unknown> = prepareToken(req, next) as Record<string, unknown>;
  const key = Object.keys(toCheck)[0];

  if (decoded[key] !== toCheck[key]) {
    return next(new APIError(
      'Not authenticated',
      'The user is not authenticated for this action',
      403,
    ));
  }
  return next();
};

export { createToken, authenticate };
