import type { Context } from 'hono';
import { ChartService, DashboardService, StatsService } from '../application/dashboard.service.js';
import { AdminService } from '../application/admin.service.js';
import { SyncService } from '../application/sync.service.js';
import ApiResponseHelper from '../../../shared/utils/response.js';
import { serializeBigInt } from '../../../shared/utils/bigint.js';
import logger from '../../../infrastructure/logging/logger.js';
import type {
  CreateSurveyDto,
  UpdateSurveyDto,
  DashboardQuery,
} from '../domain/sync.entity.js';
import type { TokenPayload } from '../../auth/domain/auth.entity.js';

export class SyncController {
  constructor(
    private dashboardService: DashboardService,
    private adminService: AdminService,
    private syncService: SyncService,
    private chartService: ChartService,
    private statsService: StatsService
  ) {}

  getSurvey = async (c: Context) => {
    try {
      const pageParam = c.req.query('page');
      const limitParam = c.req.query('limit');
      const searchParam = c.req.query('search');
      const statusJtParam = c.req.query('statusJt');
      const rabHldMinParam = c.req.query('rabHldMin');
      const rabHldMaxParam = c.req.query('rabHldMax');
      const tahunParam = c.req.query('tahun');
      const datelParam = c.req.query('datel');
      const stoParam = c.req.query('sto');

      const query: DashboardQuery = {
        page: pageParam ? Number(pageParam) : undefined,
        limit: limitParam ? Number(limitParam) : undefined,
        search: searchParam,
        statusJt: statusJtParam,
        rabHldMin: rabHldMinParam ? Number(rabHldMinParam) : undefined,
        rabHldMax: rabHldMaxParam ? Number(rabHldMaxParam) : undefined,
        tahun: tahunParam,
        datel: datelParam,
        sto: stoParam,
      };

      const result = await this.dashboardService.getDashboardData(query);

      return c.json({
        success: true,
        message: 'Successfully fetched survey data',
        meta: result.meta,
        data: serializeBigInt(result.data),
      });
    } catch (error: any) {
      logger.error('Get survey error:', error);
      return ApiResponseHelper.error(c, error.message || 'Failed to fetch survey data');
    }
  };

  getStats = async (c: Context) => {
    try {
      const tahunParam = c.req.query('tahun');
      const bulanParam = c.req.query('bulan');
      const hariTerakhirParam = c.req.query('hariTerakhir');
      
      const filter = {
        tahun: tahunParam ? Number(tahunParam) : undefined,
        bulan: bulanParam ? Number(bulanParam) : undefined,
        hariTerakhir: hariTerakhirParam ? Number(hariTerakhirParam) : undefined,
      };
      
      const data = await this.statsService.getStats(filter);
      return ApiResponseHelper.success(c, data, 'Statistics data');
    } catch (error: any) {
      logger.error('Stats error:', error);
      return ApiResponseHelper.error(c, error.message || 'Failed to fetch stats data');
    }
  };

  getChartSurveyCount = async (c: Context) => {
    try {
      const tahunParam = c.req.query('tahun');
      const bulanParam = c.req.query('bulan');
      const hariTerakhirParam = c.req.query('hariTerakhir');
      
      const filter = {
        tahun: tahunParam ? Number(tahunParam) : undefined,
        bulan: bulanParam ? Number(bulanParam) : undefined,
        hariTerakhir: hariTerakhirParam ? Number(hariTerakhirParam) : undefined,
      };
      
      const data = await this.chartService.getSurveyCountByPeriod(filter);
      return ApiResponseHelper.success(c, data, 'Survey count by period');
    } catch (error: any) {
      logger.error('Chart survey count error:', error);
      return ApiResponseHelper.error(c, 'Failed to fetch chart data');
    }
  };
  
  getChartProfitLoss = async (c: Context) => {
    try {
      const tahunParam = c.req.query('tahun');
      const bulanParam = c.req.query('bulan');
      const hariTerakhirParam = c.req.query('hariTerakhir');
      
      const filter = {
        tahun: tahunParam ? Number(tahunParam) : undefined,
        bulan: bulanParam ? Number(bulanParam) : undefined,
        hariTerakhir: hariTerakhirParam ? Number(hariTerakhirParam) : undefined,
      };
      
      const data = await this.chartService.getProfitLossCount(filter);
      return ApiResponseHelper.success(c, data, 'Profit and loss count');
    } catch (error: any) {
      logger.error('Chart profit loss error:', error);
      return ApiResponseHelper.error(c, 'Failed to fetch chart data');
    }
  };
  
