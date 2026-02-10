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
  ) { }

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
      
      const response = {
        lastSync: result.lastSync
          ? {
              status: result.lastSync.status,
              message: result.lastSync.message,
              syncedAt: result.lastSync.syncedAt.toISOString(),
      
              stats: this.parseStatsFromMessage(result.lastSync.message),
            }
          : null,
      };
      
      return ApiResponseHelper.success(
        c,
        response,
        'Successfully fetched sync status'
      );
    } catch (error: any) {
      logger.error('Get sync status error:', error);
      return ApiResponseHelper.error(c, error.message || 'Failed to fetch sync status');
    }
  };

  private parseStatsFromMessage(message: string | null): any {
    if (!message) return null;
    
    try {
      const createdMatch = message.match(/(\d+)\s+created/i);
      const updatedMatch = message.match(/(\d+)\s+updated/i);
      const skippedMatch = message.match(/(\d+)\s+skipped/i);
      
      if (createdMatch || updatedMatch) {
        return {
          created: createdMatch?.[1] ? parseInt(createdMatch[1]) : 0,
          updated: updatedMatch?.[1] ? parseInt(updatedMatch[1]) : 0,
          skipped: skippedMatch?.[1] ? parseInt(skippedMatch[1]) : 0,
        };
      }
    } catch (error) {
      logger.warn('Failed to parse stats from message');
    }
    
    return null;
  }

  syncFromSheets = async (c: Context) => {
    try {
      logger.info('Starting optimized sync from Google Sheets...');

      const startTime = Date.now();
      const backgroundParam = c.req.query('background');
      const skipEnumParam = c.req.query('skipEnum');
      const runInBackground = backgroundParam === 'true' || backgroundParam === '1';
      const skipEnumUpdate = skipEnumParam === 'true' || skipEnumParam === '1';

      // If background mode, return immediately and process async
      if (runInBackground) {
        // Start sync in background (non-blocking)
        this.syncService.autoSyncFromSheets(skipEnumUpdate)
          .then((result) => {
            const endTime = Date.now();
            const processingTime = `${((endTime - startTime) / 1000).toFixed(2)}s`;
            logger.info({
              syncStats: result.syncStats,
              processingTime,
              totalRecords: result.totalRecords,
              processedRecords: result.processedRecords
            }, 'Background sync completed successfully');
          })
          .catch((error) => {
            logger.error('Background sync error:', error);
          });

        return c.json({
          success: true,
          message: 'Sync started in background. Check /api/sync/status for progress.',
          data: {
            status: 'processing',
            startedAt: new Date().toISOString(),
            skipEnumUpdate
          }
        }, 202);
      }

      // Normal sync (blocking) - with timeout protection
      const SYNC_TIMEOUT = 55000; // 55 seconds for Vercel safety
      
      const syncPromise = this.syncService.autoSyncFromSheets(skipEnumUpdate);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Sync timeout - use ?background=true or ?skipEnum=true for faster sync')), SYNC_TIMEOUT);
      });

      const result = await Promise.race([syncPromise, timeoutPromise]) as any;
      
      const endTime = Date.now();
      const processingTime = `${((endTime - startTime) / 1000).toFixed(2)}s`;
      
      logger.info({
        syncStats: result.syncStats,
        processingTime,
        totalRecords: result.totalRecords,
        processedRecords: result.processedRecords,
        skipEnumUpdate
      }, 'Sync completed successfully');

      return ApiResponseHelper.success(
        c,
        {
          stats: result.syncStats,
          totalRecords: result.totalRecords,
          processedRecords: result.processedRecords,
          processingTime,
          syncedAt: new Date().toISOString(),
          skipEnumUpdate
        },
        result.message
      );
    } catch (error: any) {
      logger.error('Sync error:', error);
      
      if (error.message?.includes('timeout')) {
        return c.json({
          success: false,
          message: 'Sync timeout - try using ?skipEnum=true or ?background=true for faster sync',
          error: error.message
        }, 408);
      }
      
      return ApiResponseHelper.error(c, error.message || 'Sync failed - please try again');
    }
  };

  syncEnumsFromSheets = async (c: Context) => {
    try {
      const dryRunParam = c.req.query('dryRun');
      const dryRun =
        dryRunParam === undefined
          ? true
          : ['true', '1', 'yes'].includes(String(dryRunParam).toLowerCase());

      const result = await this.syncService.syncEnumsFromSheets({ dryRun });
      const message = result.message || (dryRun ? 'Enum sync dry run' : 'Enum sync completed');
      return ApiResponseHelper.success(c, result, message);
    } catch (error: any) {
      logger.error('Sync enums from sheets error:', error.message);
      return ApiResponseHelper.error(c, 'Failed to sync enums from Google Sheets');
    }
  };

  validateSyncData = async (c: Context) => {
    try {
      const result = await this.syncService.validateSyncData();
      return ApiResponseHelper.success(c, result, 'Successfully validated sync data');
    } catch (error: any) {
      logger.error('Validate sync data error:', error.message);
      return ApiResponseHelper.error(c, 'Failed to validate sync data');
    }
  };

  updateSurvey = async (c: Context) => {
    try {
      const user = c.get('user') as TokenPayload | undefined;
      const username = user?.name || user?.username || 'User';
      const nomorNc = c.req.param('nomorNcx');
      const body = await c.req.json<UpdateSurveyDto>();

      const TIMEOUT_MS = 8000;

      const updatePromise = this.adminService.updateSurvey(nomorNc, body);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Update timeout')), TIMEOUT_MS);
      });

      const updated = await Promise.race([updatePromise, timeoutPromise]) as any;

      const identifier = updated.nomorNcx || updated.idKendala || nomorNc;
      return ApiResponseHelper.success(
        c,
        serializeBigInt(updated),
        `successfully updated ${identifier}`
      );
    } catch (error: any) {
      logger.error({ 
        message: error.message, 
        stack: error.stack,
        nomorNc: c.req.param('nomorNcx')
      }, 'Update survey error');

      if (error.message?.includes('timeout')) {
        return c.json({
          success: true,
          message: 'Update processing - may take a moment to sync to sheets',
          data: { status: 'processing' }
        }, 202);
      }

      if (error.message?.includes('not found') || error.message?.includes('tidak ditemukan')) {
        return ApiResponseHelper.notFound(c, 'Survey not found');
      }

      logger.error(error.message, 'Fatal Error')
      
      return ApiResponseHelper.error(c, 'Failed to update survey');
    }
  };

  deleteSurvey = async (c: Context) => {
    try {
      const user = c.get('user') as TokenPayload | undefined;
      const username = user?.name || user?.username || 'User';
      const nomorNc = c.req.param('nomorNcx');


      const TIMEOUT_MS = 8000;

      const existingPromise = this.dashboardService.getDashboardDataByNomorNc(nomorNc);
      const existing = await Promise.race([
        existingPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), 3000))
      ]) as any;

      const identifier = existing.nomorNcx || existing.idKendala || nomorNc;

      const deletePromise = this.adminService.deleteSurvey(nomorNc);
      await Promise.race([
        deletePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Delete timeout')), TIMEOUT_MS))
      ]);

      return ApiResponseHelper.success(c, null, `successfully deleted ${identifier}`);
    } catch (error: any) {
      logger.error('Delete survey error:', error);

      if (error.message?.includes('timeout')) {
        return c.json({
          success: true,
          message: 'Delete processing - may take a moment to sync to sheets',
          data: { status: 'processing' }
        }, 202);
      }

      if (error.message?.includes('not found') || error.message?.includes('tidak ditemukan')) {
        return ApiResponseHelper.notFound(c, 'Survey not found');
      }
      return ApiResponseHelper.error(c, 'Failed to delete survey');
    }
  };

  updateTanggalInput = async (c: Context) => {
    try {
      const user = c.get('user') as TokenPayload | undefined;
      const username = user?.name || user?.username || 'User';
      const idKendala = c.req.param('idKendala');
      const body = await c.req.json<{ tanggalInput: string }>();

      await this.adminService.updateTanggalInput(idKendala, body.tanggalInput);

      return ApiResponseHelper.success(
        c,
        null,
        `Successfully updated tanggal input for ${idKendala}`
      );
    } catch (error: any) {
      logger.error('Update tanggal input error:', error);
      if (error.message?.includes('not found') || error.message?.includes('tidak ditemukan')) {
        return ApiResponseHelper.notFound(c, 'Master data not found');
      }
      if (error.message?.includes('Format tanggal')) {
        return ApiResponseHelper.error(c, error.message, 400);
      }
      return ApiResponseHelper.error(c, 'Failed to update tanggal input');
    }
  };
}