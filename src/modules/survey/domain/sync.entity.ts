export interface Survey {
  id?: string;
  no: string;

  bln?: string | null;
  tglInput?: Date | null;
  idKendala?: string | null;
  jenisOrder?: string | null;
  datel?: string | null;
  sto?: string | null;
  namaPelanggan?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  jenisKendala?: string | null;
  pltTemuan?: string | null;
  rabHldSummary?: number | null;
  ihld?: number | null;
  statusUsulan?: string | null;
  statusIhld?: string | null;
  idEprop?: string | null;
  statusInstalasi?: string | null;
  keterangan?: string | null;
  newSc?: string | null;

  statusJt?: string | null;
  c2r?: number | null;
  nomorNcx?: string | null;
  alamat?: string | null;
  jenisLayanan?: string | null;
  nilaiKontrak?: bigint | null;
  ihldLop?: number | null;
  planTematik?: string | null;
  rabHldDetail?: bigint | null;
  rabSurvey?: bigint | null;
  noNde?: string | null;
  progresJt?: string | null;
  namaOdp?: string | null;
  jarakOdp?: number | null;
  keteranganText?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateSurveyDto extends Survey {}
export interface UpdateSurveyDto extends Partial<Survey> {}

export interface NdeUsulanB2BRow {
  no: string;
  nomorNcx: string;

  statusJt?: string | null;
  statusJtRaw?: string | null;
  c2r?: number | null;
  alamatInstalasi?: string | null;
  jenisLayanan?: string | null;
  nilaiKontrak?: bigint | null;
  rabSurvey?: bigint | null;
  nomorNde?: string | null;
  progressJt?: string | null;
  namaOdp?: string | null;
  jarakOdp?: number | null;
  keterangan?: string | null;

  datel?: string | null;
  sto?: string | null;
  namaPelanggan?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  ihldLopId?: number | null;
  planTematik?: string | null;
  rabHld?: bigint | null;
  statusUsulan?: string | null;
  statusInstalasi?: string | null;
  statusInstalasiRaw?: string | null;
}

export interface NewBgesB2BOloRow {
  idKendala: string;
  umur?: number | null;
  bln?: string | null;
  tglInputUsulan?: Date | null;
  jenisOrder?: string | null;

  datel?: string | null;
  sto?: string | null;
  namaPelanggan?: string | null;
  latitude?: string | null;
  longitude?: string | null;

  jenisKendala?: string | null;
  planTematik?: string | null;
  jenisKendalaRaw?: string | null;
  planTematikRaw?: string | null;

  rabHld?: bigint | null;
  ihldValue?: bigint | null;

  statusUsulan?: string | null;
  statusIhld?: string | null;
  idEprop?: string | null;
  statusInstalasi?: string | null;
  keterangan?: string | null;
  statusUsulanRaw?: string | null;
  statusInstalasiRaw?: string | null;
  keteranganRaw?: string | null;
  newSc?: string | null;

  namaOdp?: string | null;
  tglGolive?: Date | null;

  avai?: number | null;
  used?: number | null;
  isTotal?: number | null;
  occPercentage?: number | null;
}

export type SurveySummarySheetRow = NdeUsulanB2BRow;
export type SurveyDetailSheetRow = NewBgesB2BOloRow & {
  nomorNcx?: string | null;
};

export interface DashboardQuery {
  page?: number;
  limit?: number;
  search?: string;
  statusJt?: string | string[];
  rabHldMin?: number;
  rabHldMax?: number;
  tahun?: string;
  datel?: string;
  sto?: string;
}

export interface StatsData {
  totalSurvey: number;
  totalPending: number;
  totalGoLive: number;
  approvalRate: number; 
}

export interface ChartFilter {
  tahun?: number;
  bulan?: number;
  hariTerakhir?: number;
}

export interface SurveyCountByPeriod {
  periode: string;
  jumlah_survey: number;
}

export interface ProfitLossCount {
  untung: number;
  rugi: number;
}

export interface ProfitLossByMonth {
  bulan: string;
  untung: number;
  rugi: number;
}