import { createRoute, z } from '@hono/zod-openapi';
import type { bearerAuth } from 'hono/bearer-auth';

export const LoginRequestSchema = z.object({
  username: z.string().min(3).max(50).openapi({
    example: 'admin',
    description: 'Username untuk login'
  }),
  password: z.string().min(3).openapi({
    example: 'admin123',
    description: 'Password minimal 3 karakter'
  }),
});

export const UserResponseSchema = z.object({
  id: z.string().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
  username: z.string().openapi({ example: 'admin' }),
  createdAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
});

export const AuthResponseSchema = z.object({
  user: UserResponseSchema,
  token: z.string().openapi({ 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT token untuk authentication'
  }),
});

export const ApiSuccessResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  message: z.string().openapi({ example: 'Success' }),
  data: z.any().optional(),
});

export const ApiErrorResponseSchema = z.object({
  success: z.boolean().openapi({ example: false }),
  message: z.string().openapi({ example: 'Error message' }),
  errors: z.any().optional(),
});

export const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['Authentication'],
  summary: 'Login user',
  description: 'Login dengan username dan password untuk mendapatkan JWT token',
  security: [],
  request: {
    body: {
      content: {
        'application/json': {
          schema: LoginRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login berhasil',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema.extend({
            data: AuthResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Validasi gagal',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
  },
});

export const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  tags: ['Authentication'],
  summary: 'Logout user',
  description: 'Logout dan hapus session user',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Logout berhasil',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - Token tidak valid',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
  },
});

export const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['Authentication'],
  summary: 'Get current user',
  description: 'Mendapatkan informasi user yang sedang login',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Data user berhasil diambil',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema.extend({
            data: z.object({
              userId: z.string(),
              username: z.string(),
            }),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized - Token tidak valid',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
  },
});
