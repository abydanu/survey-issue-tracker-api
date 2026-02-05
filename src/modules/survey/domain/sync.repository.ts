import type {
  Survey,
  CreateSurveyDto,
  UpdateSurveyDto,
  SurveySummarySheetRow,
  SurveyDetailSheetRow,
  DashboardQuery,
} from './sync.entity.js';

export interface ISyncRepository {
  findAllSurvey(query: DashboardQuery): Promise<{ data: Survey[]; total: number }>;
  findSurveyByNo(no: string): Promise<Survey | null>;
  findSurveyByNomorNc(nomorNcx: string): Promise<Survey | null>;
  createSurvey(data: CreateSurveyDto): Promise<Survey>;
  updateSurvey(nomorNcx: string, data: UpdateSurveyDto): Promise<Survey>;
  deleteSurvey(nomorNcx: string): Promise<void>;

  
  updateTanggalInput(idKendala: string, tanggalInput: Date): Promise<void>;
  
  
  getMasterDataByIdKendala(idKendala: string): Promise<any | null>;

  syncFromSheets(summaryData: SurveySummarySheetRow[], detailData: SurveyDetailSheetRow[]): Promise<void>;
  
  syncFromSheetsWithBatch(
    summaryData: SurveySummarySheetRow[], 
    detailData: SurveyDetailSheetRow[]
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  }>;

  autoSyncFromSheets(
    summaryData: SurveySummarySheetRow[], 
    detailData: SurveyDetailSheetRow[]
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    errors: number;
    batchesProcessed: number;
  }>;
}
