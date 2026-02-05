import { OpenAPIHono } from '@hono/zod-openapi';
import { AuthController } from './auth.controller.js';
import { 
  loginRoute, 
  logoutRoute, 
  meRoute, 
  forgotPasswordRoute, 
  resendOtpRoute,
  verifyOtpRoute,
  resetPasswordRoute
} from './auth.openapi.js';
import { createZodErrorHook } from '../../../shared/utils/zod.js';

export const createAuthRoutes = (controller: AuthController) => {
  const zodErrorHook = createZodErrorHook();
  const app = new OpenAPIHono({
    defaultHook: zodErrorHook
  });

  app.openapi(loginRoute, controller.login as any);
  app.openapi(logoutRoute, controller.logout as any);
  app.openapi(meRoute, controller.me as any);
  app.openapi(forgotPasswordRoute, controller.forgotPassword as any);
  app.openapi(resendOtpRoute, controller.resendOtp as any);
  app.openapi(verifyOtpRoute, controller.verifyOtp as any);
  app.openapi(resetPasswordRoute, controller.resetPassword as any);

  return app;
};
