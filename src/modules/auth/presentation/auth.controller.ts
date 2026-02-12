import type { Context } from 'hono';
import { AuthService } from '../application/auth.service.js';
import ApiResponseHelper from '../../../shared/utils/response.js';
import logger from '../../../infrastructure/logging/logger.js';
import { ErrorSanitizer } from '../../../shared/utils/error-sanitizer.js';
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
      return ApiResponseHelper.error(c, ErrorSanitizer.sanitize(error, 'Login failed'));
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
      return ApiResponseHelper.unauthorized(c, ErrorSanitizer.sanitize(error, 'Logout failed'));
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
      return ApiResponseHelper.unauthorized(c, ErrorSanitizer.sanitize(error, 'Invalid or expired token'));
    }
  };

  forgotPassword = async (c: Context) => {
    try {
      const body = await c.req.json<ForgotPasswordRequest>();
      
      logger.info({ email: body.email }, 'Forgot password request');
      
      await this.authService.forgotPassword(body);

      logger.info({ email: body.email }, 'OTP sent successfully');
      return ApiResponseHelper.success(
        c,
        null,
        'OTP sent, Please check your email.'
      );
    } catch (error: any) {
      logger.error({ message: error.message, stack: error.stack }, 'Forgot password error');
      return ApiResponseHelper.error(c, ErrorSanitizer.sanitize(error, 'Failed to process forgot password request'));
    }
  };

  resendOtp = async (c: Context) => {
    try {
      const body = await c.req.json<ForgotPasswordRequest>();
      
      logger.info({ email: body.email }, 'Resend OTP request');
      
      await this.authService.resendOtp(body);

      logger.info({ email: body.email }, 'OTP resent successfully');
      return ApiResponseHelper.success(
        c,
        null,
        "We've resent the OTP. Please check your inbox."
      );
    } catch (error: any) {
      logger.error({ message: error.message, stack: error.stack }, 'Resend OTP error');

      if (ErrorSanitizer.isTimeoutError(error) || error.message?.includes('wait at least')) {
        return ApiResponseHelper.error(c, ErrorSanitizer.sanitize(error, 'Please wait before requesting another OTP'), undefined, 429);
      }

      return ApiResponseHelper.error(c, ErrorSanitizer.sanitize(error, 'Failed to resend OTP'));
    }
  };

  verifyOtp = async (c: Context) => {
    try {
      const body = await c.req.json<VerifyOtpRequest>();
      
      logger.info({ email: body.email, otp: body.otp.substring(0, 2) + '****' }, 'Verify OTP request');
      
      const result = await this.authService.verifyOtp(body);

      if (result.valid) {
        logger.info({ email: body.email }, 'OTP verified successfully');
        return ApiResponseHelper.success(c, { valid: true }, 'OTP verified successfully');
      } else {
        logger.warn({ email: body.email, reason: result.message }, 'OTP verification failed');
        return ApiResponseHelper.error(c, ErrorSanitizer.sanitize(result, 'OTP verification failed'), undefined, 400);
      }
    } catch (error: any) {
      logger.error({ message: error.message, stack: error.stack }, 'Verify OTP error');
      return ApiResponseHelper.error(c, ErrorSanitizer.sanitize(error, 'Failed to verify OTP'));
    }
  };

  resetPassword = async (c: Context) => {
    try {
      const body = await c.req.json<ResetPasswordRequest>();
      
      logger.info({ 
        email: body.email,
        hasOtp: !!body.otp,
        hasPassword: !!body.newPassword 
      }, 'Reset password attempt');

      await this.authService.resetPassword(body);

      logger.info({ email: body.email }, 'Password reset successful');
      return ApiResponseHelper.success(c, null, 'Password has been reset successfully');
    } catch (error: any) {
      logger.error({
        message: error.message,
        stack: error.stack
      }, 'Reset password error');
      
      return ApiResponseHelper.error(c, ErrorSanitizer.sanitize(error, 'Failed to reset password'));
    }
  };
}
