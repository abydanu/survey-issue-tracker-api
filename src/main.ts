import app from './app.js';
import logger from './infrastructure/logging/logger.js';

const port = Number(process.env.PORT) || 3000;

logger.info(`Server starting on port ${port}`);
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
logger.info(`API Documentation: http://localhost:${port}/docs`);

// Use Bun.serve for proper HTTP server
const server = Bun.serve({
  fetch: app.fetch,
  port: port,
  hostname: '::',
});

logger.info(`✅ Server is running on ${server.hostname}:${server.port}`);
