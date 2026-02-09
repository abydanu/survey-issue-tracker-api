import { OpenAPIHono } from '@hono/zod-openapi';
import { EnumController } from './enum.controller.js';
import { getFilterEnumsRoute, getAllEnumsRoute } from './enum.openapi.js';
import { authMiddleware } from '../../../shared/middlewares/auth.middleware.js';
import { AuthService } from '../../auth/application/auth.service.js';
import { AuthPrismaRepository } from '../../auth/infrastructure/auth.prisma.repository.js';
import { createZodErrorHook } from '../../../shared/utils/zod.js';

const authRepo = new AuthPrismaRepository();
const authService = new AuthService(authRepo);

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