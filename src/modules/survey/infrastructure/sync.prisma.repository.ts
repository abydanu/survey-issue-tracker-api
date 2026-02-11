import prismaClient from '../../../infrastructure/database/prisma.js';
import { Prisma } from '../../../generated/prisma/client.js';
import type { ISyncRepository } from '../domain/sync.repository.js';
import type {
  Survey,
  CreateSurveyDto,
  UpdateSurveyDto,
  SurveySummarySheetRow,
  SurveyDetailSheetRow,
  DashboardQuery,
  NdeUsulanB2BRow,
  NewBgesB2BOloRow,
} from '../domain/sync.entity.js';
import { EnumValueService, type EnumType } from '../application/enum-value.service.js';
import { autoSyncFromSheetsOptimized } from './sync-optimized.js';

export class SyncPrismaRepository implements ISyncRepository {
  prisma = prismaClient;
  private enumValueService: EnumValueService;

  constructor() {
    this.enumValueService = new EnumValueService();
  }

  private async findOrCreateEnumId(enumType: EnumType, value: string | null): Promise<string | null> {
    if (!value) return null;

    if (value.trim() === '-') return null;
    try {
      return await this.enumValueService.findOrCreateEnumValue(enumType, value);
    } catch (error) {
      console.warn(`Failed to find/create enum ${enumType}.${value}:`, error);
      return null;
    }
  }

  private async processEnumFields(data: any): Promise<{
    jenisKendala?: { connect: { id: string } } | undefined;
    planTematik?: { connect: { id: string } } | undefined;
    statusUsulan?: { connect: { id: string } } | undefined;
    statusInstalasi?: { connect: { id: string } } | undefined;
    keterangan?: { connect: { id: string } } | undefined;
  }> {
    const result: any = {};

    if (data.jenisKendala !== undefined) {
      const id = await this.findOrCreateEnumId('JenisKendala', data.jenisKendala);
      if (id) result.jenisKendala = { connect: { id } };
    }
    if (data.planTematik !== undefined) {
      const id = await this.findOrCreateEnumId('PlanTematik', data.planTematik);
      if (id) result.planTematik = { connect: { id } };
    }
    if (data.statusUsulan !== undefined) {
      const id = await this.findOrCreateEnumId('StatusUsulan', data.statusUsulan);
      if (id) result.statusUsulan = { connect: { id } };
    }
    if (data.statusInstalasi !== undefined) {
      const id = await this.findOrCreateEnumId('StatusInstalasi', data.statusInstalasi);
      if (id) result.statusInstalasi = { connect: { id } };
    }
    if (data.keterangan !== undefined) {
      const id = await this.findOrCreateEnumId('Keterangan', data.keterangan);
      if (id) result.keterangan = { connect: { id } };
    }

    return result;
  }


  private async processNdeEnumFields(data: any): Promise<{
    statusJtId?: string | null;
    statusInstalasiId?: string | null;
  }> {
    const result: any = {};

    if (data.statusJt !== undefined) {
      result.statusJtId = await this.findOrCreateEnumId('StatusJt', data.statusJt);
    }
    if (data.statusInstalasi !== undefined) {
      result.statusInstalasiId = await this.findOrCreateEnumId('StatusInstalasi', data.statusInstalasi);
    }

    return result;
  }


  private convertEnumRelationsToStrings(data: any): any {
    if (!data) return data;

    const result = { ...data };


    if (data.jenisKendala?.value) result.jenisKendala = data.jenisKendala.value;
    if (data.planTematik?.value) result.planTematik = data.planTematik.value;
    if (data.statusUsulan?.value) result.statusUsulan = data.statusUsulan.value;
    if (data.statusInstalasi?.value) result.statusInstalasi = data.statusInstalasi.value;
    if (data.keterangan?.value) result.keterangan = data.keterangan.value;
    if (data.statusJt?.value) result.statusJt = data.statusJt.value;

    return result;
  }


  private validateJenisKendala(value: any): string | null {
    return value ? String(value).trim() : null;
  }

  private validatePlanTematik(value: any): string | null {
    return value ? String(value).trim() : null;
  }

  private validateStatusUsulan(value: any): string | null {
    return value ? String(value).trim() : null;
  }

  private validateStatusInstalasi(value: any): string | null {
    return value ? String(value).trim() : null;
  }

  private validateKeterangan(value: any): string | null {
    return value ? String(value).trim() : null;
  }

  private validateStatusJt(value: any): string | null {
    return value ? String(value).trim() : null;
  }

  private compareDecimal(existing: any, newValue: any): boolean {
    if (existing === null && newValue === null) return true;
    if (existing === null || newValue === null) return false;
    return existing.toString() === newValue.toString();
  }


