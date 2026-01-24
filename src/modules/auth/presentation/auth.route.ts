import { OpenAPIHono } from '@hono/zod-openapi';
import { AuthController } from './auth.controller';
import { loginRoute, logoutRoute, meRoute } from './auth.openapi';

export const createAuthRoutes = (controller: AuthController) => {
  const app = new OpenAPIHono();

  app.openapi(loginRoute, controller.login as any);
  app.openapi(logoutRoute, controller.logout as any);
  app.openapi(meRoute, controller.me as any);

  return app;
};
