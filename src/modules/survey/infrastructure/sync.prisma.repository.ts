import prisma from '../../../infrastructure/database/prisma.js';
import { Prisma, StatusJt } from '../../../generated/prisma/client.js';
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

    if (query.statusJt && query.statusJt.trim()) {
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
      prisma.ndeUsulanB2B.findMany({
        where,
        include: {
          masterData: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ndeUsulanB2B.count({ where }),
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
    const survey = await prisma.ndeUsulanB2B.findUnique({
      where: { no },
      include: {
        masterData: true,
      },
    });

    if (!survey) return null;

    return this.mapToSurvey(survey);
  }

  async findSurveyByNomorNc(nomorNcx: string): Promise<Survey | null> {
    const survey = await prisma.ndeUsulanB2B.findFirst({
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
  
    const masterExists = await prisma.newBgesB2BOlo.findUnique({
      where: { idKendala: String(nomorNcx).trim() },
      select: { idKendala: true },
    });
  
    if (!masterExists) {
      throw new Error(
        `Master data (Sheet 2) untuk nomorNcx "${String(nomorNcx).trim()}" tidak ditemukan. ` +
        `Silakan sync Sheet 2 terlebih dahulu atau pastikan data sudah ada.`
      );
    }
  
    const survey = await prisma.ndeUsulanB2B.create({
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
    const existing = await prisma.ndeUsulanB2B.findFirst({
      where: { nomorNcx: nomorNcx },
      include: { masterData: true },
    });

    if (!existing) {
      throw new Error(`Data dengan nomor NCX/Starclick ${nomorNcx} tidak ditemukan`);
    }

    const updateData: any = {};
    if (data.statusJt !== undefined) updateData.statusJt = data.statusJt;
    if (data.c2r !== undefined) updateData.c2r = data.c2r !== null ? new Prisma.Decimal(data.c2r.toString()) : null;
    if (data.nomorNcx !== undefined) {
      if (data.nomorNcx === null || data.nomorNcx === '') {
        throw new Error('Field "nomorNcx" tidak boleh kosong (relasi master data wajib)');
      }
      const masterExists = await prisma.newBgesB2BOlo.findUnique({
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

    const survey = await prisma.ndeUsulanB2B.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        masterData: true,
      },
    });

    return this.mapToSurvey(survey);
  }

  async deleteSurvey(nomorNcx: string): Promise<void> {
    const existing = await prisma.ndeUsulanB2B.findFirst({
      where: { nomorNcx: nomorNcx },
    });

    if (!existing) {
      throw new Error(`Data dengan nomor NCX/Starclick ${nomorNcx} tidak ditemukan`);
    }

    await prisma.ndeUsulanB2B.delete({
      where: { id: existing.id },
    });
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
      await prisma.$transaction(
        async (tx) => {
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
                updateData.jenisKendala = detail.jenisKendala ?? null;
                createData.jenisKendala = detail.jenisKendala ?? null;
              }
              if (detail.planTematik !== undefined) {
                updateData.planTematik = detail.planTematik ?? null;
                createData.planTematik = detail.planTematik ?? null;
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
                updateData.keterangan = detail.keterangan ?? null;
                createData.keterangan = detail.keterangan ?? null;
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

      const masterExists = await prisma.newBgesB2BOlo.findUnique({
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
      await prisma.$transaction(
        async (tx) => {
          await Promise.all(
            batch.map((summary) => {
              const nomorNcx = summary.nomorNcx || (summary as any).nomorNc;
              const no = summary.no || (summary as any).NO;

              const updateData: any = {
                syncStatus: 'SYNCED',
                lastSyncAt: new Date(),
              };
              updateData.no = no;
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

              if (summary.statusJt !== undefined) {
                updateData.statusJt = summary.statusJt ?? null;
                createData.statusJt = summary.statusJt ?? null;
              }
              if (summary.c2r !== undefined) {
                updateData.c2r = summary.c2r !== null ? new Prisma.Decimal(summary.c2r.toString()) : null;
                createData.c2r = summary.c2r !== null ? new Prisma.Decimal(summary.c2r.toString()) : null;
              }
              if (summary.alamatInstalasi !== undefined) {
                updateData.alamatInstalasi = summary.alamatInstalasi ?? null;
                createData.alamatInstalasi = summary.alamatInstalasi ?? null;
              }
              if (summary.jenisLayanan !== undefined) {
                updateData.jenisLayanan = summary.jenisLayanan ?? null;
                createData.jenisLayanan = summary.jenisLayanan ?? null;
              }
              if (summary.nilaiKontrak !== undefined) {
                updateData.nilaiKontrak = summary.nilaiKontrak !== null ? new Prisma.Decimal(summary.nilaiKontrak.toString()) : null;
                createData.nilaiKontrak = summary.nilaiKontrak !== null ? new Prisma.Decimal(summary.nilaiKontrak.toString()) : null;
              }
              if (summary.rabSurvey !== undefined) {
                updateData.rabSurvey = summary.rabSurvey !== null ? new Prisma.Decimal(summary.rabSurvey.toString()) : null;
                createData.rabSurvey = summary.rabSurvey !== null ? new Prisma.Decimal(summary.rabSurvey.toString()) : null;
              }
              if (summary.nomorNde !== undefined) {
                updateData.nomorNde = summary.nomorNde ?? null;
                createData.nomorNde = summary.nomorNde ?? null;
              }
              if (summary.progressJt !== undefined) {
                updateData.progressJt = summary.progressJt ?? null;
                createData.progressJt = summary.progressJt ?? null;
              }
              if (summary.namaOdp !== undefined) {
                updateData.namaOdp = summary.namaOdp ?? null;
                createData.namaOdp = summary.namaOdp ?? null;
              }
              if (summary.jarakOdp !== undefined) {
                updateData.jarakOdp = summary.jarakOdp !== null ? new Prisma.Decimal(summary.jarakOdp.toString()) : null;
                createData.jarakOdp = summary.jarakOdp !== null ? new Prisma.Decimal(summary.jarakOdp.toString()) : null;
              }
              if (summary.keterangan !== undefined) {
                updateData.keterangan = summary.keterangan ?? null;
                createData.keterangan = summary.keterangan ?? null;
              }

              if (summary.datel !== undefined) {
                updateData.datel = summary.datel ?? null;
                createData.datel = summary.datel ?? null;
              }
              if (summary.sto !== undefined) {
                updateData.sto = summary.sto ?? null;
                createData.sto = summary.sto ?? null;
              }
              if (summary.namaPelanggan !== undefined) {
                updateData.namaPelanggan = summary.namaPelanggan ?? null;
                createData.namaPelanggan = summary.namaPelanggan ?? null;
              }
              if (summary.latitude !== undefined) {
                updateData.latitude = summary.latitude ?? null;
                createData.latitude = summary.latitude ?? null;
              }
              if (summary.longitude !== undefined) {
                updateData.longitude = summary.longitude ?? null;
                createData.longitude = summary.longitude ?? null;
              }
              if (summary.ihldLopId !== undefined) {
                updateData.ihldLopId = summary.ihldLopId ?? null;
                createData.ihldLopId = summary.ihldLopId ?? null;
              }
              if (summary.planTematik !== undefined) {
                updateData.planTematik = summary.planTematik ?? null;
                createData.planTematik = summary.planTematik ?? null;
              }
              if (summary.rabHld !== undefined) {
                updateData.rabHld = summary.rabHld !== null ? new Prisma.Decimal(summary.rabHld.toString()) : null;
                createData.rabHld = summary.rabHld !== null ? new Prisma.Decimal(summary.rabHld.toString()) : null;
              }
              if (summary.statusUsulan !== undefined) {
                updateData.statusUsulan = summary.statusUsulan ?? null;
                createData.statusUsulan = summary.statusUsulan ?? null;
              }
              if (summary.statusInstalasi !== undefined) {
                updateData.statusInstalasi = summary.statusInstalasi ?? null;
                createData.statusInstalasi = summary.statusInstalasi ?? null;
              }

              
              console.log('Upserting NdeUsulanB2B with data:', {
                where: { no: no },
                updateFields: Object.keys(updateData),
                createFields: Object.keys(createData),
                nomorNcx: String(nomorNcx).trim()
              });

              return tx.ndeUsulanB2B.upsert({
                where: { nomorNcx: String(nomorNcx).trim() },
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

    console.log('Step 2 completed: Related data synced successfully');

    if (invalidSummaryRows.length > 0) {
      console.warn(`Warning: ${invalidSummaryRows.length} records were skipped due to missing master data`);
    }
  }
}