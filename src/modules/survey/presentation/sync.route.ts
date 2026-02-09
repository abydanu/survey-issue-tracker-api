import { OpenAPIHono } from '@hono/zod-openapi';
import { SyncController } from './sync.controller.js';
import {
  getSurveyRoute,
  getChartSurveyCountRoute,
  getChartProfitLossRoute,
  getChartProfitLossByMonthRoute,
  getStatsRoute,
  getSyncStatusRoute,
  syncFromSheetsRoute,
  updateSurveyRoute,
  deleteSurveyRoute
} from './sync.openapi.js';
import { authMiddleware, adminMiddleware } from '../../../shared/middlewares/auth.middleware.js';
import { AuthService } from '../../auth/application/auth.service.js';
import { AuthPrismaRepository } from '../../auth/infrastructure/auth.prisma.repository.js';
import { createZodErrorHook } from '../../../shared/utils/zod.js';

const authRepo = new AuthPrismaRepository();
const authService = new AuthService(authRepo);

export const createSyncRoutes = (
  dashboardController: SyncController,
  adminController: SyncController,
  syncController: SyncController
) => {
  const zodErrorHook = createZodErrorHook();
  
  const surveyApp = new OpenAPIHono({
    defaultHook: zodErrorHook,
  });

  surveyApp.use('*', authMiddleware(authService));

  surveyApp.openapi(getSurveyRoute, dashboardController.getSurvey as any);
  surveyApp.openapi(getStatsRoute, dashboardController.getStats as any);
  surveyApp.openapi(getChartSurveyCountRoute, dashboardController.getChartSurveyCount as any);
  surveyApp.openapi(getChartProfitLossRoute, dashboardController.getChartProfitLoss as any);
  surveyApp.openapi(getChartProfitLossByMonthRoute, dashboardController.getChartProfitLossByMonth as any);

  const syncApp = new OpenAPIHono({
    defaultHook: zodErrorHook,
  });

  syncApp.use('*', authMiddleware(authService));
  syncApp.use('*', adminMiddleware());

  syncApp.openapi(getSyncStatusRoute, syncController.getSyncStatus as any);
  syncApp.openapi(syncFromSheetsRoute, syncController.syncFromSheets as any);

  const adminApp = new OpenAPIHono({
    defaultHook: zodErrorHook,
  });

  adminApp.use('*', authMiddleware(authService));
  adminApp.use('*', adminMiddleware());

  adminApp.openapi(updateSurveyRoute, adminController.updateSurvey as any);
  adminApp.openapi(deleteSurveyRoute, adminController.deleteSurvey as any);

  const app = new OpenAPIHono({
    defaultHook: zodErrorHook,
  });

  app.route('/survey', surveyApp);
  app.route('/sync', syncApp);
  app.route('/admin', adminApp);

  return app;
};
