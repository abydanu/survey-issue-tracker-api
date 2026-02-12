export class ErrorSanitizer {
  private static readonly SAFE_ERROR_PATTERNS = [
    /not found/i,
    /tidak ditemukan/i,
    /already exists/i,
    /sudah digunakan/i,
    /sudah ada/i,
    /invalid/i,
    /incorrect/i,
    /wrong password/i,
    /password salah/i,
    /timeout/i,
    /wait at least/i,
    /tunggu/i,
    /expired/i,
    /kadaluarsa/i,
    /unauthorized/i,
    /tidak diizinkan/i,
    /forbidden/i,
    /format tanggal/i,
  ];

  
  private static isSafeMessage(message: string): boolean {
    return this.SAFE_ERROR_PATTERNS.some(pattern => pattern.test(message));
  }

  static sanitize(error: any, fallbackMessage: string): string {
    if (!error) return fallbackMessage;

    const message = error.message || error.toString();

    
    if (this.isSafeMessage(message)) {
      return message;
    }

    
    if (
      message.includes('Prisma') ||
      message.includes('prisma') ||
      message.includes('PrismaClient') ||
      message.includes('Database') ||
      message.includes('SQL') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ETIMEDOUT') ||
      message.includes('node_modules') ||
      message.includes('at ') || 
      message.includes('Error:') ||
      message.includes('TypeError') ||
      message.includes('ReferenceError')
    ) {
      return fallbackMessage;
    }

    
    if (message.length > 200) {
      return fallbackMessage;
    }

    
    return message;
  }

  
  static isNotFoundError(error: any): boolean {
    const message = error?.message || '';
    return /not found|tidak ditemukan/i.test(message);
  }

  static isTimeoutError(error: any): boolean {
    const message = error?.message || '';
    return /timeout/i.test(message);
  }

  static isValidationError(error: any): boolean {
    const message = error?.message || '';
    return /invalid|format|validation/i.test(message);
  }

  static isConflictError(error: any): boolean {
    const message = error?.message || '';
    return /already exists|sudah digunakan|sudah ada|duplicate/i.test(message);
  }

  static isUnauthorizedError(error: any): boolean {
    const message = error?.message || '';
    return /unauthorized|tidak diizinkan|forbidden|expired|kadaluarsa/i.test(message);
  }
}
