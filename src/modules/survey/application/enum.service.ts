import type { EnumValues } from '../domain/enum.entity.js';
import { EnumValueService } from './enum-value.service.js';

export class EnumService {
  private enumValueService: EnumValueService;

  constructor() {
    this.enumValueService = new EnumValueService();
  }

  async getFilterEnums(): Promise<EnumValues> {
    try {
      const enums = await this.enumValueService.getAllEnums();
      
      return {
        jenisKendala: enums.JenisKendala.map(e => e.value),
        planTematik: enums.PlanTematik.map(e => e.value),
        statusUsulan: enums.StatusUsulan.map(e => e.value),
        statusInstalasi: enums.StatusInstalasi.map(e => e.value),
        keterangan: enums.Keterangan.map(e => e.value),
        statusJt: enums.StatusJt.map(e => e.value),
      };
    } catch (error) {
      console.error('Error fetching enums from EnumValueService:', error);
      return this.getHardcodedEnums();
    }
  }

  async getAllEnums() {
    return this.enumValueService.getAllEnums();
  }

  async autoUpdateDisplayNamesFromSheets() {
    return this.enumValueService.autoUpdateDisplayNamesFromSheets();
  }

  private getHardcodedEnums(): EnumValues {
    return {
      jenisKendala: [
        'ODP_FULL',
        'JARAK_PT1_250',
        'BLANK_FO',
        'JARAK_JAUH_500',
        'BLANK_TIANG',
        'NEED_MATAM_3PCS'
      ],
      planTematik: [
        'PT1',
        'PT2S',
        'PT2NS',
        'PT3',
        'PT4',
        'TKAP'
      ],
      statusUsulan: [
        'REVIEW_SDI',
        'BELUM_INPUT',
        'REVIEW_OPTIMA',
        'REVIEW_ED',
        'CEK_SDI_REGIONAL',
        'APPROVED',
        'DROP_LOP',
        'KONFIRMASI_ULANG',
        'NOT_APPROVED',
        'PENDING',
        'CANCEL',
        'OGP_IHLD',
        'WAITING_CARING'
      ],
      statusInstalasi: [
        'REVIEW',
        'SURVEY',
        'INSTALASI',
        'DONE_INSTALASI',
        'GOLIVE',
        'CANCEL',
        'PENDING',
        'KENDALA',
        'WAITING_BUDGET',
        'DROP',
        'WAITING_PROJECT_JPP',
        'WAITING_CB'
      ],
      keterangan: [
        'PELANGGAN_BATAL',
        'PT1_ONLY',
        'PERIJINAN',
        'AKI_TIDAK_LAYAK',
        'REDESIGN',
        'INDIKASI_RESELLER',
        'FEEDER_HABIS',
        'KENDALA_IZIN_TANAM_TN',
        'PORT_OLT_HABIS',
        'MATTAM_TIANG',
        'DISTRIBUSI_HABIS',
        'MENUNGGU_M_OLT',
        'MENUNGGU_RELOKASI_TIANG_PLN',
        'CORE_DISTRIBUSI_CACAT',
        'MENUNGGU_CO_FEEDER',
        'PORT_EA_HABIS',
        'INVALID_LOCATION',
        'HOLD_BY_BGES',
        'WAITING_REVIT_ODP',
        'HOLD_BY_PED'
      ],
      statusJt: [
        'AANWIJZING',
        'AKI_TIDAK_LAYAK',
        'APPROVE',
        'CANCEL_PELANGGAN',
        'DROP_BY_AM',
        'DROP_BY_WITEL',
        'GOLIVE',
        'INPUT_PAKET_LAIN',
        'LANJUT_BATCH_3',
        'LANJUT_BATCH_4',
        'NJKI_BELUM_LENGKAP',
        'NOT_APPROVE',
        'REVENUE_KURANG',
        'TUNGGU_JPP'
      ]
    };
  }
}