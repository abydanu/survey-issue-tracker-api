import type { Context } from "hono";
import { UserService } from "../application/user.service.js";
import ApiResponseHelper from "../../../shared/utils/response.js";
import logger from "../../../infrastructure/logging/logger.js";
import type { CreateUserDto, UpdateUserDto } from "../domain/user.entity.js";
import type { TokenPayload } from "../../../modules/auth/domain/auth.entity.js";

export class UserController {
  constructor(private userService: UserService) {}

  getAllUsers = async (c: Context) => {
    try {
      const pageParam = c.req.query("page");
      const limitParam = c.req.query("limit");
      const searchParam = c.req.query("search");

      const page = Number(pageParam);
      const limit = Number(limitParam);

      const query = {
        search: searchParam,
        page,
        limit,
      };

      const result = await this.userService.getUsers(query);

      return c.json({
        success: true,
        message: "Successfully fetched all users",
        meta: result.meta,
        data: result.data,
      });
    } catch (error: any) {
      logger.error("Get all users error:", error);
      return ApiResponseHelper.error(
        c,
        error.message || "Failed to fetch all users"
      );
    }
  };

  getUserById = async (c: Context) => {
    try {
      const id = c.req.param("id");
      const user = await this.userService.getUserById(id);
      return ApiResponseHelper.success(c, user, "Successfully fetched user ");
    } catch (error: any) {
      logger.error("Get user by id error:", error);
      if (error.message === "User tidak ditemukan") {
        return ApiResponseHelper.notFound(c, error.message);
      }
      return ApiResponseHelper.error(
        c,
        error.message || "Failed to fetch user details"
      );
    }
  };

  createUser = async (c: Context) => {
    try {
      const body = await c.req.json<CreateUserDto>();
      const user = await this.userService.createUser(body);
      return ApiResponseHelper.success(
        c,
        user,
        "User successfully created",
        201
      );
    } catch (error: any) {
      logger.error("Create user error:", error);
      if (error.message === "Username sudah digunakan") {
        return ApiResponseHelper.error(c, error.message, 400);
      }
      return ApiResponseHelper.error(
        c,
        error.message || "Failed to create user"
      );
    }
  };

  updateUser = async (c: Context) => {
    try {
      const currentUser = c.get("user") as TokenPayload;
      const id = c.req.param("id");
      const body = await c.req.json<UpdateUserDto>();

      const isPasswordChange = body.oldPassword && body.newPassword;
      const isSelfUpdate = currentUser.userId === id;

      const user = await this.userService.updateUser(id, body);

      if (isPasswordChange && isSelfUpdate) {
        return c.json({
          success: true,
          message: `Password updated successfully. Please login again.`,
          requireRelogin: true,
          data: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
          },
        });
      }

      return ApiResponseHelper.success(
        c,
        user,
        `User ${user.name} successfully updated`
      );
    } catch (error: any) {
      logger.error("Update user error:", error);

      if (error.message?.includes("not found")) {
        return ApiResponseHelper.notFound(c, "User not found");
      }
      if (
        error.message?.includes("already exists") ||
        error.message?.includes("already used")
      ) {
        return ApiResponseHelper.error(c, "Username already exists", 400);
      }
      if (
        error.message?.includes("incorrect") ||
        error.message?.includes("wrong password")
      ) {
        return ApiResponseHelper.error(c, "Old password is incorrect", 400);
      }

      return ApiResponseHelper.error(
        c,
        error.message || "Failed to update user"
      );
    }
  };

  deleteUser = async (c: Context) => {
    try {
      const id = c.req.param("id");
      const deletedUser = await this.userService.deleteUser(id);
      await this.userService.deleteUser(id);
      return ApiResponseHelper.success(
        c,
        null,
        `User ${deletedUser.name} successfully deleted`
      );
    } catch (error: any) {
      logger.error("Delete user error:", error);
      if (error.message?.includes("not found")) {
        return ApiResponseHelper.notFound(c, "User not found");
      }
      return ApiResponseHelper.error(
        c,
        error.message || "Failed to delete user"
      );
    }
  };
}
