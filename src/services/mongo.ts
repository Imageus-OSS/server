import mongoose, { Document } from 'mongoose';
import { logger } from '../globals';

const connectToDB = async (): Promise<void> => {
  // Connection options
  const connectionOptions = {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  };

  if (typeof process.env.MONGO_URI === 'undefined') {
    throw new Error('Connection unsuccessful: the URI was not provided');
  }

  try {
    // Create the DB connection.
    await mongoose.connect(process.env.MONGO_URI, connectionOptions);
  } catch (error) {
    throw new Error(error);
  }

  // Set options
  mongoose.set('toJSON', {
    versionKey: false,
    useProjection: true,
    virtuals: true,
    /* eslint-disable no-param-reassign */
    /* eslint-disable no-underscore-dangle */
    transform: (doc: Document, ret: Record<string, unknown>) => {
      delete ret._id;
    },
  });

  // Log the values.
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`MongoDB_URI = ${process.env.MONGO_URI}`);
  }
};

const disconnectFromDB = async (): Promise<void> => {
  // Close the DB connection.
  await mongoose.connection.close();
};

export { connectToDB, disconnectFromDB };
