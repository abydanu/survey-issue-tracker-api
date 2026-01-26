export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: 'ADMIN' | 'USER';
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

export interface UserResponse {
  id: string;
  username: string;
  name: string;
  role: 'ADMIN' | 'USER';
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: UserResponse;
  token: string;
}

export interface TokenPayload {
  userId: string;
  username: string;
  role: 'ADMIN' | 'USER';
}
