import express from 'express';
import { logger } from './modules/globals.js';
import connectToDB from './modules/mongo.js';
import getBuckets from './modules/s3.js';

const app = express();
const webServerPort = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
  logger.info(`Server is running on http://localhost:${webServerPort}`);
}

app.listen(webServerPort);
connectToDB();
getBuckets().then((buckets) => {
  logger.info('Fetched Buckets: ');
  buckets.forEach(bucket => logger.info(bucket.Name));
})
  .catch(error => logger.warn(error));
