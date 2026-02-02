import prisma from '../../../infrastructure/database/prisma.js';
import type { IAuthRepository } from '../domain/auth.repository.js';
import type { User, Session } from '../domain/auth.entity.js';

export class AuthPrismaRepository implements IAuthRepository {
  async findUserByUsername(username: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { username },
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
}
