import { AuthService } from '../../modules/auth/application/auth.service.js';
import { AuthPrismaRepository } from '../../modules/auth/infrastructure/auth.prisma.repository.js';

// Singleton instance untuk AuthService
const authRepo = new AuthPrismaRepository();
export const authService = new AuthService(authRepo);
