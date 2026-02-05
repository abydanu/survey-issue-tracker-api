import prismaClient from '../../../infrastructure/database/prisma.js';
import { Prisma, StatusJt, StatusInstalasi, PlanTematik, StatusUsulan, JenisKendala, Keterangan } from '../../../generated/prisma/client.js';
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

export class SyncPrismaRepository implements ISyncRepository {
  prisma = prismaClient;

  private validateStatusInstalasi(value: any): StatusInstalasi | null {
    if (!value || typeof value !== 'string') return null;

    const upperValue = value.toUpperCase().trim();
    const validValues = Object.values(StatusInstalasi);

    if (validValues.includes(upperValue as StatusInstalasi)) {
      return upperValue as StatusInstalasi;
    }

    console.warn(`Invalid StatusInstalasi value: "${value}". Valid values are: ${validValues.join(', ')}`);
    return null;
  }

  private validateStatusJt(value: any): StatusJt | null {
    if (!value || typeof value !== 'string') return null;

    const upperValue = value.toUpperCase().trim();
    const validValues = Object.values(StatusJt);

    if (validValues.includes(upperValue as StatusJt)) {
      return upperValue as StatusJt;
    }

    console.warn(`Invalid StatusJt value: "${value}". Valid values are: ${validValues.join(', ')}`);
    return null;
  }

  private validatePlanTematik(value: any): PlanTematik | null {
    if (!value || typeof value !== 'string') return null;

    const upperValue = value.toUpperCase().trim();
    const validValues = Object.values(PlanTematik);

    if (validValues.includes(upperValue as PlanTematik)) {
      return upperValue as PlanTematik;
    }

    console.warn(`Invalid PlanTematik value: "${value}". Valid values are: ${validValues.join(', ')}`);
    return null;
  }

  private validateStatusUsulan(value: any): StatusUsulan | null {
    if (!value || typeof value !== 'string') return null;

    const upperValue = value.toUpperCase().trim();
    const validValues = Object.values(StatusUsulan);

    if (validValues.includes(upperValue as StatusUsulan)) {
      return upperValue as StatusUsulan;
    }

    console.warn(`Invalid StatusUsulan value: "${value}". Valid values are: ${validValues.join(', ')}`);
    return null;
  }

  private validateJenisKendala(value: any): JenisKendala | null {
    if (!value || typeof value !== 'string') return null;

    const upperValue = value.toUpperCase().trim();
    const validValues = Object.values(JenisKendala);

    if (validValues.includes(upperValue as JenisKendala)) {
      return upperValue as JenisKendala;
    }

    console.warn(`Invalid JenisKendala value: "${value}". Valid values are: ${validValues.join(', ')}`);
    return null;
  }

  private validateKeterangan(value: any): Keterangan | null {
    if (!value || typeof value !== 'string') return null;

    const upperValue = value.toUpperCase().trim();
    const validValues = Object.values(Keterangan);

    if (validValues.includes(upperValue as Keterangan)) {
      return upperValue as Keterangan;
    }

    console.warn(`Invalid Keterangan value: "${value}". Valid values are: ${validValues.join(', ')}`);
    return null;
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
      where.OR = [
        { nomorNcx: { contains: query.search.trim(), mode: Prisma.QueryMode.insensitive } },
        { namaPelanggan: { contains: query.search.trim(), mode: Prisma.QueryMode.insensitive } },
        { masterData: { idKendala: { contains: query.search.trim(), mode: Prisma.QueryMode.insensitive } } },
      ];
    }

