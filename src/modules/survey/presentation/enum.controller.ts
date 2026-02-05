import type { Context } from 'hono';
import { EnumService } from '../application/enum.service.js';
import ApiResponseHelper from '../../../shared/utils/response.js';
import logger from '../../../infrastructure/logging/logger.js';

export class EnumController {
  constructor(private enumService: EnumService) {}

  getFilterEnums = async (c: Context) => {
    try {
      const enums = await this.enumService.getFilterEnums();
      
      return ApiResponseHelper.success(
        c,
        enums,
        'Successfully fetched filter enums'
      );
    } catch (error: any) {
      logger.error('Get filter enums error:', error);
      return ApiResponseHelper.error(c, error.message || 'Failed to fetch filter enums');
    }
  };
}