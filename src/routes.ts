import { OpenAPIHono } from '@hono/zod-openapi';
import { createAuthRoutes } from './modules/auth/presentation/auth.route';
import { AuthController } from './modules/auth/presentation/auth.controller';
import { AuthService } from './modules/auth/application/auth.service';
import { AuthPrismaRepository } from './modules/auth/infrastructure/auth.prisma.repository';
import { createUserRoutes } from './modules/user/presentation/user.route';
import { UserController } from './modules/user/presentation/user.controller';
import { UserService } from './modules/user/application/user.service';
import { UserPrismaRepository } from './modules/user/infrastructure/user.prisma.repository';

const authRepo = new AuthPrismaRepository();
const authService = new AuthService(authRepo);
const authController = new AuthController(authService);

const userRepo = new UserPrismaRepository();
const userService = new UserService(userRepo);
const userController = new UserController(userService);

export const setupRoutes = (app: OpenAPIHono) => {
  app.route('/api/auth', createAuthRoutes(authController));
  app.route('/api/users', createUserRoutes(userController));
};
