import type { EnumValues } from '../domain/enum.entity.js';
import { SyncPrismaRepository } from '../infrastructure/sync.prisma.repository.js';

export class EnumService {
  constructor(private syncRepo?: SyncPrismaRepository) { }

  async getFilterEnums(): Promise<EnumValues> {
    if (this.syncRepo) {

      return await this.getEnumsFromDatabase();
    }


    return this.getHardcodedEnums();
  }

  private async getEnumsFromDatabase(): Promise<EnumValues> {
    try {

      if (!this.syncRepo || !this.syncRepo.prisma) {
        console.warn('SyncRepo or Prisma not available, falling back to hardcoded enums');
        return this.getHardcodedEnums();
      }


      const [
        jenisKendalaResults,
        planTematikResults,
        statusUsulanResults,
        statusInstalasiResults,
        keteranganResults,
        statusJtResults
      ] = await Promise.all([
        this.syncRepo.prisma.newBgesB2BOlo.findMany({
          select: { jenisKendala: true },
          where: { jenisKendala: { not: null } },
          distinct: ['jenisKendala']
        }),
        this.syncRepo.prisma.newBgesB2BOlo.findMany({
          select: { planTematik: true },
          where: { planTematik: { not: null } },
          distinct: ['planTematik']
        }),
        this.syncRepo.prisma.newBgesB2BOlo.findMany({
          select: { statusUsulan: true },
          where: { statusUsulan: { not: null } },
          distinct: ['statusUsulan']
        }),
        this.syncRepo.prisma.newBgesB2BOlo.findMany({
          select: { statusInstalasi: true },
          where: { statusInstalasi: { not: null } },
          distinct: ['statusInstalasi']
        }),
        this.syncRepo.prisma.newBgesB2BOlo.findMany({
          select: { keterangan: true },
          where: { keterangan: { not: null } },
          distinct: ['keterangan']
        }),
        this.syncRepo.prisma.ndeUsulanB2B.findMany({
          select: { statusJt: true },
          where: { statusJt: { not: null } },
          distinct: ['statusJt']
        })
      ]);

      return {
        jenisKendala: jenisKendalaResults.map((r: { jenisKendala: any; }) => r.jenisKendala!).sort(),
        planTematik: planTematikResults.map((r: { planTematik: any; }) => r.planTematik!).sort(),
        statusUsulan: statusUsulanResults.map((r: { statusUsulan: any; }) => r.statusUsulan!).sort(),
        statusInstalasi: statusInstalasiResults.map((r: { statusInstalasi: any; }) => r.statusInstalasi!).sort(),
        keterangan: keteranganResults.map((r: { keterangan: any; }) => r.keterangan!).sort(),
        statusJt: statusJtResults.map((r: { statusJt: any; }) => r.statusJt!).sort()
      };
    } catch (error) {
      console.error('Error fetching enums from database:', error);

      return this.getHardcodedEnums();
    }
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
        'GO_LIVE',
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
        'NJKI_BELUM_LENGKAP',
        'NOT_APPROVE',
        'REVENUE_KURANG',
        'TUNGGU_JPP'
      ]
    };
  }
}