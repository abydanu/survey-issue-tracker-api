import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import type { Context } from 'hono';
import { setupRoutes } from './routes';
import { openApiConfig } from './openapi';
import ApiResponseHelper from './shared/utils/response';
import logger from './infrastructure/logging/logger';
import { ZodError } from 'zod';
import { formatZodError, createZodErrorHook } from './shared/utils/zod';

export const createApp = () => {
  const zodErrorHook = createZodErrorHook();
  
  const app = new OpenAPIHono({
    defaultHook: zodErrorHook
  })

  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Masukkan token',
  });

  app.use('*', async(c, next) => {
    c.req.raw.headers.set('ngrok-skip-browser-warning', 'true');
    await next();
  });

  app.use('*', cors({
    origin: ['http://localhost:3000', 'http://localhost:5000'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
    exposeHeaders: ['Content-Type', 'ngrok-skip-browser-warning'],
    credentials: true,
  }));
  app.use('*', honoLogger());

  app.get('/', (c: Context) => {
    return ApiResponseHelper.success(c, { 
      name: 'Survey Issue Tracking API',
      version: '1.0.0',
      status: 'running',
      documentation: '/docs'
    }, 'API is running');
  });

  setupRoutes(app);

  app.doc('/api/openapi.json', openApiConfig);

  app.get('/docs', swaggerUI({ 
    url: '/api/openapi.json',
    title: 'Survey Issue Tracking API Documentation',
    persistAuthorization: true,
    deepLinking: true,
  }));

  app.notFound((c: Context) => {
    return ApiResponseHelper.notFound(c, 'Endpoint tidak ditemukan');
  });

  app.onError((err: Error, c: Context) => {
    logger.error('Unhandled error:', err);
    if (err instanceof ZodError) {
      return c.json({
        success: "false",
        message: "Error Validation",
        errors: formatZodError(err),
      }, 400)
    }
    return ApiResponseHelper.serverError(c, 'Terjadi kesalahan server');
  });

  return app;
};
