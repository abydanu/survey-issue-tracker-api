import { OpenAPIHono } from '@hono/zod-openapi';
import { createAuthRoutes } from '../modules/auth/presentation/auth.route.js';
import { AuthController } from '../modules/auth/presentation/auth.controller.js';
import { AuthService } from '../modules/auth/application/auth.service.js';
import { AuthPrismaRepository } from '../modules/auth/infrastructure/auth.prisma.repository.js';
import { createUserRoutes } from '../modules/user/presentation/user.route.js';
import { UserController } from '../modules/user/presentation/user.controller.js';
import { UserService } from '../modules/user/application/user.service.js';
import { UserPrismaRepository } from '../modules/user/infrastructure/user.prisma.repository.js';
import { createSyncRoutes } from '../modules/survey/presentation/sync.route.js';
import { SyncController } from '../modules/survey/presentation/sync.controller.js';
import { DashboardService, ChartService, StatsService } from '../modules/survey/application/dashboard.service.js';
import { AdminService } from '../modules/survey/application/admin.service.js';
import { SyncService } from '../modules/survey/application/sync.service.js';
import { SyncPrismaRepository } from '../modules/survey/infrastructure/sync.prisma.repository.js';

const authRepo = new AuthPrismaRepository();
const authService = new AuthService(authRepo);
const authController = new AuthController(authService);

const userRepo = new UserPrismaRepository();
const userService = new UserService(userRepo);
const userController = new UserController(userService);

const syncRepo = new SyncPrismaRepository();
const dashboardService = new DashboardService(syncRepo);
const adminService = new AdminService(syncRepo);
const syncService = new SyncService(syncRepo);
const chartService = new ChartService();
const statsService = new StatsService();
const syncController = new SyncController(dashboardService, adminService, syncService, chartService, statsService);

export const setupRoutes = (app: OpenAPIHono) => {
  app.route('/api/auth', createAuthRoutes(authController));
  app.route('/api/users', createUserRoutes(userController));
  app.route('/api', createSyncRoutes(syncController, syncController, syncController));
};
