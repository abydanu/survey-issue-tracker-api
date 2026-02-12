import { OpenAPIHono } from '@hono/zod-openapi';
import { EnumController } from './enum.controller.js';
import { getFilterEnumsRoute, getAllEnumsRoute } from './enum.openapi.js';
import { authMiddleware } from '../../../shared/middlewares/auth.middleware.js';
import { authService } from '../../../shared/instances/auth.instance.js';
import { createZodErrorHook } from '../../../shared/utils/zod.js';

export const createEnumRoutes = (enumController: EnumController) => {
  const zodErrorHook = createZodErrorHook();
  
  const app = new OpenAPIHono({
    defaultHook: zodErrorHook,
  });

 
  app.use('*', authMiddleware(authService));

 
  app.openapi(getFilterEnumsRoute, enumController.getFilterEnums as any);
  app.openapi(getAllEnumsRoute, enumController.getAllEnums as any);

  return app;
};