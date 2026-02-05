export interface User {
  id: string;
  username: string;
  email?: string | null;
  password: string;
  name: string;
  role: 'ADMIN' | 'USER';
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PasswordResetOtp {
  id: string;
  userId: string;
  otp: string;
  expiresAt: Date;
  used: boolean;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserResponse {
  id: string;
  username: string;
  email?: string | null;
  name: string;
  role: 'ADMIN' | 'USER';
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}

export interface AuthResponse {
  user: UserResponse;
  token: string;
}

export interface TokenPayload {
  userId: string;
  username: string;
  name?: string;
  email: string;
  role: 'ADMIN' | 'USER';
}
