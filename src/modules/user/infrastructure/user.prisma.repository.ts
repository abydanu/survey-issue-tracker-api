import prisma from '../../../infrastructure/database/prisma.js';
import { Prisma } from '../../../generated/prisma/client.js';
import type { IUserRepository } from '../domain/user.repository.js';
import type { User, CreateUserDto, UpdateUserDto } from '../domain/user.entity.js';
import bcrypt from 'bcryptjs';
import type { UserQuery } from '../domain/user.query.js';
import logger from '../../../infrastructure/logging/logger.js';

export class UserPrismaRepository implements IUserRepository {
  async findAll(query: UserQuery): Promise<{ data: User[]; total: number }> {
    const page = (query.page && typeof query.page === 'number' && query.page > 0) ? query.page : 1;
    const limit = (query.limit && typeof query.limit === 'number' && query.limit > 0) ? query.limit : 10;
    
    const where = query.search && query.search.trim()
    ? {
      OR: [
        { username: { contains: query.search.trim(), mode: Prisma.QueryMode.insensitive } },
        { name: { contains: query.search.trim(), mode: Prisma.QueryMode.insensitive } },
        { email: { contains: query.search.trim(), mode: Prisma.QueryMode.insensitive } },
      ],
    }
    : undefined;
    const [ data, total ] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.user.count({ where })
    ]);

    return {
      data: data as User[],
      total
    };
  }

  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    return user as User | null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { username },
    });
    return user as User | null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    return user as User | null;
  }

  async create(data: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email || null,
        password: hashedPassword,
        name: data.name,
        role: data.role || 'USER',
      },
    });
    return user as User;
  }

  async update(id: string, data: UpdateUserDto, currentToken?: string): Promise<User> {
    const updateData: any = {};
  
    if (data.username) updateData.username = data.username;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    
    let passwordChanged = false;
    
    if (data.oldPassword && data.newPassword) {
      const user = await this.findById(id);
      if (!user) {
        throw new Error('User not found');
      }
      const isPasswordValid = await bcrypt.compare(data.oldPassword, user.password);
      if (!isPasswordValid) {
        throw new Error('Old password is incorrect');
      }
      updateData.password = await bcrypt.hash(data.newPassword, 10);
      passwordChanged = true;
    }
  
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });
  
    if (passwordChanged) {
      await this.clearUserSessions(id);
    }
  
    return user as User;
  }
  
  private async clearUserSessions(userId: string): Promise<void> {
    try {
      await prisma.session.deleteMany({
        where: { userId },
      });
      logger.info(`All sessions cleared for user: ${userId}`);
    } catch (error: any) {
      logger.error('Error clearing user sessions:', error);
      throw new Error(`Failed to clear user sessions: ${error.message}`);
    }
  }

  async delete(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }
}
