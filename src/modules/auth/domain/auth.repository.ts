import type { User, Session } from './auth.entity';

export interface IAuthRepository {
  // User methods
  findUserByUsername(username: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  
  // Session methods
  createSession(userId: string, token: string, expiresAt: Date): Promise<void>;
  findSessionByToken(token: string): Promise<Session | null>;
  deleteSessionByToken(token: string): Promise<void>;
}
