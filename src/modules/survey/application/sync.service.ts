import type { ISyncRepository } from "../domain/sync.repository.js";
import { GoogleSheetsService } from "../infrastructure/google-sheets.service.js";
import prisma from "../../../infrastructure/database/prisma.js";
import logger from "../../../infrastructure/logging/logger.js";
import type {
  SurveySummarySheetRow,
  SurveyDetailSheetRow,
} from "../domain/sync.entity.js";
import { SyncValidationHelper } from "../../../shared/utils/sync-validation.js";
import { EnumValueService } from "./enum-value.service.js";

export class SyncService {
  private _googleSheets: GoogleSheetsService | null = null;
  private _enumValueService: EnumValueService | null = null;

  constructor(private syncRepo: ISyncRepository) { }

  private getGoogleSheets(): GoogleSheetsService {
    if (!this._googleSheets) {
      this._googleSheets = new GoogleSheetsService();
    }
    return this._googleSheets;
  }

  private getEnumValueService(): EnumValueService {
    if (!this._enumValueService) {
      this._enumValueService = new EnumValueService(this.getGoogleSheets());
    }
    return this._enumValueService;
  }

  async syncFromSheets(): Promise<{ success: boolean; message: string }> {
    try {
      logger.info("Starting sync from Google Sheets...");

      // Step 1: Auto-update displayNames from sheets first
      logger.info("Auto-updating enum displayNames from Google Sheets...");
      try {
        await this.getEnumValueService().autoUpdateDisplayNamesFromSheets();
        logger.info("Enum displayNames updated successfully");
      } catch (enumError: any) {
        logger.warn({ message: enumError.message }, "Failed to auto-update enum displayNames, continuing with sync...");
      }

      // Step 2: Proceed with normal sync
      const summaryData = await this.getGoogleSheets().readSummaryData();
      const detailData = await this.getGoogleSheets().readDetailData();

      logger.info(
        `Fetched ${summaryData.length} summary records and ${detailData.length} detail records from Google Sheets`
      );

      if (detailData.length === 0) {
        throw new Error(
          "No master data (detail/Sheet 2) found. Master data must be synced first."
        );
      }

      const validationResult = await SyncValidationHelper.validateSyncData(
        summaryData,
        detailData
      );

      if (!validationResult.isValid) {
        const report =
          SyncValidationHelper.generateValidationReport(validationResult);
        logger.error(report as any, "Sync validation failed:");

        logger.warn(
          "Proceeding with sync despite validation issues. Invalid records will be skipped."
        );
      }

      await this.syncRepo.syncFromSheets(summaryData, detailData);

      const successMessage = validationResult.isValid
        ? `Berhasil sinkronisasi ${summaryData.length} summary dan ${detailData.length} detail dari Google Sheets`
        : `Berhasil sinkronisasi ${validationResult.summary.validSummaryRecords}/${summaryData.length} summary dan ${detailData.length} detail dari Google Sheets (${validationResult.summary.invalidSummaryRecords} records skipped)`;

      await prisma.syncLog.create({
        data: {
          status: "SUCCESS",
          message: successMessage,
          sheetName: "Summary, Detail",
        },
      });

      const dateTime = new Date().toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })

