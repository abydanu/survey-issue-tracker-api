import type { Context } from 'hono';
import { EnumService } from '../application/enum.service.js';
import ApiResponseHelper from '../../../shared/utils/response.js';
import logger from '../../../infrastructure/logging/logger.js';
import { ErrorSanitizer } from '../../../shared/utils/error-sanitizer.js';

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
      return ApiResponseHelper.error(c, ErrorSanitizer.sanitize(error, 'Failed to fetch filter enums'));
    }
  };

  getAllEnums = async (c: Context) => {
    try {
      const enums = await this.enumService.getAllEnums();
      
      return ApiResponseHelper.success(
        c,
        enums,
        'Successfully fetched all enums with IDs'
      );
    } catch (error: any) {
      logger.error('Get all enums error:', error);
      return ApiResponseHelper.error(c, ErrorSanitizer.sanitize(error, 'Failed to fetch all enums'));
    }
  };


  autoUpdateDisplayNames = async (c: Context) => {
    try {
      logger.info('Auto-updating displayNames from Google Sheets...');
      
      const result = await this.enumService.autoUpdateDisplayNamesFromSheets();
      
      return ApiResponseHelper.success(
        c,
        result,
        result.message
      );
    } catch (error: any) {
      logger.error({ message: error.message, stack: error.stack }, 'Auto-update displayNames error');
      return ApiResponseHelper.error(c, ErrorSanitizer.sanitize(error, 'Failed to auto-update displayNames'));
    }
  };
}