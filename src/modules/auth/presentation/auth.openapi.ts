import { createRoute, z } from '@hono/zod-openapi';

export const LoginRequestSchema = z.object({
  username: z.string().min(3).max(100).openapi({
    example: 'admin / admin@example.com',
    description: 'Username atau email untuk login'
  }),
  password: z.string().min(3).openapi({
    example: 'admin123',
    description: 'Password minimal 3 karakter'
  }),
});

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email().openapi({
    example: 'johndoe@example.com',
    description: 'Email address untuk reset password'
  }),
});

export const VerifyOtpRequestSchema = z.object({
  email: z.string().email().openapi({
    example: 'johndoe@example.com',
    description: 'Email address yang terdaftar'
  }),
  otp: z.string().length(6).regex(/^\d{6}$/).openapi({
    example: '123456',
    description: '6-digit OTP code (hanya angka)'
  }),
});

export const ResetPasswordRequestSchema = z.object({
  email: z.string().email().openapi({
    example: 'johndoe@example.com',
    description: 'Email address yang terdaftar'
  }),
  otp: z.string().length(6).regex(/^\d{6}$/).openapi({
    example: '123456',
    description: '6-digit OTP code (hanya angka)'
  }),
  newPassword: z.string().min(3).openapi({
    example: 'newpassword123',
    description: 'Password baru minimal 3 karakter'
  }),
});

export const UserResponseSchema = z.object({
  id: z.string().openapi({ example: 'cm123abc456def789' }),
  username: z.string().openapi({ example: 'admin' }),
  email: z.string().email().nullable().openapi({ example: 'johndoe@example.com' }),
  name: z.string().openapi({ example: 'Alfonsus Siahaan' }),
  role: z.enum(['ADMIN', 'USER']).openapi({ example: 'ADMIN' }),
  lastLoginAt: z.string().nullable().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  createdAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
});

export const AuthResponseSchema = z.object({
  user: UserResponseSchema,
  token: z.string().openapi({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT token for authentication'
  }),
});

export const ApiSuccessResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  message: z.string().openapi({ example: 'Success' }),
  data: z.any().optional(),
});

export const ApiErrorResponseSchema = z.object({
  success: z.boolean().openapi({ example: false }),
  message: z.string().openapi({ example: 'Failed to login' }),
  errors: z.any().optional(),
});

export const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['Authentication'],
  summary: 'Login user',
  description: 'Login menggunakan username atau email dan password untuk mendapatkan JWT token',
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
      description: 'Bad request - Username/email atau password salah',
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
              userId: z.string().openapi({ example: 'cm123...' }),
              username: z.string().openapi({ example: 'admin' }),
              email: z.string().email().nullable().openapi({ example: 'admin@example.com' }),
              name: z.string().openapi({ example: 'Alfonsus Siahaan' }),
              role: z.enum(['ADMIN', 'USER']).openapi({ example: 'ADMIN' }),
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

export const forgotPasswordRoute = createRoute({
  method: 'post',
  path: '/forgot-password',
  tags: ['Authentication'],
  summary: 'Request password reset OTP',
  description: 'Mengirim kode OTP 6 digit ke alamat email yang terdaftar',
  security: [],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ForgotPasswordRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'OTP berhasil dikirim (jika email terdaftar)',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema,
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
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
  },
});

export const verifyOtpRoute = createRoute({
  method: 'post',
  path: '/verify-otp',
  tags: ['Authentication'],
  summary: 'Verify OTP code',
  description: 'Memverifikasi kode OTP yang diterima via email sebelum reset password',
  security: [],
  request: {
    body: {
      content: {
        'application/json': {
          schema: VerifyOtpRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'OTP valid dan bisa digunakan untuk reset password',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema.extend({
            data: z.object({
              valid: z.boolean().openapi({ example: true }),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - OTP tidak valid, expired, atau sudah digunakan',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema.extend({
            message: z.string().openapi({
              example: 'Invalid email or OTP',
              description: 'Possible messages: "Invalid email or OTP", "OTP has expired", "OTP has already been used", "Too many attempts. Please request a new OTP"'
            }),
          }),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
  },
});

export const resendOtpRoute = createRoute({
  method: 'post',
  path: '/resend-otp',
  tags: ['Authentication'],
  summary: 'Resend OTP code',
  description: 'Mengirim ulang kode OTP 6 digit ke alamat email yang terdaftar',
  security: [],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ForgotPasswordRequestSchema, 
        },
      },
    },
  },
  responses: {
    200: {
      description: 'OTP berhasil dikirim ulang (jika email terdaftar)',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema,
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
    429: {
      description: 'Too many requests - Tunggu sebelum resend',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema.extend({
            message: z.string().openapi({
              example: 'Please wait before requesting another OTP',
              description: 'Rate limiting message'
            }),
          }),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
  },
});

export const resetPasswordRoute = createRoute({
  method: 'post',
  path: '/reset-password',
  tags: ['Authentication'],
  summary: 'Reset password with OTP',
  description: 'Reset password menggunakan kode OTP yang valid. Setelah berhasil, semua session user akan di-invalidate.',
  security: [],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ResetPasswordRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Password berhasil direset. User harus login ulang.',
      content: {
        'application/json': {
          schema: ApiSuccessResponseSchema.extend({
            message: z.string().openapi({ example: 'Password has been reset successfully' }),
          }),
        },
      },
    },
    400: {
      description: 'Bad request - OTP tidak valid, expired, atau sudah digunakan',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema.extend({
            message: z.string().openapi({
              example: 'Invalid email or OTP',
              description: 'Possible messages: "Invalid email or OTP", "OTP has expired", "OTP has already been used", "Too many attempts. Please request a new OTP"'
            }),
          }),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema,
        },
      },
    },
  },
});
