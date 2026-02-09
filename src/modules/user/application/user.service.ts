import type {
  User,
  UserResponse,
  CreateUserDto,
  UpdateUserDto,
} from '../domain/user.entity.js';
import type { IUserRepository } from '../domain/user.repository.js';
import logger from '../../../infrastructure/logging/logger.js';
import type { UserQuery } from '../domain/user.query.js';

export class UserService {
  constructor(private userRepo: IUserRepository) {}

  async getUsers(query: UserQuery) {
    const { data, total } = await this.userRepo.findAll(query);

    const page = (query.page);
    const limit = (query.limit);

    return {
      data: data.map(u => this.toUserResponse(u)),
      meta: {
        page,
        limit,
        total
      },
    };
  }
  
  async getUserById(id: string): Promise<UserResponse> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return this.toUserResponse(user);
  }

  async createUser(data: CreateUserDto): Promise<UserResponse> {
    const existingUser = await this.userRepo.findByUsername(data.username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    if (data.email) {
      const existingEmail = await this.userRepo.findByEmail(data.email);
      if (existingEmail) {
        throw new Error('Email already exists');
      }
    }

    const user = await this.userRepo.create(data);
    logger.info(`User created: ${user.username}`);
    return this.toUserResponse(user);
  }

  async updateUser(id: string, data: UpdateUserDto): Promise<UserResponse> {
    const existingUser = await this.userRepo.findById(id);
    if (!existingUser) {
      throw new Error('User not found');
    }

    if (data.username && data.username !== existingUser.username) {
      const usernameExists = await this.userRepo.findByUsername(data.username);
      if (usernameExists) {
        throw new Error('Username already exists');
      }
    }

    if (data.email && data.email !== existingUser.email) {
      const emailExists = await this.userRepo.findByEmail(data.email);
      if (emailExists) {
        throw new Error('Email already exists');
      }
    }

    const user = await this.userRepo.update(id, data);
    logger.info(`User updated: ${user.username}`);
    return this.toUserResponse(user);
  }

  async deleteUser(id: string): Promise<User> {
    logger.info({ userId: id }, 'Attempting to delete user');
    
    const user = await this.userRepo.findById(id);
    if (!user) {
      logger.warn({ userId: id }, 'User not found for deletion');
      throw new Error('User tidak ditemukan');
    }

    logger.info({ userId: id, username: user.username }, 'User found, proceeding with deletion');
    
    await this.userRepo.delete(id);
    
    logger.info({ userId: id, username: user.username }, 'User deleted successfully');

    return user;
  }

  private toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
