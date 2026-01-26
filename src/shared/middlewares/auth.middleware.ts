import type { Context, Next } from 'hono';
import { AuthService } from '../../modules/auth/application/auth.service';
import ApiResponseHelper from '../utils/response';
import logger from '../../infrastructure/logging/logger';
import type { TokenPayload } from '../../modules/auth/domain/auth.entity';

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

export const adminMiddleware = () => {
  return async (c: Context, next: Next) => {
    try {
      const user = c.get('user') as TokenPayload | undefined;
      
      if (!user) {
        return ApiResponseHelper.unauthorized(c, 'Token tidak ditemukan');
      }

      if (user.role !== 'ADMIN') {
        return ApiResponseHelper.forbidden(c, 'Akses ditolak. Hanya administrator yang dapat mengakses endpoint ini.');
      }
      
      await next();
    } catch (error) {
      logger.error('Admin middleware error:', error);
      return ApiResponseHelper.forbidden(c, 'Akses ditolak');
    }
  };
};
