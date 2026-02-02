import type { Context, Next } from 'hono';
import { AuthService } from '../../modules/auth/application/auth.service.js';
import ApiResponseHelper from '../utils/response.js';
import logger from '../../infrastructure/logging/logger.js';
import type { TokenPayload } from '../../modules/auth/domain/auth.entity.js';

export const authMiddleware = (authService: AuthService) => {
  return async (c: Context, next: Next) => {
    try {
      const authHeader = c.req.header('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ApiResponseHelper.unauthorized(c, 'Token not found');
      }

      const token = authHeader.substring(7);
      const decoded = await authService.verifyToken(token);

      c.set('user', decoded);

      await next();
    } catch (error) {
      logger.error(error, 'Auth middleware error:');
      return ApiResponseHelper.unauthorized(c, 'Invalid or expired token');
    }
  };
};

export const adminMiddleware = () => {
  return async (c: Context, next: Next) => {
    try {
      const user = c.get('user') as TokenPayload | undefined;
      
      if (!user) {
        return ApiResponseHelper.unauthorized(c, 'Token not found');
      }

      if (user.role !== 'ADMIN') {
        return ApiResponseHelper.forbidden(c, 'Access denied. Admin role required.');
      }

      await next();
    } catch (error) {
      logger.error(error as Error, 'Admin middleware error:');
      return ApiResponseHelper.forbidden(c, 'Access denied');
    }
  };
};