      logger.info(successMessage as any, "Sync from Google Sheets completed successfully");
      return {
        success: true,
        message: `Berhasil sinkronisasi data, ${dateTime}`,
      };
    } catch (error: any) {
      logger.error("Error syncing from Google Sheets:", error);

      if (
        error.message &&
        error.message.includes("Foreign key constraint violated")
      ) {
        logger.error(
          "Foreign key constraint violation detected. This usually means master data (Sheet 2) is missing for some records in Sheet 1."
        );
        logger.error(
          "Make sure all nomorNcx values in Sheet 1 have corresponding idKendala values in Sheet 2."
        );

        try {
          const integrityCheck =
            await SyncValidationHelper.checkDatabaseIntegrity();
          if (integrityCheck.orphanedRecords.length > 0) {
            logger.error(
              `Found ${integrityCheck.orphanedRecords.length} orphaned records in database`
            );
          }
        } catch (integrityError) {
          logger.error(
            "Failed to run database integrity check:",
            integrityError as any
          );
        }
      }

      await prisma.syncLog.create({
        data: {
          status: "FAILED",
          message: error.message || "Gagal sinkronisasi dari Google Sheets",
          sheetName: "Summary, Detail",
        },
      });

      throw new Error(
        `Gagal sinkronisasi dari Google Sheets: ${error.message}`
      );
    }
  }

  async syncBatch(batchNumber: number, batchSize: number): Promise<{
    processedInBatch: number;
    totalProcessed: number;
    totalRecords: number;
    remaining: number;
    completed: boolean;
    stats: {
      created: number;
      updated: number;
      skipped: number;
      errors: number;
    };
  }> {
    try {
      logger.info(`Starting batch ${batchNumber} with size ${batchSize}...`);

      // Fetch all data once (cached in memory for this request)
      const summaryData = await this.getGoogleSheets().readSummaryData();
      const detailData = await this.getGoogleSheets().readDetailData();

      const totalRecords = summaryData.length + detailData.length;
      
      // Calculate batch range
      const startIndex = batchNumber * batchSize;
      const endIndex = Math.min(startIndex + batchSize, totalRecords);
      
      // Check if completed before processing
      if (startIndex >= totalRecords) {
        logger.info(`Batch ${batchNumber} skipped: already completed`);
        return {
          processedInBatch: 0,
          totalProcessed: totalRecords,
          totalRecords,
          remaining: 0,
          completed: true,
          stats: { created: 0, updated: 0, skipped: 0, errors: 0 }
        };
      }

      // Split data into detail and summary for this batch
      let detailBatch: any[] = [];
      let summaryBatch: any[] = [];

      // Process detail first, then summary
      if (startIndex < detailData.length) {
        const detailEnd = Math.min(endIndex, detailData.length);
        detailBatch = detailData.slice(startIndex, detailEnd);
      }

      if (endIndex > detailData.length) {
        const summaryStart = Math.max(0, startIndex - detailData.length);
        const summaryEnd = endIndex - detailData.length;
        summaryBatch = summaryData.slice(summaryStart, summaryEnd);
      }

      logger.info(`Processing batch ${batchNumber}: ${detailBatch.length} detail + ${summaryBatch.length} summary records`);

      // Process batch
      const stats = await this.syncRepo.autoSyncFromSheets(summaryBatch, detailBatch);

      const processedInBatch = detailBatch.length + summaryBatch.length;
      const totalProcessed = endIndex;
      const remaining = Math.max(0, totalRecords - totalProcessed);
      const completed = remaining === 0;

      logger.info(`Batch ${batchNumber} completed: ${processedInBatch} processed, ${remaining} remaining`);

      return {
        processedInBatch,
        totalProcessed,
        totalRecords,
        remaining,
        completed,
        stats
      };
    } catch (error: any) {
      logger.error(`Error in batch ${batchNumber}:`, error);
      throw new Error(`Batch sync failed: ${error.message}`);
    }
  }

  async autoSyncFromSheets(): Promise<{
    success: boolean;
    message: string;
    totalRecords: number;
    processedRecords: number;
    syncStats: {
      created: number;
      updated: number;
      deleted: number;
      skipped: number;
      errors: number;
    };
    batchesProcessed: number;
  }> {
    try {
      logger.info("Starting incremental sync from Google Sheets...");

      logger.info("Fetching data from Google Sheets...");
      const summaryData = await this.getGoogleSheets().readSummaryData();
      const detailData = await this.getGoogleSheets().readDetailData();

      logger.info(`Fetched ${summaryData.length} summary + ${detailData.length} detail records`);

      const totalRecords = summaryData.length + detailData.length;

      // Use incremental sync (only new/updated/deleted)
      const { incrementalSyncFromSheets } = await import('../infrastructure/sync-incremental.js');
      
      const syncStats = await incrementalSyncFromSheets(
        prisma,
        this.getEnumValueService(),
        summaryData,
        detailData
      );

      // Fix null dates by matching customer names
      const { fixNullDatesFromDetailSheet } = await import('../infrastructure/sync-fix-dates.js');
      const fixResult = await fixNullDatesFromDetailSheet(prisma, detailData);
      
      if (fixResult.fixed > 0) {
        logger.info(`Fixed ${fixResult.fixed} records with null tanggal by matching customer names`);
      }

      // Auto-create missing summaries for master data
      const { createMissingSummaries } = await import('../infrastructure/sync-create-missing-summaries.js');
      const summaryResult = await createMissingSummaries(prisma);
      
      if (summaryResult.created > 0) {
        logger.info(`Created ${summaryResult.created} missing summaries for master data`);
      }

      const successMessage = `Sync completed! ${syncStats.created} created, ${syncStats.updated} updated, ${syncStats.deleted} deleted${fixResult.fixed > 0 ? `, ${fixResult.fixed} dates fixed` : ''}${summaryResult.created > 0 ? `, ${summaryResult.created} summaries created` : ''}`;

      logger.info(successMessage);

      const dateTime = new Date().toLocaleString('id-ID', {
        dateStyle: 'short',
        timeStyle: 'short',
      });

      return {
        success: true,
        message: `Sync completed! - ${dateTime}`,
        totalRecords,
        processedRecords: syncStats.created + syncStats.updated + syncStats.deleted,
        syncStats,
        batchesProcessed: 0,
      };
    } catch (error: any) {
      logger.error("Error in incremental sync:", error);
      throw new Error(`Sync failed: ${error.message}`);
    }
  }

  async syncEnumsFromSheets(options: { dryRun?: boolean } = {}) {
    const { dryRun = true } = options;
    logger.info(
      { dryRun },
      "Starting enum sync from Google Sheets dropdown values"
    );
    return this.getEnumValueService().syncEnumsFromSheets();
  }

  async syncToSheets(
    operation: "create" | "update" | "delete",
    type: "summary" | "detail",
    data: Partial<SurveySummarySheetRow> | Partial<SurveyDetailSheetRow>
  ): Promise<void> {
    try {
      logger.info(
        `Syncing ${operation} operation for ${type} to Google Sheets...`
      );

      const normalizeSummary = (input: any): Partial<SurveySummarySheetRow> => {
        const out: any = { ...input };

        if (out.alamatInstalasi === undefined && out.alamat !== undefined)
          out.alamatInstalasi = out.alamat;
        if (out.nomorNde === undefined && out.noNde !== undefined)
          out.nomorNde = out.noNde;
        if (out.progressJt === undefined && out.progresJt !== undefined)
          out.progressJt = out.progresJt;
        if (out.keterangan === undefined && out.keteranganText !== undefined)
          out.keterangan = out.keteranganText;
        return out;
      };

      if (operation === "delete") {
        if (type === "summary") {
          const summaryData = data as SurveySummarySheetRow & { nomorNcx?: string };
          await this.getGoogleSheets().deleteSummaryRow(
            summaryData.no,
            summaryData.nomorNcx
          );
        } else {
          const detailData = data as SurveyDetailSheetRow & {
            idKendala?: string;
            nomorNcx?: string;
          };
          const idKendala = detailData.idKendala ?? detailData.nomorNcx;
          if (!idKendala) {
            throw new Error(
              'Field "idKendala" atau "nomorNcx" diperlukan untuk delete detail row'
            );
          }
          await this.getGoogleSheets().deleteDetailRow(idKendala);
        }
      } else if (operation === "create") {
        if (type === "summary") {
          await this.getGoogleSheets().appendSummaryRow(
            normalizeSummary(data) as SurveySummarySheetRow
          );
        } else {
          await this.getGoogleSheets().appendDetailRow(data as SurveyDetailSheetRow);
        }
      } else if (operation === "update") {
        if (type === "summary") {
          await this.getGoogleSheets().updateSummaryRow(
            normalizeSummary(data) as Partial<SurveySummarySheetRow>
          );
        } else {
          const detailData = data as Partial<SurveyDetailSheetRow> & {
            idKendala?: string;
            nomorNcx?: string;
          };
          const idKendala = detailData.idKendala ?? detailData.nomorNcx;
          if (!idKendala) {
            throw new Error(
              'Field "idKendala" atau "nomorNcx" diperlukan untuk update detail row'
            );
          }
          await this.getGoogleSheets().updateDetailRow({ ...detailData, idKendala });
        }
      }

      logger.info(
        `Successfully synced ${operation} operation for ${type} to Google Sheets`
      );
    } catch (error: any) {
      logger.error({
        message: error.message,
        stack: error.stack,
        operation,
        type
      }, `Error syncing ${operation} operation to Google Sheets`);
      throw error;
    }
  }

  async getSyncStatus(): Promise<{
    lastSync: {
      id: string;
      status: string;
      message: string | null;
      sheetName: string | null;
      syncedAt: Date;
    } | null;
  }> {
    const lastSync = await prisma.syncLog.findFirst({
      orderBy: {
        syncedAt: "desc",
      },
      select: {
        id: true,
        status: true,
        message: true,
        sheetName: true,
        syncedAt: true,
      },
    });

    return {
      lastSync: lastSync
        ? {
          id: lastSync.id,
          status: lastSync.status,
          message: lastSync.message,
          sheetName: lastSync.sheetName,
          syncedAt: lastSync.syncedAt,
        }
        : null,
    };
  }

  async validateSyncData(): Promise<{
    validation: any;
    integrityCheck: any;
    detailedReport: string;
    sampleData: any;
  }> {
    try {
      logger.info("Starting sync data validation...");

      const summaryData = await this.getGoogleSheets().readSummaryData();
      const detailData = await this.getGoogleSheets().readDetailData();

      const validationResult = await SyncValidationHelper.validateSyncData(
        summaryData,
        detailData
      );

      const integrityCheck =
        await SyncValidationHelper.checkDatabaseIntegrity();

      const detailedReport =
        SyncValidationHelper.generateValidationReport(validationResult);

      const sampleData = {
        summaryFields:
          summaryData.length > 0 && summaryData[0]
            ? Object.keys(summaryData[0])
            : [],
        detailFields:
          detailData.length > 0 && detailData[0]
            ? Object.keys(detailData[0])
            : [],
        firstSummaryRecord: summaryData.length > 0 ? summaryData[0] : null,
        firstDetailRecord: detailData.length > 0 ? detailData[0] : null,
      };

      logger.info("Sync data validation completed");

      return {
        validation: validationResult,
        integrityCheck,
        detailedReport,
        sampleData,
      };
    } catch (error: any) {
      logger.error("Error validating sync data:", error);
      throw new Error(`Gagal melakukan validasi data sync: ${error.message}`);
    }
  }
}
