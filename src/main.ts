import { createApp } from './app';
import logger from './infrastructure/logging/logger';
import 'dotenv/config';

const app = createApp();

const port = Number(process.env.PORT) || 5000;

logger.info(`Server starting on port ${port}`);
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
logger.info(`API Documentation: http://localhost:${port}/docs`);

export default {
  port,
  fetch: app.fetch,
};
