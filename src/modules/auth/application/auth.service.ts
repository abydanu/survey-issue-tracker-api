import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type {
  LoginCredentials,
  AuthResponse,
  UserResponse,
  TokenPayload,
  User,
} from '../domain/auth.entity';
import type { IAuthRepository } from '../domain/auth.repository';
import logger from '../../../infrastructure/logging/logger';

export class AuthService {
  constructor(private authRepo: IAuthRepository) {}

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { username, password } = credentials;

    const user = await this.authRepo.findUserByUsername(username);
    if (!user) {
      logger.warn(`Login failed: User not found - ${username}`);
      throw new Error('Invalid username or password');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      logger.warn(`Login failed: Invalid password - ${username}`);
      throw new Error('Invalid username or password');
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.authRepo.createSession(user.id, token, expiresAt);

    logger.info(`User logged in successfully - ${username}`);

    return {
      user: this.toUserResponse(user),
      token,
    };
  }

  async logout(token: string): Promise<void> {
    await this.authRepo.deleteSessionByToken(token);
    logger.info('User logged out successfully');
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as TokenPayload;

      const session = await this.authRepo.findSessionByToken(token);
      if (!session || session.expiresAt < new Date()) {
        throw new Error('Invalid or expired token');
      }

      return decoded;
    } catch (error) {
      logger.warn('Token verification failed');
      throw new Error('Invalid or expired token');
    }
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
