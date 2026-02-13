import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import type { Context } from 'hono';
import { setupRoutes } from './routes/index.js';
import { openApiConfig } from './openapi.js';
import ApiResponseHelper from './shared/utils/response.js';
import logger from './infrastructure/logging/logger.js';
import { ZodError } from 'zod';
import { formatZodError, createZodErrorHook } from './shared/utils/zod.js';

export const createApp = () => {
  const zodErrorHook = createZodErrorHook();
  
  const app = new OpenAPIHono({
    defaultHook: zodErrorHook
  })

  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Enter Bearer token',
  });

  app.use('*', cors({
    origin: (origin) => {
      const allowed = ['https://madpro.vercel.app', 'https://survey-issue-tracker-api-production.up.railway.app'];
      if (!origin) return allowed[0];
      if (allowed.includes(origin)) return origin;
      if (origin.endsWith('.vercel.app')) return origin;
      return allowed[0];
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }));
  app.use('*', honoLogger());

  app.get('/', (c: Context) => {
    return ApiResponseHelper.success(c, { 
      name: 'Survey Issue Tracking API',
      version: '1.0.0',
      status: 'running',
      author: 'Aby Danu',
      documentation: '/docs',
    }, 'API is running');
  });

  app.doc('/api/openapi.json', openApiConfig);

  app.get('/docs', swaggerUI({ 
    url: '/api/openapi.json',
    title: 'Survey Issue Tracking API Documentation',
    persistAuthorization: true,
    deepLinking: true,
  }));

  setupRoutes(app);  

  app.notFound((c: Context) => {
    return ApiResponseHelper.notFound(c, 'Endpoint not found');
  });

  app.onError((err: Error, c: Context) => {
    logger.error('Unhandled error:', err as any);

    if (err.message?.includes('Malformed JSON') || err.message?.includes('Unexpected token')) {
      return ApiResponseHelper.error(c, 'Invalid request body. Ensure body is valid JSON.', undefined, 400);
    }

    if (err instanceof ZodError) {
      return c.json({
        success: false,
        message: 'Validation error',
        errors: formatZodError(err),
      }, 400);
    }

    return ApiResponseHelper.serverError(c, 'Internal server error');
  });

  return app;
};

const app = createApp();
export default app;
