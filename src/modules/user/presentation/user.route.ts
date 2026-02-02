import { OpenAPIHono } from '@hono/zod-openapi';
import { UserController } from './user.controller.js';
import {
  getUsersRoute,
  getUserByIdRoute,
  createUserRoute,
  updateUserRoute,
  deleteUserRoute,
} from './user.openapi.js';
import { authMiddleware, adminMiddleware } from '../../../shared/middlewares/auth.middleware.js';
import { AuthService } from '../../auth/application/auth.service.js';
import { AuthPrismaRepository } from '../../auth/infrastructure/auth.prisma.repository.js';
import { createZodErrorHook } from '../../../shared/utils/zod.js';

const authRepo = new AuthPrismaRepository();
const authService = new AuthService(authRepo);

export const createUserRoutes = (controller: UserController) => {
  const zodErrorHook = createZodErrorHook();
  const app = new OpenAPIHono({
    defaultHook: zodErrorHook
  });

  app.use('*', authMiddleware(authService));
  app.use('*', adminMiddleware());

  app.openapi(getUsersRoute, controller.getAllUsers as any);
  app.openapi(getUserByIdRoute, controller.getUserById as any);
  app.openapi(createUserRoute, controller.createUser as any);
  app.openapi(updateUserRoute, controller.updateUser as any);
  app.openapi(deleteUserRoute, controller.deleteUser as any);

  return app;
};
