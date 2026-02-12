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

      
      logger.info("Auto-updating enum displayNames from Google Sheets...");
      try {
        await this.getEnumValueService().autoUpdateDisplayNamesFromSheets();
        logger.info("Enum displayNames updated successfully");
      } catch (enumError: any) {
        logger.warn({ message: enumError.message }, "Failed to auto-update enum displayNames, continuing with sync...");
      }

      
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

  async autoSyncFromSheets(skipEnumUpdate: boolean = false): Promise<{
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

      
      if (!skipEnumUpdate) {
        logger.info("Syncing enums from Google Sheets...");
        try {
          
          const enumSyncResult = await this.getEnumValueService().syncEnumsFromSheets();
          logger.info(`Enum sync completed: ${enumSyncResult.newEnums.length} new enums added, ${enumSyncResult.deactivatedEnums.length} deactivated`);
          
          
          await this.getEnumValueService().autoUpdateDisplayNamesFromSheets();
          logger.info("Enum displayNames updated successfully");
        } catch (enumError: any) {
          logger.warn({ message: enumError.message }, "Failed to sync enums, continuing with sync...");
        }
      } else {
        logger.info("Skipping enum sync (skipEnumUpdate=true)");
      }

      
      logger.info("Fetching data from Google Sheets...");
      const summaryData = await this.getGoogleSheets().readSummaryData();
      const detailData = await this.getGoogleSheets().readDetailData();

      logger.info(`Fetched ${summaryData.length} summary + ${detailData.length} detail records`);

      const totalRecords = summaryData.length + detailData.length;

      
      const { incrementalSyncFromSheets } = await import('../infrastructure/sync-incremental.js');
      
      const syncStats = await incrementalSyncFromSheets(
        prisma,
        this.getEnumValueService(),
        summaryData,
        detailData
      );

      
      const { fixNullDatesFromDetailSheet } = await import('../infrastructure/sync-fix-dates.js');
      const fixResult = await fixNullDatesFromDetailSheet(prisma, detailData);
      
      if (fixResult.fixed > 0) {
        logger.info(`Fixed ${fixResult.fixed} records with null tanggal by matching customer names`);
      }

      

      const successMessage = `Sync completed! ${syncStats.created} created, ${syncStats.updated} updated, ${syncStats.deleted} deleted${fixResult.fixed > 0 ? `, ${fixResult.fixed} dates fixed` : ''}`;

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
          const summaryData = data as SurveySummarySheetRow & { nomorNcx?: string; namaPelanggan?: string };
          await this.getGoogleSheets().deleteSummaryRow(
            summaryData.no,
            summaryData.nomorNcx,
            summaryData.namaPelanggan
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
