import prisma from '../../../infrastructure/database/prisma';
import type { IUserRepository } from '../domain/user.repository';
import type { User, CreateUserDto, UpdateUserDto } from '../domain/user.entity';
import bcrypt from 'bcryptjs';

export class UserPrismaRepository implements IUserRepository {
  async findAll(): Promise<User[]> {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users as User[];
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
