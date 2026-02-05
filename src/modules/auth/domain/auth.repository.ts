import type { User, Session, PasswordResetOtp } from './auth.entity.js';

export interface IAuthRepository {
  findUserByUsername(username: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  updateLastLogin(userId: string): Promise<void>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;

  createSession(userId: string, token: string, expiresAt: Date): Promise<void>;
  findSessionByToken(token: string): Promise<Session | null>;
  deleteSessionByToken(token: string): Promise<void>;
  deleteAllUserSessions(userId: string): Promise<void>;

  createPasswordResetOtp(userId: string, otp: string, expiresAt: Date): Promise<void>;
  findPasswordResetOtp(otp: string): Promise<PasswordResetOtp | null>;
  findPasswordResetOtpByUserId(userId: string): Promise<PasswordResetOtp | null>;
  incrementOtpAttempts(otpId: string): Promise<void>;
  markPasswordResetOtpAsUsed(otpId: string): Promise<void>;
  deleteExpiredOtps(): Promise<void>;
}
