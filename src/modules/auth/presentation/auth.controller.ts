import type { Context } from 'hono';
import { AuthService } from '../application/auth.service.js';
import ApiResponseHelper from '../../../shared/utils/response.js';
import logger from '../../../infrastructure/logging/logger.js';
import type { LoginCredentials } from '../domain/auth.entity.js';

export class AuthController {
  constructor(private authService: AuthService) {}

  login = async (c: Context) => {
    try {
      const body = await c.req.json<LoginCredentials>();
      const result = await this.authService.login(body);
      return ApiResponseHelper.success(c, result, 'Login successful');
    } catch (error: any) {
      logger.error('Login error:', error);
      return ApiResponseHelper.error(c, error.message || 'Login failed');
    }
  };

  logout = async (c: Context) => {
    try {
      const authHeader = c.req.header('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ApiResponseHelper.unauthorized(c, 'Token not found or invalid');
      }

      const token = authHeader.substring(7);
      await this.authService.verifyToken(token);
      await this.authService.logout(token);

      return ApiResponseHelper.success(c, null, 'Logout successful');
    } catch (error: any) {
      logger.error('Logout error:', error);
      return ApiResponseHelper.unauthorized(c, error.message || 'Logout failed');
    }
  };

  me = async (c: Context) => {
    try {
      const authHeader = c.req.header('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ApiResponseHelper.unauthorized(c, 'Token not found or invalid');
      }

      const token = authHeader.substring(7);
      const user = await this.authService.verifyToken(token);

      return ApiResponseHelper.success(c, user, 'User data fetched successfully');
    } catch (error: any) {
      logger.error('Get user error:', error);
      return ApiResponseHelper.unauthorized(c, error.message || 'Invalid or expired token');
    }
  };
}