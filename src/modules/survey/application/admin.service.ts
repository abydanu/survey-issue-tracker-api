import type { ISyncRepository } from "../domain/sync.repository.js";
import { SyncService } from "./sync.service.js";
import { EnumValueService } from "./enum-value.service.js";
import type {
  CreateSurveyDto,
  UpdateSurveyDto,
  Survey,
  SurveySummarySheetRow,
} from "../domain/sync.entity.js";
import logger from "../../../infrastructure/logging/logger.js";

export class AdminService {
  updateTanggalInput(idKendala: string, tanggalInput: string) {
    throw new Error('Method not implemented.');
  }
  private syncService: SyncService;
  private enumValueService: EnumValueService;
  private skipSheetSync: boolean = false;

  constructor(private syncRepo: ISyncRepository, options?: { skipSheetSync?: boolean }) {
    this.syncService = new SyncService(syncRepo);
    this.enumValueService = new EnumValueService();
    this.skipSheetSync = options?.skipSheetSync || false;
  }

  setSkipSheetSync(skip: boolean) {
    this.skipSheetSync = skip;
  }

  async updateSurvey(nomorNcx: string, data: UpdateSurveyDto): Promise<Survey> {
    try {
      logger.info(`Updating survey with nomorNcx: ${nomorNcx}`);
      logger.info(`Update data: ${JSON.stringify(data)}`);


      if (data.statusJt !== undefined && data.statusJt !== null) {
        const isValid = await this.enumValueService.validateEnumValue('StatusJt', data.statusJt);
        if (!isValid) {
          const validValues = await this.enumValueService.getValidValues('StatusJt');
          throw new Error(
            `Invalid value for StatusJt: "${data.statusJt}". ` +
            `Valid values are: ${validValues.join(', ')}`
          );
        }
      }

      if (data.statusUsulan !== undefined && data.statusUsulan !== null) {
        const isValid = await this.enumValueService.validateEnumValue('StatusUsulan', data.statusUsulan);
        if (!isValid) {
          const validValues = await this.enumValueService.getValidValues('StatusUsulan');
          throw new Error(
            `Invalid value for StatusUsulan: "${data.statusUsulan}". ` +
            `Valid values are: ${validValues.join(', ')}`
          );
        }
      }

      if (data.statusInstalasi !== undefined && data.statusInstalasi !== null) {
        const isValid = await this.enumValueService.validateEnumValue('StatusInstalasi', data.statusInstalasi);
        if (!isValid) {
          const validValues = await this.enumValueService.getValidValues('StatusInstalasi');
          throw new Error(
            `Invalid value for StatusInstalasi: "${data.statusInstalasi}". ` +
            `Valid values are: ${validValues.join(', ')}`
          );
        }
      }

      if (data.jenisKendala !== undefined && data.jenisKendala !== null) {
        const isValid = await this.enumValueService.validateEnumValue('JenisKendala', data.jenisKendala);
        if (!isValid) {
          const validValues = await this.enumValueService.getValidValues('JenisKendala');
          throw new Error(
            `Invalid value for JenisKendala: "${data.jenisKendala}". ` +
            `Valid values are: ${validValues.join(', ')}`
          );
        }
      }

      if (data.pltTemuan !== undefined && data.pltTemuan !== null) {
        const isValid = await this.enumValueService.validateEnumValue('PlanTematik', data.pltTemuan);
        if (!isValid) {
          const validValues = await this.enumValueService.getValidValues('PlanTematik');
          throw new Error(
            `Invalid value for PlanTematik: "${data.pltTemuan}". ` +
            `Valid values are: ${validValues.join(', ')}`
          );
        }
      }

      if (data.keterangan !== undefined && data.keterangan !== null) {
        const isValid = await this.enumValueService.validateEnumValue('Keterangan', data.keterangan);
        if (!isValid) {
          const validValues = await this.enumValueService.getValidValues('Keterangan');
          throw new Error(
            `Invalid value for Keterangan: "${data.keterangan}". ` +
            `Valid values are: ${validValues.join(', ')}`
          );
        }
      }

      const existing = await this.syncRepo.findSurveyByNomorNc(nomorNcx);
      if (!existing) {
        logger.warn(`Survey not found for nomorNcx: ${nomorNcx}`);
        throw new Error(`Survey with nomor NCX/Starclick ${nomorNcx} not found`);
      }

      logger.info(`Found existing survey - id: ${existing.id}, no: ${existing.no}, nomorNcx: ${existing.nomorNcx}`);


      if (data.tglInput !== undefined && data.tglInput !== null && existing.idKendala) {
        const parsedDate = data.tglInput instanceof Date ? data.tglInput : new Date(data.tglInput);
        if (!isNaN(parsedDate.getTime())) {
          logger.info(`Updating tglInput for idKendala: ${existing.idKendala}`);
          await this.syncRepo.updateTanggalInput(existing.idKendala, parsedDate);
        }
      }

      logger.info(`Calling repository updateSurvey...`);
      const updated = await this.syncRepo.updateSurvey(nomorNcx, data);
      logger.info(`Survey updated successfully`);


      if (!this.skipSheetSync) {
        this.syncService
          .syncToSheets("update", "summary", {
            ...data,
            no: existing.no,
            nomorNcx: updated.nomorNcx,
            namaPelanggan: existing.namaPelanggan,
          } as any)
          .catch((error) => {
            logger.error({
              message: error.message,
              stack: error.stack,
              nomorNcx
            }, `Non-blocking sync to sheets failed for survey ${nomorNcx}`);
          });


        const shouldSyncMasterData =
          data.statusUsulan !== undefined ||
          data.statusInstalasi !== undefined ||
          data.tglInput !== undefined;

        if (shouldSyncMasterData && existing.idKendala) {
          logger.info({
            idKendala: existing.idKendala,
            statusUsulan: data.statusUsulan,
            statusInstalasi: data.statusInstalasi,
            tglInput: data.tglInput
          }, 'Syncing master data to sheets');

          const fullData = await this.syncRepo.getMasterDataByIdKendala(existing.idKendala);
          if (fullData) {
            logger.info({
              idKendala: fullData.idKendala,
              statusUsulan: fullData.statusUsulan,
              statusInstalasi: fullData.statusInstalasi
            }, 'Master data fetched, syncing to sheet');

            this.syncService
              .syncToSheets("update", "detail", fullData as any)
              .catch((error) => {
                logger.error({
                  message: error.message,
                  stack: error.stack,
                  idKendala: existing.idKendala
                }, `Non-blocking sync master data to sheets failed for ${existing.idKendala}`);
              });
          } else {
            logger.warn({ idKendala: existing.idKendala }, 'Master data not found');
          }
        }
      } else {
        logger.info(`Sheet sync skipped (Vercel timeout protection enabled)`);
      }

      logger.info(
        `Admin updated survey: nomorNcx ${nomorNcx} (no: ${existing.no})`
      );
      return updated;
    } catch (error: any) {
      logger.error({
        message: error.message,
        stack: error.stack,
        nomorNcx
      }, 'Error updating survey');
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
      const idKendala = existing.idKendala;
      const namaPelanggan = existing.namaPelanggan;

      await this.syncRepo.deleteSurvey(nomorNcx);


      if (!this.skipSheetSync) {

        this.syncService
          .syncToSheets("delete", "summary", { no, nomorNcx, namaPelanggan } as any)
          .catch((error) => {
            logger.error({
              message: error.message,
              stack: error.stack,
              nomorNcx,
              no
            }, `Non-blocking sync to sheets failed for deleted survey ${nomorNcx}`);
          });


        if (idKendala) {
          this.syncService
            .syncToSheets("delete", "detail", { idKendala } as any)
            .catch((error) => {
              logger.error({
                message: error.message,
                stack: error.stack,
                idKendala
              }, `Non-blocking sync to sheets failed for deleted master data ${idKendala}`);
            });
        }
      } else {
        logger.info(`Sheet sync skipped (Vercel timeout protection enabled)`);
      }

      logger.info(`Admin deleted survey: nomorNcx ${nomorNcx} (no: ${no}, idKendala: ${idKendala})`);
    } catch (error: any) {
      logger.error({
        message: error.message,
        stack: error.stack,
        nomorNcx
      }, 'Error deleting survey');
      throw error;
    }
  }
}
