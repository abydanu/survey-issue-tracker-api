import app from './app.js';
import logger from './infrastructure/logging/logger.js';

const port = Number(process.env.PORT);

logger.info(`Server starting on port ${port}`);
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
logger.info(`API Documentation: http://localhost:${port}/docs`);

export default { fetch: app.fetch, port };
