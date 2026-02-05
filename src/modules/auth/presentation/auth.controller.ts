import type { Context } from 'hono';
import { AuthService } from '../application/auth.service.js';
import ApiResponseHelper from '../../../shared/utils/response.js';
import logger from '../../../infrastructure/logging/logger.js';
import type { LoginCredentials, ForgotPasswordRequest, VerifyOtpRequest, ResetPasswordRequest } from '../domain/auth.entity.js';

export class AuthController {
  constructor(private authService: AuthService) { }

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

  forgotPassword = async (c: Context) => {
    try {
      const body = await c.req.json<ForgotPasswordRequest>();
      await this.authService.forgotPassword(body);

      return ApiResponseHelper.success(
        c,
        null,
        'The link to reset your password has been sent via email, please check your email'
      );
    } catch (error: any) {
      logger.error('Forgot password error:', error);
      return ApiResponseHelper.error(c, error.message || 'Failed to process forgot password request');
    }
  };

  resendOtp = async (c: Context) => {
    try {
      const body = await c.req.json<ForgotPasswordRequest>();
      await this.authService.resendOtp(body);

      return ApiResponseHelper.success(
        c,
        null,
        'OTP has been resent to your email, please check your email'
      );
    } catch (error: any) {
      logger.error('Resend OTP error:', error);


      if (error.message.includes('wait at least')) {
        return ApiResponseHelper.error(c, error.message, undefined, 429);
      }

      return ApiResponseHelper.error(c, error.message || 'Failed to resend OTP');
    }
  };

  verifyOtp = async (c: Context) => {
    try {
      const body = await c.req.json<VerifyOtpRequest>();
      const result = await this.authService.verifyOtp(body);

      if (result.valid) {
        return ApiResponseHelper.success(c, { valid: true }, result.message);
      } else {
        return ApiResponseHelper.error(c, result.message, undefined, 400);
      }
    } catch (error: any) {
      logger.error('Verify OTP error:', error);
      return ApiResponseHelper.error(c, error.message || 'Failed to verify OTP');
    }
  };

  resetPassword = async (c: Context) => {
    try {
      const body = await c.req.json<ResetPasswordRequest>();
      await this.authService.resetPassword(body);

      return ApiResponseHelper.success(c, null, 'Password has been reset successfully');
    } catch (error: any) {
      logger.error('Reset password error:', error);
      return ApiResponseHelper.error(c, error.message || 'Failed to reset password');
    }
  };
}