    if (query.statusJt && query.statusJt.trim() && query.statusJt.trim().toLowerCase() !== 'all') {
      where.statusJt = {
        equals: query.statusJt.trim() as StatusJt,
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
          masterData: true,
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
      jenisKendala: master.jenisKendala ?? null,
      pltTemuan: master.planTematik ?? null,
      rabHldSummary: master.rabHld ? Number(master.rabHld) : null,
      ihld: master.ihldValue ? Number(master.ihldValue) : null,
      statusUsulan: master.statusUsulan ?? null,
      statusIhld: master.statusIhld ?? null,
      idEprop: master.idEprop ?? null,
      statusInstalasi: master.statusInstalasi ?? null,
      keterangan: master.keterangan ?? null,
      newSc: master.newSc ?? null,
      statusJt: item.statusJt ?? null,
      c2r: item.c2r ? Number(item.c2r) : null,
      nomorNcx: item.nomorNcx ?? null,
      alamat: item.alamatInstalasi ?? null,
      jenisLayanan: item.jenisLayanan ?? null,
      nilaiKontrak: item.nilaiKontrak ? BigInt(item.nilaiKontrak.toString()) : null,
      ihldLop: item.ihldLopId ?? null,
      planTematik: item.planTematik ?? master.planTematik ?? null,
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
        masterData: true,
      },
    });

    if (!survey) return null;

    return this.mapToSurvey(survey);
  }

  async findSurveyByNomorNc(nomorNcx: string): Promise<Survey | null> {
    const survey = await this.prisma.ndeUsulanB2B.findFirst({
      where: { nomorNcx: nomorNcx },
      include: {
        masterData: true,
      },
    });

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
        masterData: true,
      },
    });

    return this.mapToSurvey(survey);
  }

  async updateSurvey(nomorNcx: string, data: UpdateSurveyDto): Promise<Survey> {
    const existing = await this.prisma.ndeUsulanB2B.findFirst({
      where: { nomorNcx: nomorNcx },
      include: { masterData: true },
    });

    if (!existing) {
      throw new Error(`Data dengan nomor NCX/Starclick ${nomorNcx} tidak ditemukan`);
    }

    // Prepare update data for NDE USULAN B2B
    const updateData: any = {};
    if (data.statusJt !== undefined) updateData.statusJt = data.statusJt;
    if (data.c2r !== undefined) updateData.c2r = data.c2r !== null ? new Prisma.Decimal(data.c2r.toString()) : null;
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
    
    // Field baru untuk sync status
    if (data.statusUsulan !== undefined) updateData.statusUsulan = data.statusUsulan;
    if (data.statusInstalasi !== undefined) updateData.statusInstalasi = data.statusInstalasi;

    // LOGIC BARU: Sync status antara kedua tabel dalam transaction
    const survey = await this.prisma.$transaction(async (tx) => {
      // Update NDE USULAN B2B
      const updatedSurvey = await tx.ndeUsulanB2B.update({
        where: { id: existing.id },
        data: updateData,
        include: {
          masterData: true,
        },
      });

      // Sync status ke NEW BGES B2B jika status berubah
      if (data.statusJt !== undefined || data.statusUsulan !== undefined || data.statusInstalasi !== undefined) {
        const masterUpdateData: any = {
          lastSyncAt: new Date(),
        };

        // Sync status dari NDE USULAN B2B ke NEW BGES B2B
        if (data.statusUsulan !== undefined) {
          masterUpdateData.statusUsulan = this.validateStatusUsulan(data.statusUsulan);
        }
        if (data.statusInstalasi !== undefined) {
          masterUpdateData.statusInstalasi = this.validateStatusInstalasi(data.statusInstalasi);
        }

        // Update master data jika ada perubahan status
        if (Object.keys(masterUpdateData).length > 1) { // lebih dari lastSyncAt
          await tx.newBgesB2BOlo.update({
            where: { idKendala: existing.nomorNcx },
            data: masterUpdateData,
          });
          console.log(`Synced status from NDE USULAN B2B to NEW BGES B2B for ${existing.nomorNcx}`);
        }
      }

      return updatedSurvey;
    });

    return this.mapToSurvey(survey);
  }

  async deleteSurvey(nomorNcx: string): Promise<void> {
    const existing = await this.prisma.ndeUsulanB2B.findFirst({
      where: { nomorNcx: nomorNcx },
    });

    if (!existing) {
      throw new Error(`Data dengan nomor NCX/Starclick ${nomorNcx} tidak ditemukan`);
    }

    await this.prisma.ndeUsulanB2B.delete({
      where: { id: existing.id },
    });
  }

  // Method baru untuk update tanggal input di NEW BGES B2B dengan format mm/dd/yyyy
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

  // Method untuk ambil data lengkap master data
  async getMasterDataByIdKendala(idKendala: string): Promise<any | null> {
    const masterData = await this.prisma.newBgesB2BOlo.findUnique({
      where: { idKendala: idKendala.trim() },
    });

    if (!masterData) {
      return null;
    }

    // Convert ke format yang sesuai dengan NewBgesB2BOloRow
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
      jenisKendala: masterData.jenisKendala,
      planTematik: masterData.planTematik,
      rabHld: masterData.rabHld,
      ihldValue: masterData.ihldValue,
      statusUsulan: masterData.statusUsulan,
      statusIhld: masterData.statusIhld,
      idEprop: masterData.idEprop,
      statusInstalasi: masterData.statusInstalasi,
      keterangan: masterData.keterangan,
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
            batch.map((detail) => {
              if (!detail.idKendala || !detail.idKendala.trim()) {
                return Promise.resolve(null);
              }

              const updateData: any = {
                syncStatus: 'SYNCED',
                lastSyncAt: new Date(),
              };
              const createData: any = {
                idKendala: detail.idKendala.trim(),
                syncStatus: 'SYNCED',
                lastSyncAt: new Date(),
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
              if (detail.jenisKendala !== undefined) {
                const validJenisKendala = this.validateJenisKendala(detail.jenisKendala);
                updateData.jenisKendala = validJenisKendala;
                createData.jenisKendala = validJenisKendala;
                if (detail.jenisKendala && !validJenisKendala) {
                  console.warn(`Invalid JenisKendala for record idKendala: ${detail.idKendala}, value: "${detail.jenisKendala}"`);
                }
              }
              if (detail.planTematik !== undefined) {
                const validPlanTematik = this.validatePlanTematik(detail.planTematik);
                updateData.planTematik = validPlanTematik;
                createData.planTematik = validPlanTematik;
                if (detail.planTematik && !validPlanTematik) {
                  console.warn(`Invalid PlanTematik for record idKendala: ${detail.idKendala}, value: "${detail.planTematik}"`);
                }
              }
              if (detail.rabHld !== undefined) {
                updateData.rabHld = detail.rabHld !== null ? new Prisma.Decimal(detail.rabHld.toString()) : null;
                createData.rabHld = detail.rabHld !== null ? new Prisma.Decimal(detail.rabHld.toString()) : null;
              }
              if (detail.ihldValue !== undefined) {
                updateData.ihldValue = detail.ihldValue ?? null;
                createData.ihldValue = detail.ihldValue ?? null;
              }
              if (detail.statusUsulan !== undefined) {
                updateData.statusUsulan = detail.statusUsulan ?? null;
                createData.statusUsulan = detail.statusUsulan ?? null;
              }
              if (detail.statusIhld !== undefined) {
                updateData.statusIhld = detail.statusIhld ?? null;
                createData.statusIhld = detail.statusIhld ?? null;
              }
              if (detail.idEprop !== undefined) {
                updateData.idEprop = detail.idEprop ?? null;
                createData.idEprop = detail.idEprop ?? null;
              }
              if (detail.statusInstalasi !== undefined) {
                updateData.statusInstalasi = detail.statusInstalasi ?? null;
                createData.statusInstalasi = detail.statusInstalasi ?? null;
              }
              if (detail.keterangan !== undefined) {
                const validKeterangan = this.validateKeterangan(detail.keterangan);
                updateData.keterangan = validKeterangan;
                createData.keterangan = validKeterangan;
                if (detail.keterangan && !validKeterangan) {
                  console.warn(`Invalid Keterangan for record idKendala: ${detail.idKendala}, value: "${detail.keterangan}"`);
                }
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
    const BATCH_SIZE = 25; // Smaller batches for reliability
    const MAX_EXECUTION_TIME = 8500; // 8.5 seconds max - leave buffer for response
    const startTime = Date.now();

    let stats = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      batchesProcessed: 0,
    };

    try {
      console.log(`Starting optimized auto sync: ${detailData.length} detail + ${summaryData.length} summary records`);

      // Step 1: Process detail data first (master data NEW BGES B2B & OLO)
      if (detailData.length > 0) {
        console.log(`Processing ${detailData.length} detail records...`);
        const detailRows = detailData as NewBgesB2BOloRow[];

        for (let i = 0; i < detailRows.length; i += BATCH_SIZE) {
          if (Date.now() - startTime > MAX_EXECUTION_TIME) {
            console.warn(`Timeout approaching, stopping detail processing at batch ${Math.floor(i / BATCH_SIZE) + 1}`);
            break;
          }

          const batch = detailRows.slice(i, i + BATCH_SIZE);
          stats.batchesProcessed++;

          try {
            await this.prisma.$transaction(
              async (tx) => {
                const operations = batch.map(async (detail) => {
                  if (!detail.idKendala || !detail.idKendala.trim()) {
                    stats.skipped++;
                    return null;
                  }

                  try {
                    const result = await tx.newBgesB2BOlo.upsert({
                      where: { idKendala: detail.idKendala.trim() },
                      update: {
                        syncStatus: 'SYNCED',
                        lastSyncAt: new Date(),
                        // Update tanggal input jika ada di sheet, format mm/dd/yyyy
                        tglInputUsulan: detail.tglInputUsulan ?? undefined,
                        umur: detail.umur ?? null,
                        bln: detail.bln ?? null,
                        jenisOrder: detail.jenisOrder ?? null,
                        datel: detail.datel ?? null,
                        sto: detail.sto ?? null,
                        namaPelanggan: detail.namaPelanggan ?? null,
                        latitude: detail.latitude ?? null,
                        longitude: detail.longitude ?? null,
                        jenisKendala: this.validateJenisKendala(detail.jenisKendala),
                        planTematik: this.validatePlanTematik(detail.planTematik),
                        rabHld: detail.rabHld !== null && detail.rabHld !== undefined ? new Prisma.Decimal(detail.rabHld.toString()) : null,
                        ihldValue: detail.ihldValue ?? null,
                        statusUsulan: this.validateStatusUsulan(detail.statusUsulan),
                        statusIhld: detail.statusIhld ?? null,
                        statusInstalasi: this.validateStatusInstalasi(detail.statusInstalasi),
                        keterangan: this.validateKeterangan(detail.keterangan),
                      },
                      create: {
                        idKendala: detail.idKendala.trim(),
                        syncStatus: 'SYNCED',
                        lastSyncAt: new Date(),
                        // Tanggal input kosong saat create, bisa diedit nanti
                        tglInputUsulan: detail.tglInputUsulan ?? null,
                        umur: detail.umur ?? null,
                        bln: detail.bln ?? null,
                        jenisOrder: detail.jenisOrder ?? null,
                        datel: detail.datel ?? null,
                        sto: detail.sto ?? null,
                        namaPelanggan: detail.namaPelanggan ?? null,
                        latitude: detail.latitude ?? null,
                        longitude: detail.longitude ?? null,
                        jenisKendala: this.validateJenisKendala(detail.jenisKendala),
                        planTematik: this.validatePlanTematik(detail.planTematik),
                        rabHld: detail.rabHld !== null && detail.rabHld !== undefined ? new Prisma.Decimal(detail.rabHld.toString()) : null,
                        ihldValue: detail.ihldValue ?? null,
                        statusUsulan: this.validateStatusUsulan(detail.statusUsulan),
                        statusIhld: detail.statusIhld ?? null,
                        statusInstalasi: this.validateStatusInstalasi(detail.statusInstalasi),
                        keterangan: this.validateKeterangan(detail.keterangan),
                      },
                    });
                    stats.created++;
                    return result;
                  } catch (error: any) {
                    if (error.code === 'P2002') {
                      stats.updated++;
                    } else {
                      stats.errors++;
                    }
                    return null;
                  }
                });

                await Promise.all(operations);
              },
              {
                maxWait: 3000,
                timeout: 5000,
              }
            );
          } catch (batchError) {
            console.error(`Error processing detail batch:`, batchError);
            stats.errors += batch.length;
          }
        }
      }

      // Step 2: Process summary data (NDE USULAN B2B) - LOGIC BARU
      if (summaryData.length > 0 && Date.now() - startTime < MAX_EXECUTION_TIME) {
        console.log(`Processing ${summaryData.length} summary records with new logic...`);
        const summaryRows = summaryData as NdeUsulanB2BRow[];

        for (let i = 0; i < summaryRows.length; i += BATCH_SIZE) {
          if (Date.now() - startTime > MAX_EXECUTION_TIME) {
            console.warn(`Timeout approaching, stopping summary processing at batch ${Math.floor(i / BATCH_SIZE) + 1}`);
            break;
          }

          const batch = summaryRows.slice(i, i + BATCH_SIZE);
          stats.batchesProcessed++;

          try {
            await this.prisma.$transaction(
              async (tx) => {
                const operations = batch.map(async (summary) => {
                  const nomorNcx = summary.nomorNcx || (summary as any).nomorNc;
                  const no = summary.no || (summary as any).NO;

                  if (!no || !nomorNcx || !String(nomorNcx).trim()) {
                    stats.skipped++;
                    return null;
                  }

                  try {
                    // LOGIC BARU: Cek apakah ada di NEW BGES B2B, jika tidak ada tetap sync
                    const existingMaster = await tx.newBgesB2BOlo.findUnique({
                      where: { idKendala: String(nomorNcx).trim() }
                    });

                    // Jika tidak ada di NEW BGES B2B, buat master data kosong dengan tanggal input null
                    if (!existingMaster) {
                      console.log(`Creating missing master data for nomorNcx: ${nomorNcx}`);
                      await tx.newBgesB2BOlo.create({
                        data: {
                          idKendala: String(nomorNcx).trim(),
                          syncStatus: 'SYNCED',
                          lastSyncAt: new Date(),
                          // Tanggal input kosong, bisa diedit nanti dan masuk ke sheet dengan format mm/dd/yyyy
                          tglInputUsulan: null,
                          // Field lain kosong, akan diisi dari NDE USULAN B2B
                          datel: summary.datel ?? null,
                          sto: summary.sto ?? null,
                          namaPelanggan: summary.namaPelanggan ?? null,
                          latitude: summary.latitude ?? null,
                          longitude: summary.longitude ?? null,
                          planTematik: this.validatePlanTematik(summary.planTematik),
                          rabHld: summary.rabHld !== null && summary.rabHld !== undefined ? new Prisma.Decimal(summary.rabHld.toString()) : null,
                          statusUsulan: this.validateStatusUsulan(summary.statusUsulan),
                          statusInstalasi: this.validateStatusInstalasi(summary.statusInstalasi),
                        }
                      });
                    } else {
                      // Jika ada, sync status dari NDE USULAN B2B ke NEW BGES B2B
                      await tx.newBgesB2BOlo.update({
                        where: { idKendala: String(nomorNcx).trim() },
                        data: {
                          syncStatus: 'SYNCED',
                          lastSyncAt: new Date(),
                          // Sync status dari NDE USULAN B2B
                          statusUsulan: this.validateStatusUsulan(summary.statusUsulan) ?? existingMaster.statusUsulan,
                          statusInstalasi: this.validateStatusInstalasi(summary.statusInstalasi) ?? existingMaster.statusInstalasi,
                          // Update data lain jika kosong di master
                          datel: existingMaster.datel ?? summary.datel ?? null,
                          sto: existingMaster.sto ?? summary.sto ?? null,
                          namaPelanggan: existingMaster.namaPelanggan ?? summary.namaPelanggan ?? null,
                          latitude: existingMaster.latitude ?? summary.latitude ?? null,
                          longitude: existingMaster.longitude ?? summary.longitude ?? null,
                          planTematik: existingMaster.planTematik ?? this.validatePlanTematik(summary.planTematik),
                          rabHld: existingMaster.rabHld ?? (summary.rabHld !== null && summary.rabHld !== undefined ? new Prisma.Decimal(summary.rabHld.toString()) : null),
                        }
                      });
                    }

                    // Upsert NDE USULAN B2B dengan relasi ke master data
                    const result = await tx.ndeUsulanB2B.upsert({
                      where: { nomorNcx: String(nomorNcx).trim() },
                      update: {
                        syncStatus: 'SYNCED',
                        lastSyncAt: new Date(),
                        statusJt: this.validateStatusJt(summary.statusJt),
                        c2r: summary.c2r !== null && summary.c2r !== undefined ? new Prisma.Decimal(summary.c2r.toString()) : null,
                        alamatInstalasi: summary.alamatInstalasi ?? null,
                        jenisLayanan: summary.jenisLayanan ?? null,
                        nilaiKontrak: summary.nilaiKontrak !== null && summary.nilaiKontrak !== undefined ? new Prisma.Decimal(summary.nilaiKontrak.toString()) : null,
                        rabSurvey: summary.rabSurvey !== null && summary.rabSurvey !== undefined ? new Prisma.Decimal(summary.rabSurvey.toString()) : null,
                        nomorNde: summary.nomorNde ?? null,
                        progressJt: summary.progressJt ?? null,
                        namaOdp: summary.namaOdp ?? null,
                        jarakOdp: summary.jarakOdp !== null && summary.jarakOdp !== undefined ? new Prisma.Decimal(summary.jarakOdp.toString()) : null,
                        keterangan: summary.keterangan ?? null,
                        datel: summary.datel ?? null,
                        sto: summary.sto ?? null,
                        namaPelanggan: summary.namaPelanggan ?? null,
                        latitude: summary.latitude ?? null,
                        longitude: summary.longitude ?? null,
                        ihldLopId: summary.ihldLopId ?? null,
                        planTematik: summary.planTematik ?? null,
                        rabHld: summary.rabHld !== null && summary.rabHld !== undefined ? new Prisma.Decimal(summary.rabHld.toString()) : null,
                        statusUsulan: summary.statusUsulan ?? null,
                        statusInstalasi: this.validateStatusInstalasi(summary.statusInstalasi),
                      },
                      create: {
                        no: no,
                        nomorNcx: String(nomorNcx).trim(),
                        syncStatus: 'SYNCED',
                        lastSyncAt: new Date(),
                        statusJt: this.validateStatusJt(summary.statusJt),
                        c2r: summary.c2r !== null && summary.c2r !== undefined ? new Prisma.Decimal(summary.c2r.toString()) : null,
                        alamatInstalasi: summary.alamatInstalasi ?? null,
                        jenisLayanan: summary.jenisLayanan ?? null,
                        nilaiKontrak: summary.nilaiKontrak !== null && summary.nilaiKontrak !== undefined ? new Prisma.Decimal(summary.nilaiKontrak.toString()) : null,
                        rabSurvey: summary.rabSurvey !== null && summary.rabSurvey !== undefined ? new Prisma.Decimal(summary.rabSurvey.toString()) : null,
                        nomorNde: summary.nomorNde ?? null,
                        progressJt: summary.progressJt ?? null,
                        namaOdp: summary.namaOdp ?? null,
                        jarakOdp: summary.jarakOdp !== null && summary.jarakOdp !== undefined ? new Prisma.Decimal(summary.jarakOdp.toString()) : null,
                        keterangan: summary.keterangan ?? null,
                        datel: summary.datel ?? null,
                        sto: summary.sto ?? null,
                        namaPelanggan: summary.namaPelanggan ?? null,
                        latitude: summary.latitude ?? null,
                        longitude: summary.longitude ?? null,
                        ihldLopId: summary.ihldLopId ?? null,
                        planTematik: summary.planTematik ?? null,
                        rabHld: summary.rabHld !== null && summary.rabHld !== undefined ? new Prisma.Decimal(summary.rabHld.toString()) : null,
                        statusUsulan: summary.statusUsulan ?? null,
                        statusInstalasi: this.validateStatusInstalasi(summary.statusInstalasi),
                      },
                    });
                    stats.created++;
                    return result;
                  } catch (error: any) {
                    if (error.code === 'P2002') {
                      stats.updated++;
                    } else {
                      console.error(`Error processing summary ${nomorNcx}:`, error);
                      stats.errors++;
                    }
                    return null;
                  }
                });

                await Promise.all(operations);
              },
              {
                maxWait: 3000,
                timeout: 5000,
              }
            );
          } catch (batchError) {
            console.error(`Error processing summary batch:`, batchError);
            stats.errors += batch.length;
          }
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`Optimized auto sync completed in ${totalTime}ms:`, stats);

      return stats;
    } catch (error) {
      console.error('Error in optimized auto sync:', error);
      throw error;
    }
  }
}