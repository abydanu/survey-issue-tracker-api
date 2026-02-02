export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: 'ADMIN' | 'USER';
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserResponse {
  id: string;
  username: string;
  name: string;
  role: 'ADMIN' | 'USER';
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  username: string;
  password: string;
  name: string;
  role?: 'ADMIN' | 'USER';
}

export interface UpdateUserDto {
  username?: string;
  oldPassword?: string;
  newPassword?: string;
  name?: string;
  role?: 'ADMIN' | 'USER';
}