  private async createMissingMasterData(nomorNcx: string, tx: any): Promise<boolean> {
    try {
      await tx.newBgesB2BOlo.create({
        data: {
          idKendala: nomorNcx,
          syncStatus: 'SYNCED',
          lastSyncAt: new Date(),

          datel: null,
          sto: null,
          namaPelanggan: null,
          latitude: null,
          longitude: null,
          jenisKendala: null,
          planTematik: null,
          rabHld: null,
          ihldValue: null,
          statusUsulan: null,
          statusIhld: null,
          idEprop: null,
          statusInstalasi: null,
          keterangan: null,
          newSc: null,
          namaOdp: null,
          tglGolive: null,
          umur: null,
          bln: null,
          tglInputUsulan: null,
          jenisOrder: null,
          avai: null,
          used: null,
          isTotal: null,
          occPercentage: null,
        }
      });
      console.log(`Created missing master data for nomorNcx: ${nomorNcx}`);
      return true;
    } catch (error) {
      console.error(`Failed to create master data for nomorNcx: ${nomorNcx}:`, error);
      return false;
    }
  }
  async findAllSurvey(query: DashboardQuery): Promise<{ data: Survey[]; total: number }> {
    const page = (query.page && typeof query.page === 'number' && query.page > 0) ? query.page : 1;
    const limit = (query.limit && typeof query.limit === 'number' && query.limit > 0) ? query.limit : 10;

    const where: Prisma.NdeUsulanB2BWhereInput = {
      masterData: {} as Prisma.NewBgesB2BOloWhereInput,
    };

    if (query.search && query.search.trim()) {
      const searchTerm = query.search.trim();
      where.OR = [
        { nomorNcx: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
        { namaPelanggan: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
        { masterData: { idKendala: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } } },
        { masterData: { newSc: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } } },
        { nomorNcx: { equals: searchTerm, mode: Prisma.QueryMode.insensitive } },
        { masterData: { newSc: { equals: searchTerm, mode: Prisma.QueryMode.insensitive } } },
        { masterData: { idKendala: { equals: searchTerm, mode: Prisma.QueryMode.insensitive } } },
      ];
    }

    if (query.statusJt && query.statusJt.trim() && query.statusJt.trim().toLowerCase() !== 'all') {
      where.statusJt = {
        value: {
          equals: query.statusJt.trim(),
          mode: Prisma.QueryMode.insensitive
        }
      };
    }

    if (query.rabHldMin !== undefined || query.rabHldMax !== undefined) {
      const rabHldFilter: any = {};

      if (query.rabHldMin !== undefined && query.rabHldMin !== null) {
        rabHldFilter.gte = new Prisma.Decimal(query.rabHldMin.toString());
      }

      if (query.rabHldMax !== undefined && query.rabHldMax !== null) {
        rabHldFilter.lte = new Prisma.Decimal(query.rabHldMax.toString());
      }

      where.masterData = {
        ...(where.masterData as Prisma.NewBgesB2BOloWhereInput),
        rabHld: rabHldFilter,
      };
    }

    if (query.tahun && query.tahun.trim()) {
      where.masterData = {
        ...(where.masterData as Prisma.NewBgesB2BOloWhereInput),
        tglInputUsulan: {
          gte: new Date(Number(query.tahun.trim()), 0, 1),
          lte: new Date(Number(query.tahun.trim()) + 1, 0, 1),
        },
      };
    }

    if (query.datel && query.datel.trim()) {
      where.masterData = {
        ...(where.masterData as Prisma.NewBgesB2BOloWhereInput),
        datel: {
          contains: query.datel.trim(),
          mode: Prisma.QueryMode.insensitive,
        },
      };
    }

    if (query.sto && query.sto.trim()) {
      where.masterData = {
        ...(where.masterData as Prisma.NewBgesB2BOloWhereInput),
        sto: {
          contains: query.sto.trim(),
          mode: Prisma.QueryMode.insensitive,
        },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.ndeUsulanB2B.findMany({
        where,
        include: {
          masterData: {
            include: {
              jenisKendala: true,
              planTematik: true,
              statusUsulan: true,
              statusInstalasi: true,
              keterangan: true,
            },
          },
          statusJt: true,
          statusInstalasi: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ndeUsulanB2B.count({ where }),
    ]);

    return {
      data: data.map((item) => this.mapToSurvey(item)),
      total,
    };
  }

  private mapToSurvey(item: any): Survey {
    const master = item.masterData || {};
    
    // Debug logging for specific records
    if (item.nomorNcx === '1002237835' || item.nomorNcx === '1002235636') {
      console.log(`[DEBUG] mapToSurvey for ${item.nomorNcx}:`, {
        'item.statusJt': item.statusJt,
        'item.statusJt?.value': item.statusJt?.value,
        'item.alamatInstalasi': item.alamatInstalasi,
        'item.jenisLayanan': item.jenisLayanan,
        'item.nilaiKontrak': item.nilaiKontrak,
        'item.progressJt': item.progressJt,
        'item.namaOdp': item.namaOdp,
        'item.jarakOdp': item.jarakOdp,
      });
    }
    
    return {
      id: item.id,
      no: item.no,
      bln: master.bln ?? null,
      tglInput: master.tglInputUsulan ?? null,
      idKendala: master.idKendala ?? null,
      jenisOrder: master.jenisOrder ?? null,
      datel: item.datel ?? master.datel ?? null,
      sto: item.sto ?? master.sto ?? null,
      namaPelanggan: item.namaPelanggan ?? master.namaPelanggan ?? null,
      latitude: item.latitude ?? master.latitude ?? null,
      longitude: item.longitude ?? master.longitude ?? null,
      jenisKendala: master.jenisKendala?.value ?? null,
      pltTemuan: master.planTematik?.value ?? null,
      rabHldSummary: master.rabHld ? Number(master.rabHld) : null,
      ihld: master.ihldValue ? Number(master.ihldValue) : null,
      statusUsulan: master.statusUsulan?.value ?? null,
      statusIhld: master.statusIhld ?? null,
      idEprop: master.idEprop ?? null,
      statusInstalasi: master.statusInstalasi?.value ?? item.statusInstalasi?.value ?? null,
      keterangan: master.keterangan?.value ?? null,
      newSc: master.newSc ?? null,
      statusJt: item.statusJt?.value ?? null,
      c2r: item.c2r ? Number(item.c2r) : null,
      nomorNcx: item.nomorNcx ?? null,
      alamat: item.alamatInstalasi ?? null,
      jenisLayanan: item.jenisLayanan ?? null,
      nilaiKontrak: item.nilaiKontrak ? BigInt(item.nilaiKontrak.toString()) : null,
      ihldLop: item.ihldLopId ?? null,
      planTematik: item.planTematik ?? master.planTematik?.value ?? null,
      rabHldDetail: master.rabHld ? BigInt(master.rabHld.toString()) : null,
      rabSurvey: item.rabSurvey ? BigInt(item.rabSurvey.toString()) : null,
      noNde: item.nomorNde ?? null,
      progresJt: item.progressJt ?? null,
      namaOdp: item.namaOdp ?? null,
      jarakOdp: item.jarakOdp ? Number(item.jarakOdp) : null,
      keteranganText: item.keterangan ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    } as Survey;
  }

  async findSurveyByNo(no: string): Promise<Survey | null> {
    const survey = await this.prisma.ndeUsulanB2B.findUnique({
      where: { no },
      include: {
        masterData: {
          include: {
            jenisKendala: true,
            planTematik: true,
            statusUsulan: true,
            statusInstalasi: true,
            keterangan: true,
          },
        },
        statusJt: true,
        statusInstalasi: true,
      },
    });

    if (!survey) return null;

    return this.mapToSurvey(survey);
  }

  async findSurveyByNomorNc(nomorNcx: string): Promise<Survey | null> {
    // Step 1: Try to find by nomorNcx directly
    let survey = await this.prisma.ndeUsulanB2B.findFirst({
      where: { nomorNcx: nomorNcx },
      include: {
        masterData: {
          include: {
            jenisKendala: true,
            planTematik: true,
            statusUsulan: true,
            statusInstalasi: true,
            keterangan: true,
          },
        },
        statusJt: true,
        statusInstalasi: true,
      },
    });

    // Step 2: If not found, try to find by master data's newSc
    if (!survey) {
      survey = await this.prisma.ndeUsulanB2B.findFirst({
        where: {
          masterData: {
            newSc: nomorNcx
          }
        },
        include: {
          masterData: {
            include: {
              jenisKendala: true,
              planTematik: true,
              statusUsulan: true,
              statusInstalasi: true,
              keterangan: true,
            },
          },
          statusJt: true,
          statusInstalasi: true,
        },
      });
    }

    if (!survey) return null;

    return this.mapToSurvey(survey);
  }

  async createSurvey(data: CreateSurveyDto): Promise<Survey> {
    const nomorNcx = data.nomorNcx || data.idKendala;

    if (!nomorNcx || !String(nomorNcx).trim()) {
      throw new Error(
        'Field "nomorNcx" wajib diisi untuk membuat data survey. ' +
        'Pastikan nomor NCX/Starclick tidak kosong.'
      );
    }

    const masterExists = await this.prisma.newBgesB2BOlo.findUnique({
      where: { idKendala: String(nomorNcx).trim() },
      select: { idKendala: true },
    });

    if (!masterExists) {
      throw new Error(
        `Master data (Sheet 2) untuk nomorNcx "${String(nomorNcx).trim()}" tidak ditemukan. ` +
        `Silakan sync Sheet 2 terlebih dahulu atau pastikan data sudah ada.`
      );
    }

    const survey = await this.prisma.ndeUsulanB2B.create({
      data: {
        no: data.no,
        masterData: {
          connect: {
            idKendala: String(nomorNcx).trim(),
          },
        },
        statusJt: (data.statusJt ?? null) as any,
        c2r: data.c2r !== null && data.c2r !== undefined ? new Prisma.Decimal(data.c2r.toString()) : null,
        alamatInstalasi: data.alamat ?? null,
        jenisLayanan: data.jenisLayanan ?? null,
        nilaiKontrak: data.nilaiKontrak ? new Prisma.Decimal(data.nilaiKontrak.toString()) : null,
        rabSurvey: data.rabSurvey ? new Prisma.Decimal(data.rabSurvey.toString()) : null,
        nomorNde: data.noNde ?? null,
        progressJt: data.progresJt ?? null,
        namaOdp: data.namaOdp ?? null,
        jarakOdp: data.jarakOdp ? new Prisma.Decimal(data.jarakOdp.toString()) : null,
        keterangan: data.keteranganText ?? null,
        syncStatus: 'SYNCED',
      },
      include: {
        masterData: {
          include: {
            jenisKendala: true,
            planTematik: true,
            statusUsulan: true,
            statusInstalasi: true,
            keterangan: true,
          },
        },
        statusJt: true,
        statusInstalasi: true,
      },
    });

    return this.mapToSurvey(survey);
  }

  async updateSurvey(nomorNcx: string, data: UpdateSurveyDto): Promise<Survey> {
    // Use findSurveyByNomorNc which already handles newSc lookup
    const existing = await this.findSurveyByNomorNc(nomorNcx);

    if (!existing) {
      throw new Error(`Data dengan nomor NCX/Starclick ${nomorNcx} tidak ditemukan`);
    }

    // Get the full record with relations for update
    const existingRecord = await this.prisma.ndeUsulanB2B.findUnique({
      where: { id: existing.id },
      include: {
        masterData: {
          include: {
            jenisKendala: true,
            planTematik: true,
            statusUsulan: true,
            statusInstalasi: true,
            keterangan: true,
          },
        },
        statusJt: true,
        statusInstalasi: true,
      },
    });

    if (!existingRecord) {
      throw new Error(`Data dengan nomor NCX/Starclick ${nomorNcx} tidak ditemukan`);
    }


    const updateData: any = {};


    if (data.statusJt !== undefined) {
      if (data.statusJt === null) {
        updateData.statusJt = { disconnect: true };
      } else {
        const statusJtId = await this.findOrCreateEnumId('StatusJt', data.statusJt);
        if (statusJtId) {
          updateData.statusJt = { connect: { id: statusJtId } };
        }
      }
    }


    if (data.statusInstalasi !== undefined) {
      if (data.statusInstalasi === null) {
        updateData.statusInstalasi = { disconnect: true };
      } else {
        const statusInstalasiId = await this.findOrCreateEnumId('StatusInstalasi', data.statusInstalasi);
        if (statusInstalasiId) {
          updateData.statusInstalasi = { connect: { id: statusInstalasiId } };
        }
      }
    }

    // c2r is a formula field in sheets, don't update it
    if (data.nomorNcx !== undefined) {
      if (data.nomorNcx === null || data.nomorNcx === '') {
        throw new Error('Field "nomorNcx" tidak boleh kosong (relasi master data wajib)');
      }
      const masterExists = await this.prisma.newBgesB2BOlo.findUnique({
        where: { idKendala: String(data.nomorNcx).trim() },
        select: { idKendala: true },
      });
      if (!masterExists) {
        throw new Error(
          `Master data (Sheet 2) untuk idKendala/nomorNcx "${String(data.nomorNcx).trim()}" tidak ditemukan. ` +
          `Silakan sync Sheet 2 dulu.`
        );
      }
      updateData.masterData = { connect: { idKendala: String(data.nomorNcx).trim() } };
    }
    if (data.alamat !== undefined) updateData.alamatInstalasi = data.alamat;
    if (data.jenisLayanan !== undefined) updateData.jenisLayanan = data.jenisLayanan;
    if (data.nilaiKontrak !== undefined) updateData.nilaiKontrak = data.nilaiKontrak ? new Prisma.Decimal(data.nilaiKontrak.toString()) : null;
    if (data.rabSurvey !== undefined) updateData.rabSurvey = data.rabSurvey ? new Prisma.Decimal(data.rabSurvey.toString()) : null;
    if (data.noNde !== undefined) updateData.nomorNde = data.noNde;
    if (data.progresJt !== undefined) updateData.progressJt = data.progresJt;
    if (data.namaOdp !== undefined) updateData.namaOdp = data.namaOdp;
    if (data.jarakOdp !== undefined) updateData.jarakOdp = data.jarakOdp ? new Prisma.Decimal(data.jarakOdp.toString()) : null;
    if (data.keteranganText !== undefined) updateData.keterangan = data.keteranganText;


    if (data.statusUsulan !== undefined) updateData.statusUsulan = data.statusUsulan;
    if (data.planTematik !== undefined) updateData.planTematik = data.planTematik;


    const survey = await this.prisma.$transaction(async (tx) => {

      const updatedSurvey = await tx.ndeUsulanB2B.update({
        where: { id: existingRecord.id },
        data: updateData,
        include: {
          masterData: {
            include: {
              jenisKendala: true,
              planTematik: true,
              statusUsulan: true,
              statusInstalasi: true,
              keterangan: true,
            },
          },
          statusJt: true,
          statusInstalasi: true,
        },
      });


      if (data.statusJt !== undefined || data.statusUsulan !== undefined || data.statusInstalasi !== undefined) {
        const masterUpdateData: any = {
          lastSyncAt: new Date(),
        };


        if (data.statusUsulan !== undefined) {
          const statusUsulanId = await this.findOrCreateEnumId('StatusUsulan', data.statusUsulan);
          if (statusUsulanId) {
            masterUpdateData.statusUsulan = { connect: { id: statusUsulanId } };
          }
        }
        if (data.statusInstalasi !== undefined) {
          const statusInstalasiId = await this.findOrCreateEnumId('StatusInstalasi', data.statusInstalasi);
          if (statusInstalasiId) {
            masterUpdateData.statusInstalasi = { connect: { id: statusInstalasiId } };
          }
        }


        if (Object.keys(masterUpdateData).length > 1) {
          await tx.newBgesB2BOlo.update({
            where: { idKendala: existingRecord.nomorNcx },
            data: masterUpdateData,
          });
          console.log(`Synced status from NDE USULAN B2B to NEW BGES B2B for ${existingRecord.nomorNcx}`);
        }
      }

      return updatedSurvey;
    });

    return this.mapToSurvey(survey);
  }

  async deleteSurvey(nomorNcx: string): Promise<void> {
    // Use findSurveyByNomorNc which already handles newSc lookup
    const existing = await this.findSurveyByNomorNc(nomorNcx);

    if (!existing) {
      throw new Error(`Data dengan nomor NCX/Starclick ${nomorNcx} tidak ditemukan`);
    }

    await this.prisma.ndeUsulanB2B.delete({
      where: { id: existing.id },
    });
  }


  async updateTanggalInput(idKendala: string, tanggalInput: Date): Promise<void> {
    const existing = await this.prisma.newBgesB2BOlo.findUnique({
      where: { idKendala: idKendala.trim() },
    });

    if (!existing) {
      throw new Error(`Master data dengan idKendala ${idKendala} tidak ditemukan`);
    }

    await this.prisma.newBgesB2BOlo.update({
      where: { idKendala: idKendala.trim() },
      data: {
        tglInputUsulan: tanggalInput,
        lastSyncAt: new Date(),
      },
    });

    console.log(`Updated tanggal input for ${idKendala}: ${tanggalInput.toLocaleDateString('en-US')}`);
  }


  async getMasterDataByIdKendala(idKendala: string): Promise<any | null> {
    const masterData = await this.prisma.newBgesB2BOlo.findUnique({
      where: { idKendala: idKendala.trim() },
      include: {
        jenisKendala: true,
        planTematik: true,
        statusUsulan: true,
        statusInstalasi: true,
        keterangan: true,
      }
    });

    if (!masterData) {
      return null;
    }


    return {
      idKendala: masterData.idKendala,
      umur: masterData.umur,
      bln: masterData.bln,
      tglInputUsulan: masterData.tglInputUsulan,
      jenisOrder: masterData.jenisOrder,
      datel: masterData.datel,
      sto: masterData.sto,
      namaPelanggan: masterData.namaPelanggan,
      latitude: masterData.latitude,
      longitude: masterData.longitude,
      jenisKendala: masterData.jenisKendala?.value || null,
      planTematik: masterData.planTematik?.value || null,
      rabHld: masterData.rabHld,
      ihldValue: masterData.ihldValue,
      statusUsulan: masterData.statusUsulan?.value || null,
      statusIhld: masterData.statusIhld,
      idEprop: masterData.idEprop,
      statusInstalasi: masterData.statusInstalasi?.value || null,
      keterangan: masterData.keterangan?.value || null,
      newSc: masterData.newSc,
    };
  }

  async syncFromSheets(summaryData: SurveySummarySheetRow[], detailData: SurveyDetailSheetRow[]): Promise<void> {
    console.log('Step 1: Syncing master data (Sheet 2 - NEW BGES B2B & OLO)...');
    const detailRows = detailData as NewBgesB2BOloRow[];
    const BATCH_SIZE = 100;

    const detailBatches = [];
    for (let i = 0; i < detailRows.length; i += BATCH_SIZE) {
      detailBatches.push(detailRows.slice(i, i + BATCH_SIZE));
    }

    for (const batch of detailBatches) {
      await this.prisma.$transaction(
        async (tx: any) => {
          await Promise.all(
            batch.map(async (detail) => {
              if (!detail.idKendala || !detail.idKendala.trim()) {
                return Promise.resolve(null);
              }


              const enumFields = await this.processEnumFields(detail);

              const updateData: any = {
                syncStatus: 'SYNCED',
                lastSyncAt: new Date(),
                ...enumFields,
              };
              const createData: any = {
                idKendala: detail.idKendala.trim(),
                syncStatus: 'SYNCED',
                lastSyncAt: new Date(),
                ...enumFields,
              };

              if (detail.umur !== undefined) {
                updateData.umur = detail.umur ?? null;
                createData.umur = detail.umur ?? null;
              }
              if (detail.bln !== undefined) {
                updateData.bln = detail.bln ?? null;
                createData.bln = detail.bln ?? null;
              }
              if (detail.tglInputUsulan !== undefined) {
                updateData.tglInputUsulan = detail.tglInputUsulan ?? null;
                createData.tglInputUsulan = detail.tglInputUsulan ?? null;
              }
              if (detail.jenisOrder !== undefined) {
                updateData.jenisOrder = detail.jenisOrder ?? null;
                createData.jenisOrder = detail.jenisOrder ?? null;
              }
              if (detail.datel !== undefined) {
                updateData.datel = detail.datel ?? null;
                createData.datel = detail.datel ?? null;
              }
              if (detail.sto !== undefined) {
                updateData.sto = detail.sto ?? null;
                createData.sto = detail.sto ?? null;
              }
              if (detail.namaPelanggan !== undefined) {
                updateData.namaPelanggan = detail.namaPelanggan ?? null;
                createData.namaPelanggan = detail.namaPelanggan ?? null;
              }
              if (detail.latitude !== undefined) {
                updateData.latitude = detail.latitude ?? null;
                createData.latitude = detail.latitude ?? null;
              }
              if (detail.longitude !== undefined) {
                updateData.longitude = detail.longitude ?? null;
                createData.longitude = detail.longitude ?? null;
              }
              if (detail.rabHld !== undefined) {
                updateData.rabHld = detail.rabHld !== null ? new Prisma.Decimal(detail.rabHld.toString()) : null;
                createData.rabHld = detail.rabHld !== null ? new Prisma.Decimal(detail.rabHld.toString()) : null;
              }
              if (detail.ihldValue !== undefined) {
                updateData.ihldValue = detail.ihldValue ?? null;
                createData.ihldValue = detail.ihldValue ?? null;
              }
              if (detail.statusIhld !== undefined) {
                updateData.statusIhld = detail.statusIhld ?? null;
                createData.statusIhld = detail.statusIhld ?? null;
              }
              if (detail.idEprop !== undefined) {
                updateData.idEprop = detail.idEprop ?? null;
                createData.idEprop = detail.idEprop ?? null;
              }
              if (detail.newSc !== undefined) {
                updateData.newSc = detail.newSc ?? null;
                createData.newSc = detail.newSc ?? null;
              }
              if (detail.namaOdp !== undefined) {
                updateData.namaOdp = detail.namaOdp ?? null;
                createData.namaOdp = detail.namaOdp ?? null;
              }
              if (detail.tglGolive !== undefined) {
                updateData.tglGolive = detail.tglGolive ?? null;
                createData.tglGolive = detail.tglGolive ?? null;
              }
              if (detail.avai !== undefined) {
                updateData.avai = detail.avai ?? null;
                createData.avai = detail.avai ?? null;
              }
              if (detail.used !== undefined) {
                updateData.used = detail.used ?? null;
                createData.used = detail.used ?? null;
              }
              if (detail.isTotal !== undefined) {
                updateData.isTotal = detail.isTotal ?? null;
                createData.isTotal = detail.isTotal ?? null;
              }
              if (detail.occPercentage !== undefined) {
                updateData.occPercentage = detail.occPercentage !== null ? new Prisma.Decimal(detail.occPercentage.toString()) : null;
                createData.occPercentage = detail.occPercentage !== null ? new Prisma.Decimal(detail.occPercentage.toString()) : null;
              }

              return tx.newBgesB2BOlo.upsert({
                where: { idKendala: detail.idKendala.trim() },
                update: updateData,
                create: createData,
              });
            })
          );
        },
        {
          maxWait: 30000,
          timeout: 60000,
        }
      );
    }

    console.log('Step 1 completed: Master data synced successfully');

    console.log('Step 2: Syncing related data (Sheet 1 - NDE USULAN B2B)...');
    const summaryRows = summaryData as NdeUsulanB2BRow[];

    const validSummaryRows = [];
    const invalidSummaryRows = [];

    for (const summary of summaryRows) {
      const nomorNcx = summary.nomorNcx || (summary as any).nomorNc;
      const no = summary.no || (summary as any).NO;

      if (!no || !nomorNcx || !String(nomorNcx).trim()) {
        console.warn(`Skipping invalid record: no=${no}, nomorNcx=${nomorNcx}`, Object.keys(summary));
        continue;
      }

      const masterExists = await this.prisma.newBgesB2BOlo.findUnique({
        where: { idKendala: String(nomorNcx).trim() },
        select: { idKendala: true }
      });

      if (masterExists) {
        validSummaryRows.push(summary);
      } else {
        invalidSummaryRows.push(summary);
        console.warn(`Warning: Master data not found for nomorNcx: ${nomorNcx} (no: ${no})`);
      }
    }

    console.log(`Found ${validSummaryRows.length} valid records and ${invalidSummaryRows.length} invalid records`);

    const summaryBatches = [];
    for (let i = 0; i < validSummaryRows.length; i += BATCH_SIZE) {
      summaryBatches.push(validSummaryRows.slice(i, i + BATCH_SIZE));
    }

    for (const batch of summaryBatches) {
      try {
        await this.prisma.$transaction(
          async (tx: any) => {
            const results = await Promise.all(
              batch.map(async (summary) => {
                const nomorNcx = summary.nomorNcx || (summary as any).nomorNc;
                const no = summary.no || (summary as any).NO;

                try {

                  const existingRecord = await tx.ndeUsulanB2B.findUnique({
                    where: { nomorNcx: String(nomorNcx).trim() },
                    select: {
                      no: true,
                      nomorNcx: true,
                      statusJt: true,
                      c2r: true,
                      alamatInstalasi: true,
                      jenisLayanan: true,
                      nilaiKontrak: true,
                      rabSurvey: true,
                      nomorNde: true,
                      progressJt: true,
                      namaOdp: true,
                      jarakOdp: true,
                      keterangan: true,
                      datel: true,
                      sto: true,
                      namaPelanggan: true,
                      latitude: true,
                      longitude: true,
                      ihldLopId: true,
                      planTematik: true,
                      rabHld: true,
                      statusUsulan: true,
                      statusInstalasi: true,
                      lastSyncAt: true
                    }
                  });

                  const updateData: any = {
                    syncStatus: 'SYNCED',
                    lastSyncAt: new Date(),
                  };
                  const createData: any = {
                    no: no,
                    masterData: {
                      connect: { idKendala: String(nomorNcx).trim() },
                    },
                    syncStatus: 'SYNCED',
                    lastSyncAt: new Date(),
                  };

                  updateData.masterData = {
                    connect: { idKendala: String(nomorNcx).trim() },
                  };

                  let hasChanges = false;


                  if (summary.statusJt !== undefined) {
                    const validStatusJt = this.validateStatusJt(summary.statusJt);
                    if (!existingRecord || existingRecord.statusJt !== validStatusJt) {
                      hasChanges = true;
                    }
                    updateData.statusJt = validStatusJt;
                    createData.statusJt = validStatusJt;
                    if (summary.statusJt && !validStatusJt) {
                      console.warn(`Invalid StatusJt for record no: ${no}, value: "${summary.statusJt}"`);
                    }
                  }
                  if (summary.c2r !== undefined) {
                    const newC2r = summary.c2r !== null ? new Prisma.Decimal(summary.c2r.toString()) : null;
                    if (!existingRecord || !this.compareDecimal(existingRecord.c2r, newC2r)) {
                      hasChanges = true;
                    }
                    updateData.c2r = newC2r;
                    createData.c2r = newC2r;
                  }
                  if (summary.alamatInstalasi !== undefined) {
                    const newAlamat = summary.alamatInstalasi ?? null;
                    if (!existingRecord || existingRecord.alamatInstalasi !== newAlamat) {
                      hasChanges = true;
                    }
                    updateData.alamatInstalasi = newAlamat;
                    createData.alamatInstalasi = newAlamat;
                  }
                  if (summary.jenisLayanan !== undefined) {
                    const newJenisLayanan = summary.jenisLayanan ?? null;
                    if (!existingRecord || existingRecord.jenisLayanan !== newJenisLayanan) {
                      hasChanges = true;
                    }
                    updateData.jenisLayanan = newJenisLayanan;
                    createData.jenisLayanan = newJenisLayanan;
                  }
                  if (summary.nilaiKontrak !== undefined) {
                    const newNilaiKontrak = summary.nilaiKontrak !== null ? new Prisma.Decimal(summary.nilaiKontrak.toString()) : null;
                    if (!existingRecord || !this.compareDecimal(existingRecord.nilaiKontrak, newNilaiKontrak)) {
                      hasChanges = true;
                    }
                    updateData.nilaiKontrak = newNilaiKontrak;
                    createData.nilaiKontrak = newNilaiKontrak;
                  }
                  if (summary.rabSurvey !== undefined) {
                    const newRabSurvey = summary.rabSurvey !== null ? new Prisma.Decimal(summary.rabSurvey.toString()) : null;
                    if (!existingRecord || !this.compareDecimal(existingRecord.rabSurvey, newRabSurvey)) {
                      hasChanges = true;
                    }
                    updateData.rabSurvey = newRabSurvey;
                    createData.rabSurvey = newRabSurvey;
                  }

                  const fieldsToCheck = [
                    { key: 'nomorNde', value: summary.nomorNde ?? null },
                    { key: 'progressJt', value: summary.progressJt ?? null },
                    { key: 'namaOdp', value: summary.namaOdp ?? null },
                    { key: 'keterangan', value: summary.keterangan ?? null },
                    { key: 'datel', value: summary.datel ?? null },
                    { key: 'sto', value: summary.sto ?? null },
                    { key: 'namaPelanggan', value: summary.namaPelanggan ?? null },
                    { key: 'latitude', value: summary.latitude ?? null },
                    { key: 'longitude', value: summary.longitude ?? null },
                    { key: 'ihldLopId', value: summary.ihldLopId ?? null }
                  ];

                  for (const field of fieldsToCheck) {
                    if (summary[field.key as keyof typeof summary] !== undefined) {
                      if (!existingRecord || (existingRecord as any)[field.key] !== field.value) {
                        hasChanges = true;
                      }
                      updateData[field.key] = field.value;
                      createData[field.key] = field.value;
                    }
                  }


                  if (summary.jarakOdp !== undefined) {
                    const newJarakOdp = summary.jarakOdp !== null ? new Prisma.Decimal(summary.jarakOdp.toString()) : null;
                    if (!existingRecord || !this.compareDecimal(existingRecord.jarakOdp, newJarakOdp)) {
                      hasChanges = true;
                    }
                    updateData.jarakOdp = newJarakOdp;
                    createData.jarakOdp = newJarakOdp;
                  }
                  if (summary.rabHld !== undefined) {
                    const newRabHld = summary.rabHld !== null ? new Prisma.Decimal(summary.rabHld.toString()) : null;
                    if (!existingRecord || !this.compareDecimal(existingRecord.rabHld, newRabHld)) {
                      hasChanges = true;
                    }
                    updateData.rabHld = newRabHld;
                    createData.rabHld = newRabHld;
                  }


                  if (summary.planTematik !== undefined) {
                    const validPlanTematik = this.validatePlanTematik(summary.planTematik);
                    if (!existingRecord || existingRecord.planTematik !== validPlanTematik) {
                      hasChanges = true;
                    }
                    updateData.planTematik = validPlanTematik;
                    createData.planTematik = validPlanTematik;
                    if (summary.planTematik && !validPlanTematik) {
                      console.warn(`Invalid PlanTematik for record no: ${no}, value: "${summary.planTematik}"`);
                    }
                  }
                  if (summary.statusUsulan !== undefined) {
                    const validStatusUsulan = this.validateStatusUsulan(summary.statusUsulan);
                    if (!existingRecord || existingRecord.statusUsulan !== validStatusUsulan) {
                      hasChanges = true;
                    }
                    updateData.statusUsulan = validStatusUsulan;
                    createData.statusUsulan = validStatusUsulan;
                    if (summary.statusUsulan && !validStatusUsulan) {
                      console.warn(`Invalid StatusUsulan for record no: ${no}, value: "${summary.statusUsulan}"`);
                    }
                  }
                  if (summary.statusInstalasi !== undefined) {
                    const validStatusInstalasi = this.validateStatusInstalasi(summary.statusInstalasi);
                    if (!existingRecord || existingRecord.statusInstalasi !== validStatusInstalasi) {
                      hasChanges = true;
                    }
                    updateData.statusInstalasi = validStatusInstalasi;
                    createData.statusInstalasi = validStatusInstalasi;
                    if (summary.statusInstalasi && !validStatusInstalasi) {
                      console.warn(`Invalid StatusInstalasi for record no: ${no}, value: "${summary.statusInstalasi}"`);
                    }
                  }


                  if (existingRecord && !hasChanges) {
                    console.log(`Skipping record no: ${no}, nomorNcx: ${String(nomorNcx).trim()} - No changes detected`);
                    return null;
                  }

                  const operation = existingRecord ? 'UPDATE' : 'CREATE';
                  console.log(`${operation} NdeUsulanB2B record:`, {
                    no: no,
                    nomorNcx: String(nomorNcx).trim(),
                    hasChanges: hasChanges,
                    updateFields: Object.keys(updateData),
                    createFields: Object.keys(createData)
                  });

                  return tx.ndeUsulanB2B.upsert({
                    where: { nomorNcx: String(nomorNcx).trim() },
                    update: updateData,
                    create: createData,
                  });
                } catch (recordError: any) {
                  console.error(`Error upserting record no: ${no}, nomorNcx: ${nomorNcx}:`, recordError.message);
                  throw recordError;
                }
              })
            );


            const processedResults = results.filter(result => result !== null);
            const skippedCount = results.length - processedResults.length;

            if (skippedCount > 0) {
              console.log(`Batch completed: ${processedResults.length} processed, ${skippedCount} skipped (no changes)`);
            }
          },
          {
            maxWait: 30000,
            timeout: 60000,
          }
        );
      } catch (batchError: any) {
        console.error(`Error processing batch:`, batchError.message);
        throw batchError;
      }
    }

    console.log('Step 2 completed: Related data synced successfully');

    if (invalidSummaryRows.length > 0) {
      console.warn(`Warning: ${invalidSummaryRows.length} records were skipped due to missing master data`);
    }


    console.log(`Sync Summary:
    - Total summary records processed: ${validSummaryRows.length}
    - Invalid records skipped: ${invalidSummaryRows.length}
    - Records with missing master data: ${invalidSummaryRows.length}
    `);
  }

  async syncFromSheetsWithBatch(
    summaryData: any[],
    detailData: any[]
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  }> {
    const BATCH_SIZE = 5;
    let stats = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    try {

      if (detailData.length > 0) {
        console.log(`Processing ${detailData.length} detail records...`);
        const detailRows = detailData as NewBgesB2BOloRow[];

        for (let i = 0; i < detailRows.length; i += BATCH_SIZE) {
          const batch = detailRows.slice(i, i + BATCH_SIZE);

          await this.prisma.$transaction(
            async (tx) => {
              for (const detail of batch) {
                try {
                  const existingRecord = await tx.newBgesB2BOlo.findUnique({
                    where: { idKendala: detail.idKendala.trim() },
                  });


                  const updateData: any = {
                    syncStatus: 'SYNCED',
                    lastSyncAt: new Date(),
                  };
                  const createData: any = {
                    idKendala: detail.idKendala.trim(),
                    syncStatus: 'SYNCED',
                    lastSyncAt: new Date(),
                  };


                  if (detail.jenisKendala !== undefined) {
                    const validJenisKendala = this.validateJenisKendala(detail.jenisKendala);
                    updateData.jenisKendala = validJenisKendala;
                    createData.jenisKendala = validJenisKendala;
                  }
                  if (detail.planTematik !== undefined) {
                    const validPlanTematik = this.validatePlanTematik(detail.planTematik);
                    updateData.planTematik = validPlanTematik;
                    createData.planTematik = validPlanTematik;
                  }
                  if (detail.keterangan !== undefined) {
                    const validKeterangan = this.validateKeterangan(detail.keterangan);
                    updateData.keterangan = validKeterangan;
                    createData.keterangan = validKeterangan;
                  }


                  const simpleFields = ['datel', 'sto', 'namaPelanggan', 'latitude', 'longitude', 'statusUsulan', 'statusIhld', 'idEprop', 'statusInstalasi', 'newSc', 'namaOdp'];
                  for (const field of simpleFields) {
                    if (detail[field as keyof typeof detail] !== undefined) {
                      updateData[field] = detail[field as keyof typeof detail] ?? null;
                      createData[field] = detail[field as keyof typeof detail] ?? null;
                    }
                  }

                  const result = await tx.newBgesB2BOlo.upsert({
                    where: { idKendala: detail.idKendala.trim() },
                    update: updateData,
                    create: createData,
                  });

                  if (existingRecord) {
                    stats.updated++;
                  } else {
                    stats.created++;
                  }
                } catch (error) {
                  console.error(`Error processing detail record ${detail.idKendala}:`, error);
                  stats.errors++;
                }
              }
            },
            {
              maxWait: 15000,
              timeout: 30000,
            }
          );
        }
      }


      if (summaryData.length > 0) {
        console.log(`Processing ${summaryData.length} summary records...`);
        const summaryRows = summaryData as NdeUsulanB2BRow[];

        for (let i = 0; i < summaryRows.length; i += BATCH_SIZE) {
          const batch = summaryRows.slice(i, i + BATCH_SIZE);

          await this.prisma.$transaction(
            async (tx) => {
              for (const summary of batch) {
                try {
                  const nomorNcx = summary.nomorNcx || (summary as any).nomorNc;
                  const no = summary.no || (summary as any).NO;

                  if (!no || !nomorNcx || !String(nomorNcx).trim()) {
                    console.warn(`Skipping invalid record: no=${no}, nomorNcx=${nomorNcx}`);
                    stats.skipped++;
                    continue;
                  }


                  const masterExists = await tx.newBgesB2BOlo.findUnique({
                    where: { idKendala: String(nomorNcx).trim() },
                    select: { idKendala: true }
                  });

                  if (!masterExists) {
                    console.warn(`Master data not found for nomorNcx: ${nomorNcx} (no: ${no})`);
                    stats.skipped++;
                    continue;
                  }

                  const existingRecord = await tx.ndeUsulanB2B.findUnique({
                    where: { nomorNcx: String(nomorNcx).trim() },
                  });


                  const updateData: any = {
                    syncStatus: 'SYNCED',
                    lastSyncAt: new Date(),
                    masterData: {
                      connect: { idKendala: String(nomorNcx).trim() },
                    },
                  };
                  const createData: any = {
                    no: no,
                    masterData: {
                      connect: { idKendala: String(nomorNcx).trim() },
                    },
                    syncStatus: 'SYNCED',
                    lastSyncAt: new Date(),
                  };

                  if (summary.statusJt !== undefined) {
                    const validStatusJt = this.validateStatusJt(summary.statusJt);
                    updateData.statusJt = validStatusJt;
                    createData.statusJt = validStatusJt;
                  }
                  if (summary.planTematik !== undefined) {
                    const validPlanTematik = this.validatePlanTematik(summary.planTematik);
                    updateData.planTematik = validPlanTematik;
                    createData.planTematik = validPlanTematik;
                  }
                  if (summary.statusUsulan !== undefined) {
                    const validStatusUsulan = this.validateStatusUsulan(summary.statusUsulan);
                    updateData.statusUsulan = validStatusUsulan;
                    createData.statusUsulan = validStatusUsulan;
                  }
                  if (summary.statusInstalasi !== undefined) {
                    const validStatusInstalasi = this.validateStatusInstalasi(summary.statusInstalasi);
                    updateData.statusInstalasi = validStatusInstalasi;
                    createData.statusInstalasi = validStatusInstalasi;
                  }

                  const simpleFields = ['alamatInstalasi', 'jenisLayanan', 'nomorNde', 'progressJt', 'namaOdp', 'keterangan', 'datel', 'sto', 'namaPelanggan', 'latitude', 'longitude', 'ihldLopId'];
                  for (const field of simpleFields) {
                    if (summary[field as keyof typeof summary] !== undefined) {
                      updateData[field] = summary[field as keyof typeof summary] ?? null;
                      createData[field] = summary[field as keyof typeof summary] ?? null;
                    }
                  }

                  const decimalFields = ['c2r', 'nilaiKontrak', 'rabSurvey', 'jarakOdp', 'rabHld'];
                  for (const field of decimalFields) {
                    if (summary[field as keyof typeof summary] !== undefined) {
                      const value = summary[field as keyof typeof summary];
                      const decimalValue = (value !== null && value !== undefined) ? new Prisma.Decimal(value.toString()) : null;
                      updateData[field] = decimalValue;
                      createData[field] = decimalValue;
                    }
                  }

                  const result = await tx.ndeUsulanB2B.upsert({
                    where: { nomorNcx: String(nomorNcx).trim() },
                    update: updateData,
                    create: createData,
                  });

                  if (existingRecord) {
                    stats.updated++;
                  } else {
                    stats.created++;
                  }
                } catch (error) {
                  console.error(`Error processing summary record:`, error);
                  stats.errors++;
                }
              }
            },
            {
              maxWait: 15000,
              timeout: 30000,
            }
          );
        }
      }

      console.log(`Batch sync completed:`, stats);
      return stats;
    } catch (error) {
      console.error('Error in batch sync:', error);
      throw error;
    }
  }

  async autoSyncFromSheets(
    summaryData: any[],
    detailData: any[]
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    errors: number;
    batchesProcessed: number;
  }> {
    // Use the optimized version that pre-processes enums outside transactions
    return autoSyncFromSheetsOptimized(
      this.prisma,
      this.enumValueService,
      summaryData,
      detailData
    );
  }

}