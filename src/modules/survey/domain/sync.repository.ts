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

  syncFromSheets(summaryData: SurveySummarySheetRow[], detailData: SurveyDetailSheetRow[]): Promise<void>;
}
