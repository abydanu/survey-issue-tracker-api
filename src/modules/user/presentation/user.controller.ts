import type { Context } from 'hono';
import { UserService } from '../application/user.service';
import ApiResponseHelper from '../../../shared/utils/response';
import logger from '../../../infrastructure/logging/logger';
import type { CreateUserDto, UpdateUserDto } from '../domain/user.entity';

export class UserController {
  constructor(private userService: UserService) {}

  getAllUsers = async (c: Context) => {
    try {
      const pageParam = c.req.query("page");
      const limitParam = c.req.query("limit");
      const searchParam = c.req.query("search");
      
      const page = Number(pageParam)
      const limit = Number(limitParam)
      
      const query = {
        search: searchParam,
        page,
        limit
      }

      const result = await this.userService.getUsers(query);
      
      return c.json({
        success: true,
        message: 'Daftar user berhasil diambil',
        meta: result.meta,
        data: result.data
      });
    } catch (error: any) {
      logger.error('Get all users error:', error);
      return ApiResponseHelper.error(c, error.message || 'Gagal mengambil daftar user');
    }
  };

  getUserById = async (c: Context) => {
    try {
      const id = c.req.param('id');
      const user = await this.userService.getUserById(id);
      return ApiResponseHelper.success(c, user, 'Detail user berhasil diambil');
    } catch (error: any) {
      logger.error('Get user by id error:', error);
      if (error.message === 'User tidak ditemukan') {
        return ApiResponseHelper.notFound(c, error.message);
      }
      return ApiResponseHelper.error(c, error.message || 'Gagal mengambil detail user');
    }
  };

  createUser = async (c: Context) => {
    try {
      const body = await c.req.json<CreateUserDto>();
      const user = await this.userService.createUser(body);
      return ApiResponseHelper.success(c, user, 'User berhasil dibuat', 201);
    } catch (error: any) {
      logger.error('Create user error:', error);
      if (error.message === 'Username sudah digunakan') {
        return ApiResponseHelper.error(c, error.message, 400);
      }
      return ApiResponseHelper.error(c, error.message || 'Gagal membuat user');
    }
  };

  updateUser = async (c: Context) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json<UpdateUserDto>();
      const user = await this.userService.updateUser(id, body);
      return ApiResponseHelper.success(c, user, 'User berhasil diupdate');
    } catch (error: any) {
      logger.error('Update user error:', error);
      if (error.message === 'User tidak ditemukan') {
        return ApiResponseHelper.notFound(c, error.message);
      }
      if (error.message === 'Username sudah digunakan') {
        return ApiResponseHelper.error(c, error.message, 400);
      }
      return ApiResponseHelper.error(c, error.message || 'Gagal mengupdate user');
    }
  };

  deleteUser = async (c: Context) => {
    try {
      const id = c.req.param('id');
      await this.userService.deleteUser(id);
      return ApiResponseHelper.success(c, null, 'User berhasil dihapus');
    } catch (error: any) {
      logger.error('Delete user error:', error);
      if (error.message === 'User tidak ditemukan') {
        return ApiResponseHelper.notFound(c, error.message);
      }
      return ApiResponseHelper.error(c, error.message || 'Gagal menghapus user');
    }
  };
}
