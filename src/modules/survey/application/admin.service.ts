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


  async updateTanggalInput(idKendala: string, tanggalInput: string): Promise<void> {
    try {

      const parsedDate = new Date(tanggalInput);
      if (isNaN(parsedDate.getTime())) {
        throw new Error('Format tanggal tidak valid. Gunakan format mm/dd/yyyy');
      }

      await this.syncRepo.updateTanggalInput(idKendala, parsedDate);


      const fullData = await this.syncRepo.getMasterDataByIdKendala(idKendala);
      if (fullData) {

        this.syncService
          .syncToSheets("update", "detail", {
            ...fullData,
            tglInputUsulan: parsedDate,
          } as any)
          .catch((error) => {
            logger.error(
              `Non-blocking sync to sheets failed for tanggal input ${idKendala}:`,
              error
            );
          });
      }

      logger.info(`Admin updated tanggal input for ${idKendala}: ${tanggalInput} and synced to Google Sheets`);
    } catch (error: any) {
      logger.error("Error updating tanggal input:", error);
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
