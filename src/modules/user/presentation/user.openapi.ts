import { createRoute, z } from '@hono/zod-openapi';

export const UserResponseSchema = z.object({
  id: z.string().openapi({ example: 'cmktbcxhz00010yggdaqo685v' }),
  username: z.string().openapi({ example: 'johndoe' }),
  name: z.string().openapi({ example: 'John Doe' }),
  role: z.enum(['ADMIN', 'USER']).openapi({ example: 'USER' }),
  createdAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
});

export const CreateUserRequestSchema = z.object({
  username: z.string().min(3).max(50).openapi({
    example: 'johndoe',
    description: 'Username minimal 3 karakter, maksimal 50 karakter'
  }),
  password: z.string().min(6).openapi({
    example: 'password123',
    description: 'Password minimal 6 karakter'
  }),
  name: z.string().min(1).max(100).openapi({
    example: 'John Doe',
    description: 'Nama lengkap user'
  }),
  role: z.enum(['ADMIN', 'USER']).optional().openapi({
    example: 'USER',
    description: 'Role user, default USER'
  }),
});

export const UpdateUserRequestSchema = z.object({
  username: z.string().min(3).max(50).optional().openapi({
    example: 'johndoe',
    description: 'Username minimal 3 karakter, maksimal 50 karakter'
  }),
  password: z.string().min(6).optional().openapi({
    example: 'newpassword123',
    description: 'Password minimal 6 karakter'
  }),
  name: z.string().min(1).max(100).optional().openapi({
    example: 'John Doe Updated',
    description: 'Nama lengkap user'
  }),
  role: z.enum(['ADMIN', 'USER']).optional().openapi({
    example: 'ADMIN',
    description: 'Role user'
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

export const getUsersRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Users'],
  summary: 'Get all users',
  description: 'Mendapatkan daftar semua user',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Daftar user berhasil diambil',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema.extend({
            data: z.array(UserResponseSchema),
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

export const getUserByIdRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Get user by ID',
  description: 'Mendapatkan detail user berdasarkan ID',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ example: 'cmktbcxhz00010yggdaqo685v' }),
    }),
  },
  responses: {
    200: {
      description: 'Detail user berhasil diambil',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema.extend({
            data: UserResponseSchema,
          }),
        },
      },
    },
    404: {
      description: 'User tidak ditemukan',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
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

export const createUserRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Users'],
  summary: 'Create new user',
  description: 'Membuat user baru',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateUserRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'User berhasil dibuat',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema.extend({
            data: UserResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Validasi gagal atau username sudah digunakan',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
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

export const updateUserRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Update user',
  description: 'Update data user berdasarkan ID',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ example: 'cmktbcxhz00010yggdaqo685v' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateUserRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'User berhasil diupdate',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema.extend({
            data: UserResponseSchema,
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Validasi gagal atau username sudah digunakan',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'User tidak ditemukan',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
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

export const deleteUserRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Delete user',
  description: 'Menghapus user berdasarkan ID',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ example: 'cmktbcxhz00010yggdaqo685v' }),
    }),
  },
  responses: {
    200: {
      description: 'User berhasil dihapus',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema,
        },
      },
    },
    404: {
      description: 'User tidak ditemukan',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
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
