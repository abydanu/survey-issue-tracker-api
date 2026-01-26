import type { Context } from 'hono';
import type { StatusCode } from 'hono/utils/http-status';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any;
}

export class ApiResponseHelper {
  static success<T>(
    c: Context,
    data: T,
    message = 'Success',
    status: StatusCode = 200
  ) {
    return c.json<ApiResponse<T>>(
      {
        success: true,
        message,
        data,
      },
      status as any
    );
  }

  static created<T>(c: Context, data: T, message = 'Created successfully') {
    return this.success(c, data, message, 201);
  }

  static error(
    c: Context,
    message: string,
    errors?: any,
    status: StatusCode = 400
  ) {
    return c.json<ApiResponse>(
      {
        success: false,
        message,
        errors,
      },
      status as any
    );
  }

  static badRequest(c: Context, message = 'Bad request', errors?: any) {
    return this.error(c, message, errors, 400);
  }

  static unauthorized(c: Context, message = 'Unauthorized') {
    return this.error(c, message, undefined, 401);
  }

  static forbidden(c: Context, message = 'Forbidden') {
    return this.error(c, message, undefined, 403);
  }

  static notFound(c: Context, message = 'Resource not found') {
    return this.error(c, message, undefined, 404);
  }

  static serverError(c: Context, message = 'Internal server error', errors?: any) {
    return this.error(c, message, errors, 500);
  }
}

export default ApiResponseHelper;
