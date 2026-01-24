import type { Context } from 'hono';
import { AuthService } from '../application/auth.service';
import ApiResponseHelper from '../../../shared/response/api-response';
import logger from '../../../infrastructure/logging/logger';
import type { LoginCredentials } from '../domain/auth.entity';

export class AuthController {
  constructor(private authService: AuthService) {}

  login = async (c: Context) => {
    try {
      const body = await c.req.json<LoginCredentials>();
      const result = await this.authService.login(body);
      return ApiResponseHelper.success(c, result, 'Login berhasil');
    } catch (error: any) {
      logger.error('Login error:', error);
      return ApiResponseHelper.error(c, error.message || 'Login gagal');
    }
  };

  logout = async (c: Context) => {
    try {
      const authHeader = c.req.header('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ApiResponseHelper.unauthorized(c, 'Token tidak ditemukan');
      }

      const token = authHeader.substring(7);
      await this.authService.verifyToken(token);
      await this.authService.logout(token);
      
      return ApiResponseHelper.success(c, null, 'Logout berhasil');
    } catch (error: any) {
      logger.error('Logout error:', error);
      return ApiResponseHelper.unauthorized(c, error.message || 'Logout gagal');
    }
  };

  me = async (c: Context) => {
    try {
      const authHeader = c.req.header('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ApiResponseHelper.unauthorized(c, 'Token tidak ditemukan');
      }

      const token = authHeader.substring(7);
      const user = await this.authService.verifyToken(token);
      
      return ApiResponseHelper.success(c, user, 'Data user berhasil diambil');
    } catch (error: any) {
      logger.error('Get user error:', error);
      return ApiResponseHelper.unauthorized(c, error.message || 'Token tidak valid');
    }
  };
}
