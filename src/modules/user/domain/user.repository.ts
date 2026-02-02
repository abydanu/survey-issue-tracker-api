import type { User, CreateUserDto, UpdateUserDto } from './user.entity.js';
import type { UserQuery } from './user.query.js';

export interface IUserRepository {
  findAll(query: UserQuery): Promise<{
    data: User[];
    total: number;
  }>;

  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(data: CreateUserDto): Promise<User>;
  update(id: string, data: UpdateUserDto): Promise<User>;
  delete(id: string): Promise<void>;
}
