import type {
  User,
  UserResponse,
  CreateUserDto,
  UpdateUserDto,
} from '../domain/user.entity';
import type { IUserRepository } from '../domain/user.repository';
import logger from '../../../infrastructure/logging/logger';

export class UserService {
  constructor(private userRepo: IUserRepository) {}

  async getAllUsers(): Promise<UserResponse[]> {
    const users = await this.userRepo.findAll();
    return users.map(user => this.toUserResponse(user));
  }

  async getUserById(id: string): Promise<UserResponse> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new Error('User tidak ditemukan');
    }
    return this.toUserResponse(user);
  }

  async createUser(data: CreateUserDto): Promise<UserResponse> {
    const existingUser = await this.userRepo.findByUsername(data.username);
    if (existingUser) {
      throw new Error('Username sudah digunakan');
    }

    const user = await this.userRepo.create(data);
    logger.info(`User created: ${user.username}`);
    return this.toUserResponse(user);
  }

  async updateUser(id: string, data: UpdateUserDto): Promise<UserResponse> {
    const existingUser = await this.userRepo.findById(id);
    if (!existingUser) {
      throw new Error('User tidak ditemukan');
    }

    if (data.username && data.username !== existingUser.username) {
      const usernameExists = await this.userRepo.findByUsername(data.username);
      if (usernameExists) {
        throw new Error('Username sudah digunakan');
      }
    }

    const user = await this.userRepo.update(id, data);
    logger.info(`User updated: ${user.id}`);
    return this.toUserResponse(user);
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new Error('User tidak ditemukan');
    }

    await this.userRepo.delete(id);
    logger.info(`User deleted: ${id}`);
  }

  private toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