  getChartProfitLossByMonth = async (c: Context) => {
    try {
      const tahunParam = c.req.query('tahun');
      const bulanParam = c.req.query('bulan');
      const hariTerakhirParam = c.req.query('hariTerakhir');
      
      const filter = {
        tahun: tahunParam ? Number(tahunParam) : undefined,
        bulan: bulanParam ? Number(bulanParam) : undefined,
        hariTerakhir: hariTerakhirParam ? Number(hariTerakhirParam) : undefined,
      };
      
      const data = await this.chartService.getProfitLossByMonth(filter);
      return ApiResponseHelper.success(c, data, 'Profit and loss by month');
    } catch (error: any) {
      logger.error('Chart profit loss by month error:', error);
      return ApiResponseHelper.error(c, 'Failed to fetch chart data');
    }
  };

  getSyncStatus = async (c: Context) => {
    try {
      const result = await this.syncService.getSyncStatus();
      return ApiResponseHelper.success(
        c,
        {
          ...result,
          lastSync: result.lastSync
            ? {
                ...result.lastSync,
                syncedAt: result.lastSync.syncedAt.toISOString(),
              }
            : null,
        },
        'Successfully fetched sync status'
      );
    } catch (error: any) {
      logger.error('Get sync status error:', error);
      return ApiResponseHelper.error(c, error.message || 'Failed to fetch sync status');
    }
};

  syncFromSheets = async (c: Context) => {
    try {
      const result = await this.syncService.syncFromSheets();
      return ApiResponseHelper.success(c, result, result.message);
    } catch (error: any) {
      logger.error('Sync from sheets error:', error);
      return ApiResponseHelper.error(c, 'Failed to sync from Google Sheets');
    }
  };

  validateSyncData = async (c: Context) => {
    try {
      const result = await this.syncService.validateSyncData();
      return ApiResponseHelper.success(c, result, 'Successfully validated sync data');
    } catch (error: any) {
      logger.error('Validate sync data error:', error);
      return ApiResponseHelper.error(c, error.message || 'Failed to validate sync data');
    }
  };

  createSurvey = async (c: Context) => {
    try {
      const user = c.get('user') as TokenPayload | undefined;
      const username = user?.name || user?.username || 'User';
      const body = await c.req.json<CreateSurveyDto>();
      const created = await this.adminService.createSurvey(body);
      return ApiResponseHelper.success(
        c,
        serializeBigInt(created),
        `${username} successfully created survey`,
        201
      );
    } catch (error: any) {
      logger.error('Create survey error:', error);
      if (error.message?.includes('already exists') || error.message?.includes('sudah ada')) {
        return ApiResponseHelper.error(c, 'Survey with this data already exists', 400);
      }
      return ApiResponseHelper.error(c, 'Failed to create survey');
    }
  };

  updateSurvey = async (c: Context) => {
    try {
      const user = c.get('user') as TokenPayload | undefined;
      const username = user?.name || user?.username || 'User';
      const nomorNc = c.req.param('nomorNcx');
      const body = await c.req.json<UpdateSurveyDto>();
      const updated = await this.adminService.updateSurvey(nomorNc, body);
      const identifier = updated.nomorNcx || updated.idKendala || nomorNc;
      return ApiResponseHelper.success(
        c,
        serializeBigInt(updated),
        `${username} successfully updated ${identifier}`
      );
    } catch (error: any) {
      logger.error('Update survey error:', error);
      if (error.message?.includes('not found') || error.message?.includes('tidak ditemukan')) {
        return ApiResponseHelper.notFound(c, 'Survey not found');
      }
      return ApiResponseHelper.error(c, 'Failed to update survey');
    }
  };

  deleteSurvey = async (c: Context) => {
    try {
      const user = c.get('user') as TokenPayload | undefined;
      const username = user?.name || user?.username || 'User';
      const nomorNc = c.req.param('nomorNcx');
      const existing = await this.dashboardService.getDashboardDataByNomorNc(nomorNc);
      const identifier = existing.nomorNcx || existing.idKendala || nomorNc;
      await this.adminService.deleteSurvey(nomorNc);
      return ApiResponseHelper.success(c, null, `${username} successfully deleted ${identifier}`);
    } catch (error: any) {
      logger.error('Delete survey error:', error);
      if (error.message?.includes('not found') || error.message?.includes('tidak ditemukan')) {
        return ApiResponseHelper.notFound(c, 'Survey not found');
      }
      return ApiResponseHelper.error(c, 'Failed to delete survey');
    }
  };
}
