export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: 'ADMIN' | 'USER';
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

export interface CreateUserDto {
  username: string;
  password: string;
  name: string;
  role?: 'ADMIN' | 'USER';
}

export interface UpdateUserDto {
  username?: string;
  password?: string;
  name?: string;
  role?: 'ADMIN' | 'USER';
}
