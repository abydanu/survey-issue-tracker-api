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
      logger.info('Starting auto-batch sync from Google Sheets...');

      const startTime = Date.now();


      return this.syncAllBatchesWithProgress(c, startTime);
    } catch (error: any) {
      logger.error('Sync error:', error);
      return ApiResponseHelper.error(c, error.message || 'Sync failed - please try again');
    }
  };

  private syncAllBatchesWithProgress = async (c: Context, startTime: number) => {

    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    const syncService = this.syncService;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let isClosed = false;

        const sendEvent = (data: any): boolean => {
          if (isClosed) {
            return false;
          }
          
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            return true;
          } catch (err: any) {
            if (err.code === 'ERR_INVALID_STATE' || err.message?.includes('closed')) {
              isClosed = true;
              logger.warn('Stream closed by client');
            } else {
              logger.error({ err }, 'Failed to send event');
            }
            return false;
          }
        };

        const closeController = () => {
          if (!isClosed) {
            try {
              controller.close();
              isClosed = true;
            } catch (err) {
              // Ignore close errors
            }
          }
        };

        try {
          sendEvent({ 
            type: 'start', 
            message: '🔄 Memproses data dari Google Sheets...',
            timestamp: new Date().toISOString()
          });

          let batch = 0;
          const batchSize = 50;
          let completed = false;
          let lastPercentage = 0;

          const totalStats = {
            created: 0,
            updated: 0,
            skipped: 0,
            errors: 0
          };

          while (!completed && !isClosed) {
            try {
              const result = await syncService.syncBatch(batch, batchSize);

              totalStats.created += result.stats.created;
              totalStats.updated += result.stats.updated;
              totalStats.skipped += result.stats.skipped;
              totalStats.errors += result.stats.errors;

              const percentage = result.totalRecords > 0
                ? Math.round((result.totalProcessed / result.totalRecords) * 100)
                : 0;

              // Kirim progress update setiap kelipatan 25% atau batch terakhir
              const shouldSendProgress = 
                Math.floor(percentage / 25) > Math.floor(lastPercentage / 25) || 
                result.completed;

              if (shouldSendProgress) {
                const sent = sendEvent({
                  type: 'progress',
                  data: {
                    totalProcessed: result.totalProcessed,
                    totalRecords: result.totalRecords,
                    percentage,
                    totalStats
                  },
                  message: `⏳ Memproses... ${percentage}%`,
                  timestamp: new Date().toISOString()
                });
                
                if (!sent) break; // Client disconnected
                lastPercentage = percentage;
              }

              completed = result.completed;
              batch++;

              if (!completed && !isClosed) {
                await new Promise(resolve => setTimeout(resolve, 200));
              }
            } catch (batchError: any) {
              logger.error({ batchError, batch }, 'Error in batch');
              totalStats.errors++;
              
              // Lanjutkan ke batch berikutnya jika ada error
              batch++;
              
              // Jika error terlalu banyak, stop
              if (totalStats.errors > 5) {
                throw new Error(`Too many errors (${totalStats.errors}), stopping sync`);
              }
            }
          }

          if (isClosed) {
            logger.info('Sync interrupted: client disconnected');
            return;
          }

          const endTime = Date.now();
          const processingTime = `${((endTime - startTime) / 1000).toFixed(2)}s`;
          const dateTime = new Date().toLocaleString('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short',
          });

          sendEvent({
            type: 'complete',
            data: {
              totalStats,
              processingTime,
              syncedAt: dateTime
            },
            message: `✅ Sinkronisasi selesai! ${totalStats.created} data baru, ${totalStats.updated} diupdate`,
            timestamp: new Date().toISOString()
          });

          closeController();
        } catch (error: any) {
          logger.error({ error }, 'Sync stream error');
          
          if (!isClosed) {
            sendEvent({
              type: 'error',
              message: `❌ Sinkronisasi gagal: ${error.message || 'Terjadi kesalahan'}`,
              timestamp: new Date().toISOString()
            });
          }
          
          closeController();
        }
      }
    });

    return new Response(stream);
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
      logger.error('Sync enums from sheets error:', error);
      return ApiResponseHelper.error(c, error.message || 'Failed to sync enums from Google Sheets');
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
        `${username} successfully updated ${identifier}`
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
      
      // Return error message dari service untuk debugging
      return ApiResponseHelper.error(c, error.message || 'Failed to update survey');
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
        `${username} successfully updated tanggal input for ${idKendala}`
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