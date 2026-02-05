import prisma from '../../../infrastructure/database/prisma.js';
import type { IAuthRepository } from '../domain/auth.repository.js';
import type { User, Session, PasswordResetOtp } from '../domain/auth.entity.js';

export class AuthPrismaRepository implements IAuthRepository {
  async findUserByUsername(username: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { username },
    });
    return user as User | null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    return user as User | null;
  }

  async findUserById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    return user as User | null;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async createSession(userId: string, token: string, expiresAt: Date): Promise<void> {
    await prisma.session.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  async findSessionByToken(token: string): Promise<Session | null> {
    const session = await prisma.session.findUnique({
      where: { token },
    });
    return session as Session | null;
  }

  async deleteSessionByToken(token: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { token },
    });
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { userId },
    });
  }

  async createPasswordResetOtp(userId: string, otp: string, expiresAt: Date): Promise<void> {
    await prisma.passwordResetOtp.deleteMany({
      where: { userId },
    });

    await prisma.passwordResetOtp.create({
      data: {
        userId,
        otp,
        expiresAt,
      },
    });
  }

  async findPasswordResetOtp(otp: string): Promise<PasswordResetOtp | null> {
    const resetOtp = await prisma.passwordResetOtp.findFirst({
      where: { otp },
    });
    return resetOtp as PasswordResetOtp | null;
  }

  async findPasswordResetOtpByUserId(userId: string): Promise<PasswordResetOtp | null> {
    const resetOtp = await prisma.passwordResetOtp.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return resetOtp as PasswordResetOtp | null;
  }

  async incrementOtpAttempts(otpId: string): Promise<void> {
    await prisma.passwordResetOtp.update({
      where: { id: otpId },
      data: { 
        attempts: { increment: 1 },
        updatedAt: new Date()
      },
    });
  }

  async markPasswordResetOtpAsUsed(otpId: string): Promise<void> {
    await prisma.passwordResetOtp.update({
      where: { id: otpId },
      data: { used: true },
    });
  }

  async deleteExpiredOtps(): Promise<void> {
    await prisma.passwordResetOtp.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { used: true },
          { attempts: { gte: 5 } }
        ]
      },
    });
  }
}
