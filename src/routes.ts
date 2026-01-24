import { OpenAPIHono } from '@hono/zod-openapi';
import { createAuthRoutes } from './modules/auth/presentation/auth.route';
import { AuthController } from './modules/auth/presentation/auth.controller';
import { AuthService } from './modules/auth/application/auth.service';
import { AuthPrismaRepository } from './modules/auth/infrastructure/auth.prisma.repository';

const authRepo = new AuthPrismaRepository();
const authService = new AuthService(authRepo);
const authController = new AuthController(authService);

export const setupRoutes = (app: OpenAPIHono) => {
  app.route('/api/auth', createAuthRoutes(authController));
};
