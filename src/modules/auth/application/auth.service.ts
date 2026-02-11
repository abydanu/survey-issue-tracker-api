import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type {
  LoginCredentials,
  AuthResponse,
  UserResponse,
  TokenPayload,
  User,
  ForgotPasswordRequest,
  VerifyOtpRequest,
  ResetPasswordRequest,
} from '../domain/auth.entity.js';
import type { IAuthRepository } from '../domain/auth.repository.js';
import { EmailService } from '../../../shared/services/email.service.js';
import logger from '../../../infrastructure/logging/logger.js';

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export class AuthService {
  private emailService: EmailService;

  constructor(private authRepo: IAuthRepository) {

    this.emailService = new EmailService({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || '',
    });
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { username, password } = credentials;

    let user;

    if (isEmail(username)) {
      user = await this.authRepo.findUserByEmail(username);
    } else {
      user = await this.authRepo.findUserByUsername(username);
    }

    if (!user) {
      logger.warn(`Login failed: User not found - ${username}`);
      throw new Error('Invalid username/email or password');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      logger.warn(`Login failed: Invalid password - ${username}`);
      throw new Error('Invalid username/email or password');
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      process.env.JWT_SECRET || 'default-secret-key',
      { expiresIn: '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.authRepo.createSession(user.id, token, expiresAt);
    await this.authRepo.updateLastLogin(user.id);

    logger.info(`User logged in successfully - ${username}`);

    return {
      user: this.toUserResponse(user),
      token,
    };
  }

  async logout(token: string): Promise<void> {
    await this.authRepo.deleteSessionByToken(token);
    logger.info('User logged out successfully');
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key') as TokenPayload;

      const session = await this.authRepo.findSessionByToken(token);
      if (!session || session.expiresAt < new Date()) {
        throw new Error('Invalid or expired token');
      }

      if (!decoded.email && decoded.userId) {
        const user = await this.authRepo.findUserById(decoded.userId);
        if (user && user.email) {
          decoded.email = user.email;
        }
      }

      return decoded;
    } catch (error) {
      logger.warn('Token verification failed');
      throw new Error('Invalid or expired token');
    }
  }

  async forgotPassword(request: ForgotPasswordRequest): Promise<void> {
    const { email } = request;

    const user = await this.authRepo.findUserByEmail(email);
    if (!user) {
      logger.warn(`Forgot password attempt for non-existent email: ${email}`);
      return;
    }

    await this.authRepo.deleteExpiredOtps();

    const otp = this.generateOtp();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await this.authRepo.createPasswordResetOtp(user.id, otp, expiresAt);

    const userName = user.name || user.username;
    
    // Send email asynchronously (fire and forget)
    // This prevents blocking the response while waiting for SMTP
    this.emailService.sendPasswordResetOtp(email, otp, userName)
      .then((emailSent) => {
        if (emailSent) {
          logger.info(`Password reset OTP sent to: ${email} for user: ${userName}`);
        } else {
          logger.error(`Failed to send password reset OTP to: ${email}`);
        }
      })
      .catch((error) => {
        logger.error({ error, email }, 'Error sending password reset OTP');
      });

    // Return immediately without waiting for email
    logger.info(`Password reset OTP generated for: ${email}, sending email in background`);
  }

  async resendOtp(request: ForgotPasswordRequest): Promise<void> {
    const { email } = request;


    const user = await this.authRepo.findUserByEmail(email);
    if (!user) {

      logger.warn(`Resend OTP attempt for non-existent email: ${email}`);
      return;
    }


    const existingOtp = await this.authRepo.findPasswordResetOtpByUserId(user.id);
    if (existingOtp && !existingOtp.used) {
      const timeSinceCreated = Date.now() - existingOtp.createdAt.getTime();
      const oneMinute = 60 * 1000;

      if (timeSinceCreated < oneMinute) {
        throw new Error('Please wait at least 1 minute before requesting another OTP');
      }
    }


    await this.authRepo.deleteExpiredOtps();


    const otp = this.generateOtp();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);


    await this.authRepo.createPasswordResetOtp(user.id, otp, expiresAt);


    const userName = user.name || user.username;
    
    // Send email asynchronously (fire and forget)
    this.emailService.sendPasswordResetOtp(email, otp, userName)
      .then((emailSent) => {
        if (emailSent) {
          logger.info(`Password reset OTP resent to: ${email} for user: ${userName}`);
        } else {
          logger.error(`Failed to resend password reset OTP to: ${email}`);
        }
      })
      .catch((error) => {
        logger.error({ error, email }, 'Error resending password reset OTP');
      });

    // Return immediately without waiting for email
    logger.info(`Password reset OTP regenerated for: ${email}, sending email in background`);
  }

  async verifyOtp(request: VerifyOtpRequest): Promise<{ valid: boolean; message: string }> {
    const { email, otp } = request;


    const user = await this.authRepo.findUserByEmail(email);
    if (!user) {
      return { valid: false, message: 'Invalid email or OTP' };
    }


    const otpRecord = await this.authRepo.findPasswordResetOtp(otp);
    if (!otpRecord || otpRecord.userId !== user.id) {
      return { valid: false, message: 'Invalid email or OTP' };
    }


    if (otpRecord.expiresAt < new Date()) {
      return { valid: false, message: 'OTP has expired' };
    }


    if (otpRecord.used) {
      return { valid: false, message: 'OTP has already been used' };
    }


    if (otpRecord.attempts >= 5) {
      return { valid: false, message: 'Too many attempts. Please request a new OTP' };
    }

    return { valid: true, message: 'OTP is valid' };
  }

  async resetPassword(request: ResetPasswordRequest): Promise<void> {
    const { email, otp, newPassword } = request;

    const otpVerification = await this.verifyOtp({ email, otp });
    if (!otpVerification.valid) {
      logger.warn({ email, reason: otpVerification.message }, 'OTP verification failed:');
      const otpRecord = await this.authRepo.findPasswordResetOtp(otp);
      if (otpRecord) {
        await this.authRepo.incrementOtpAttempts(otpRecord.id);
      }
      throw new Error(otpVerification.message);
    }

    const user = await this.authRepo.findUserByEmail(email);
    const otpRecord = await this.authRepo.findPasswordResetOtp(otp);

    if (!user || !otpRecord) {
      logger.error( { email, hasUser: !!user, hasOtpRecord: !!otpRecord }, 'User or OTP record not found:');
      throw new Error('Invalid request');
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      logger.warn({ email }, 'New password same as old password:');
      throw new Error('New password must be different');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.authRepo.updateUserPassword(user.id, hashedPassword);
    await this.authRepo.markPasswordResetOtpAsUsed(otpRecord.id);

    await this.authRepo.deleteAllUserSessions(user.id);

    logger.info(`Password reset successfully for user: ${user.username} (${email})`);
  }

  private generateOtp(): string {

    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      lastLoginAt: user.lastLoginAt ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
