import prisma from '../../../infrastructure/database/prisma';
import { Prisma } from '../../../generated/prisma/client';
import type { IUserRepository } from '../domain/user.repository';
import type { User, CreateUserDto, UpdateUserDto } from '../domain/user.entity';
import bcrypt from 'bcryptjs';
import type { UserQuery } from '../domain/user.query';

export class UserPrismaRepository implements IUserRepository {
  async findAll(query: UserQuery): Promise<{ data: User[]; total: number }> {
    const page = (query.page && typeof query.page === 'number' && query.page > 0) ? query.page : 1;
    const limit = (query.limit && typeof query.limit === 'number' && query.limit > 0) ? query.limit : 10;
    
    const where = query.search && query.search.trim()
    ? {
      OR: [
        { username: { contains: query.search.trim(), mode: Prisma.QueryMode.insensitive } },
        { name: { contains: query.search.trim(), mode: Prisma.QueryMode.insensitive } },
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

  async create(data: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        name: data.name,
        role: data.role || 'USER',
      },
    });
    return user as User;
  }

  async update(id: string, data: UpdateUserDto): Promise<User> {
    const updateData: any = {};

    if (data.username) updateData.username = data.username;
    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });
    return user as User;
  }

  async delete(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }
}
