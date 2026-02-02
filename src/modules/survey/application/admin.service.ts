import type { ISyncRepository } from "../domain/sync.repository.js";
import { SyncService } from "./sync.service.js";
import type {
  CreateSurveyDto,
  UpdateSurveyDto,
  Survey,
  SurveySummarySheetRow,
} from "../domain/sync.entity.js";
import logger from "../../../infrastructure/logging/logger.js";

export class AdminService {
  private syncService: SyncService;

  constructor(private syncRepo: ISyncRepository) {
    this.syncService = new SyncService(syncRepo);
  }

  async createSurvey(data: CreateSurveyDto): Promise<Survey> {
    try {
      if (data.nomorNcx) {
        const existing = await this.syncRepo.findSurveyByNomorNc(data.nomorNcx);
        if (existing) {
          throw new Error(`Survey with nomor NCX/Starclick ${data.nomorNcx} already exists`);
        }
      }

      const existingByNo = await this.syncRepo.findSurveyByNo(data.no);
      if (existingByNo) {
        throw new Error(`Survey with no ${data.no} already exists`);
      }

      const created = await this.syncRepo.createSurvey(data);

      const summaryRow: SurveySummarySheetRow = {
        ...(created as any),
        no: created.no,
        nomorNcx: created.nomorNcx ?? created.idKendala ?? "",
      } as SurveySummarySheetRow;
      this.syncService
        .syncToSheets("create", "summary", summaryRow)
        .catch((error) => {
          logger.error(
            `Non-blocking sync to sheets failed for new survey ${created.no}:`,
            error
          );
        });

      logger.info(
        `Admin created survey: ${created.no} (nomorNcx: ${created.nomorNcx})`
      );
      return created;
    } catch (error: any) {
      logger.error("Error creating survey:", error);
      throw error;
    }
  }

  async updateSurvey(nomorNcx: string, data: UpdateSurveyDto): Promise<Survey> {
    try {
      const existing = await this.syncRepo.findSurveyByNomorNc(nomorNcx);
      if (!existing) {
        throw new Error(`Survey with nomor NCX/Starclick ${nomorNcx} not found`);
      }

      const updated = await this.syncRepo.updateSurvey(nomorNcx, data);

      this.syncService
        .syncToSheets("update", "summary", {
          ...data,
          no: existing.no,
          nomorNcx: data.nomorNcx ?? undefined,
        } as any)
        .catch((error) => {
          logger.error(
            `Non-blocking sync to sheets failed for survey ${nomorNcx}:`,
            error
          );
        });

      logger.info(
        `Admin updated survey: nomorNcx ${nomorNcx} (no: ${existing.no})`
      );
      return updated;
    } catch (error: any) {
      logger.error("Error updating survey:", error);
      throw error;
    }
  }

  async deleteSurvey(nomorNcx: string): Promise<void> {
    try {
      const existing = await this.syncRepo.findSurveyByNomorNc(nomorNcx);
      if (!existing) {
        throw new Error(`Survey with nomor NCX/Starclick ${nomorNcx} not found`);
      }

      const no = existing.no;

      await this.syncRepo.deleteSurvey(nomorNcx);

      this.syncService
        .syncToSheets("delete", "summary", { no } as any)
        .catch((error) => {
          logger.error(
            `Non-blocking sync to sheets failed for deleted survey ${nomorNcx}:`,
            error
          );
        });

      logger.info(`Admin deleted survey: nomorNcx ${nomorNcx} (no: ${no})`);
    } catch (error: any) {
      logger.error("Error deleting survey:", error);
      throw error;
    }
  }
}
