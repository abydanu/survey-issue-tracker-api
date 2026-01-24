import type { Context, Next } from 'hono';
import { AuthService } from '../../modules/auth/application/auth.service';
import ApiResponseHelper from '../response/api-response';
import logger from '../../infrastructure/logging/logger';

export const authMiddleware = (authService: AuthService) => {
  return async (c: Context, next: Next) => {
    try {
      const authHeader = c.req.header('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ApiResponseHelper.unauthorized(c, 'Token tidak ditemukan');
      }

      const token = authHeader.substring(7);
      const decoded = await authService.verifyToken(token);
      
      c.set('user', decoded);
      
      await next();
    } catch (error) {
      logger.error('Auth middleware error:', error);
      return ApiResponseHelper.unauthorized(c, 'Token tidak valid atau expired');
    }
  };
};
