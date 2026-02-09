// Optimized sync method - pre-process enums outside transaction
import { Prisma } from '../../../generated/prisma/client.js';
import type { EnumType } from '../application/enum-value.service.js';

export async function autoSyncFromSheetsOptimized(
  prisma: any,
  enumValueService: any,
  summaryData: any[],
  detailData: any[]
): Promise<{
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  batchesProcessed: number;
}> {
  const BATCH_SIZE = 20; // Increased batch size
  const MAX_EXECUTION_TIME = 50000; // 50 seconds for safety
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

    // PRE-PROCESS: Resolve all enum IDs BEFORE transactions
    const enumCache = new Map<string, string | null>();
    
    const resolveEnumId = async (enumType: EnumType, value: string | null): Promise<string | null> => {
      if (!value || value.trim() === '-') return null;
      
      const cacheKey = `${enumType}:${value}`;
      if (enumCache.has(cacheKey)) {
        return enumCache.get(cacheKey)!;
      }
      
      try {
        const id = await enumValueService.findOrCreateEnumValue(enumType, value);
        enumCache.set(cacheKey, id);
        return id;
      } catch (error) {
        console.warn(`Failed to resolve enum ${enumType}.${value}:`, error);
        enumCache.set(cacheKey, null);
        return null;
      }
    };

    // Pre-resolve all enums from detail data
    if (detailData.length > 0) {
      console.log('Pre-resolving enums from detail data...');
      const enumPromises: Promise<any>[] = [];
      
      for (const detail of detailData) {
        if (detail.jenisKendala) enumPromises.push(resolveEnumId('JenisKendala', detail.jenisKendala));
        if (detail.planTematik) enumPromises.push(resolveEnumId('PlanTematik', detail.planTematik));
        if (detail.statusUsulan) enumPromises.push(resolveEnumId('StatusUsulan', detail.statusUsulan));
        if (detail.statusInstalasi) enumPromises.push(resolveEnumId('StatusInstalasi', detail.statusInstalasi));
        if (detail.keterangan) enumPromises.push(resolveEnumId('Keterangan', detail.keterangan));
      }
      
      await Promise.all(enumPromises);
      console.log(`Pre-resolved ${enumCache.size} unique enum values`);
    }

    // Pre-resolve enums from summary data
    if (summaryData.length > 0) {
      console.log('Pre-resolving enums from summary data...');
      const enumPromises: Promise<any>[] = [];
      
      for (const summary of summaryData) {
        if (summary.statusJt) enumPromises.push(resolveEnumId('StatusJt', summary.statusJt));
        if (summary.statusInstalasi) enumPromises.push(resolveEnumId('StatusInstalasi', summary.statusInstalasi));
        if (summary.jenisKendala) enumPromises.push(resolveEnumId('JenisKendala', summary.jenisKendala));
        if (summary.planTematik) enumPromises.push(resolveEnumId('PlanTematik', summary.planTematik));
        if (summary.statusUsulan) enumPromises.push(resolveEnumId('StatusUsulan', summary.statusUsulan));
        if (summary.keterangan) enumPromises.push(resolveEnumId('Keterangan', summary.keterangan));
      }
      
      await Promise.all(enumPromises);
      console.log(`Total ${enumCache.size} unique enum values cached`);
    }

    // PROCESS DETAIL DATA (Master data)
    if (detailData.length > 0) {
      console.log(`Processing ${detailData.length} detail records...`);

      for (let i = 0; i < detailData.length; i += BATCH_SIZE) {
        if (Date.now() - startTime > MAX_EXECUTION_TIME) {
          console.warn(`Timeout approaching, stopping detail processing at batch ${Math.floor(i / BATCH_SIZE) + 1}`);
          break;
        }

        const batch = detailData.slice(i, i + BATCH_SIZE);
        stats.batchesProcessed++;

        try {
          await prisma.$transaction(
            async (tx: any) => {
              for (const detail of batch) {
                if (!detail.idKendala || !detail.idKendala.trim()) {
                  stats.skipped++;
                  continue;
                }

                try {
                  // Use cached enum IDs (no async calls in transaction)
                  const enumFields: any = {};
                  
                  const jenisKendalaId = enumCache.get(`JenisKendala:${detail.jenisKendala}`);
                  if (jenisKendalaId) enumFields.jenisKendala = { connect: { id: jenisKendalaId } };
                  
                  const planTematikId = enumCache.get(`PlanTematik:${detail.planTematik}`);
                  if (planTematikId) enumFields.planTematik = { connect: { id: planTematikId } };
                  
                  const statusUsulanId = enumCache.get(`StatusUsulan:${detail.statusUsulan}`);
                  if (statusUsulanId) enumFields.statusUsulan = { connect: { id: statusUsulanId } };
                  
                  const statusInstalasiId = enumCache.get(`StatusInstalasi:${detail.statusInstalasi}`);
                  if (statusInstalasiId) enumFields.statusInstalasi = { connect: { id: statusInstalasiId } };
                  
                  const keteranganId = enumCache.get(`Keterangan:${detail.keterangan}`);
                  if (keteranganId) enumFields.keterangan = { connect: { id: keteranganId } };

                  await tx.newBgesB2BOlo.upsert({
                    where: { idKendala: detail.idKendala.trim() },
                    update: {
                      syncStatus: 'SYNCED',
                      lastSyncAt: new Date(),
                      tglInputUsulan: detail.tglInputUsulan ?? undefined,
                      umur: detail.umur ?? undefined,
                      bln: detail.bln ?? undefined,
                      jenisOrder: detail.jenisOrder ?? undefined,
                      datel: detail.datel ?? undefined,
                      sto: detail.sto ?? undefined,
                      namaPelanggan: detail.namaPelanggan ?? undefined,
                      latitude: detail.latitude ?? undefined,
                      longitude: detail.longitude ?? undefined,
                      ...enumFields,
                      rabHld: detail.rabHld !== null && detail.rabHld !== undefined ? new Prisma.Decimal(detail.rabHld.toString()) : undefined,
                      ihldValue: detail.ihldValue ?? undefined,
                      statusIhld: detail.statusIhld ?? undefined,
                      idEprop: detail.idEprop ?? undefined,
                      newSc: detail.newSc ?? undefined,
                      namaOdp: detail.namaOdp ?? undefined,
                      tglGolive: detail.tglGolive ?? undefined,
                      avai: detail.avai ?? undefined,
                      used: detail.used ?? undefined,
                      isTotal: detail.isTotal ?? undefined,
                      occPercentage: detail.occPercentage !== null && detail.occPercentage !== undefined ? new Prisma.Decimal(detail.occPercentage.toString()) : undefined,
                    },
                    create: {
                      idKendala: detail.idKendala.trim(),
                      syncStatus: 'SYNCED',
                      lastSyncAt: new Date(),
                      tglInputUsulan: detail.tglInputUsulan ?? null,
                      umur: detail.umur ?? null,
                      bln: detail.bln ?? null,
                      jenisOrder: detail.jenisOrder ?? null,
                      datel: detail.datel ?? null,
                      sto: detail.sto ?? null,
                      namaPelanggan: detail.namaPelanggan ?? null,
                      latitude: detail.latitude ?? null,
                      longitude: detail.longitude ?? null,
                      ...enumFields,
                      rabHld: detail.rabHld !== null && detail.rabHld !== undefined ? new Prisma.Decimal(detail.rabHld.toString()) : null,
                      ihldValue: detail.ihldValue ?? null,
                      statusIhld: detail.statusIhld ?? null,
                      idEprop: detail.idEprop ?? null,
                      newSc: detail.newSc ?? null,
                      namaOdp: detail.namaOdp ?? null,
                      tglGolive: detail.tglGolive ?? null,
                      avai: detail.avai ?? null,
                      used: detail.used ?? null,
                      isTotal: detail.isTotal ?? null,
                      occPercentage: detail.occPercentage !== null && detail.occPercentage !== undefined ? new Prisma.Decimal(detail.occPercentage.toString()) : null,
                    },
                  });
                  stats.created++;
                } catch (error: any) {
                  if (error.code === 'P2002') {
                    stats.updated++;
                  } else {
                    stats.errors++;
                  }
                }
              }
            },
            {
              maxWait: 15000,
              timeout: 25000,
            }
          );
        } catch (batchError) {
          console.error(`Error processing detail batch:`, batchError);
          stats.errors += batch.length;
        }
      }
    }

    // PROCESS SUMMARY DATA
    if (summaryData.length > 0 && Date.now() - startTime < MAX_EXECUTION_TIME) {
      console.log(`Processing ${summaryData.length} summary records...`);

      for (let i = 0; i < summaryData.length; i += BATCH_SIZE) {
        if (Date.now() - startTime > MAX_EXECUTION_TIME) {
          console.warn(`Timeout approaching, stopping summary processing at batch ${Math.floor(i / BATCH_SIZE) + 1}`);
          break;
        }

        const batch = summaryData.slice(i, i + BATCH_SIZE);
        stats.batchesProcessed++;

        try {
          await prisma.$transaction(
            async (tx: any) => {
              for (const summary of batch) {
                const nomorNcx = summary.nomorNcx || (summary as any).nomorNc;
                const no = summary.no || (summary as any).NO;

                if (!no || !nomorNcx || !String(nomorNcx).trim()) {
                  stats.skipped++;
                  continue;
                }

                try {
                  // Check if master exists
                  const existingMaster = await tx.newBgesB2BOlo.findUnique({
                    where: { idKendala: String(nomorNcx).trim() },
                    select: { idKendala: true }
                  });

                  // Create master if missing
                  if (!existingMaster) {
                    const masterEnumFields: any = {};
                    
                    const jenisKendalaId = enumCache.get(`JenisKendala:${summary.jenisKendala}`);
                    if (jenisKendalaId) masterEnumFields.jenisKendala = { connect: { id: jenisKendalaId } };
                    
                    const planTematikId = enumCache.get(`PlanTematik:${summary.planTematik}`);
                    if (planTematikId) masterEnumFields.planTematik = { connect: { id: planTematikId } };
                    
                    const statusUsulanId = enumCache.get(`StatusUsulan:${summary.statusUsulan}`);
                    if (statusUsulanId) masterEnumFields.statusUsulan = { connect: { id: statusUsulanId } };
                    
                    const statusInstalasiId = enumCache.get(`StatusInstalasi:${summary.statusInstalasi}`);
                    if (statusInstalasiId) masterEnumFields.statusInstalasi = { connect: { id: statusInstalasiId } };

                    await tx.newBgesB2BOlo.create({
                      data: {
                        idKendala: String(nomorNcx).trim(),
                        syncStatus: 'SYNCED',
                        lastSyncAt: new Date(),
                        tglInputUsulan: null,
                        datel: summary.datel ?? null,
                        sto: summary.sto ?? null,
                        namaPelanggan: summary.namaPelanggan ?? null,
                        latitude: summary.latitude ?? null,
                        longitude: summary.longitude ?? null,
                        ...masterEnumFields,
                        rabHld: summary.rabHld !== null && summary.rabHld !== undefined ? new Prisma.Decimal(summary.rabHld.toString()) : null,
                      }
                    });
                  }

                  // Use cached enum IDs for NDE record
                  const statusJtId = enumCache.get(`StatusJt:${summary.statusJt}`);
                  const statusInstalasiId = enumCache.get(`StatusInstalasi:${summary.statusInstalasi}`);

                  await tx.ndeUsulanB2B.upsert({
                    where: { nomorNcx: String(nomorNcx).trim() },
                    update: {
                      syncStatus: 'SYNCED',
                      lastSyncAt: new Date(),
                      statusJtId: statusJtId ?? undefined,
                      statusInstalasiId: statusInstalasiId ?? undefined,
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
                    },
                    create: {
                      no: no,
                      nomorNcx: String(nomorNcx).trim(),
                      syncStatus: 'SYNCED',
                      lastSyncAt: new Date(),
                      statusJtId: statusJtId ?? null,
                      statusInstalasiId: statusInstalasiId ?? null,
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
                    },
                  });
                  stats.created++;
                } catch (error: any) {
                  if (error.code === 'P2002') {
                    stats.updated++;
                  } else {
                    console.error(`Error processing summary ${nomorNcx}:`, error);
                    stats.errors++;
                  }
                }
              }
            },
            {
              maxWait: 15000,
              timeout: 25000,
            }
          );
        } catch (batchError) {
          console.error(`Error processing summary batch:`, batchError);
          stats.errors += batch.length;
        }
      }
    }

    const totalTime = Date.now() - startTime;
    const timeInSeconds = (totalTime / 1000).toFixed(2);
    
    console.log(`✅ Optimized auto sync completed in ${timeInSeconds}s`);
    console.log(`📊 Results: ${stats.created} created, ${stats.updated} updated, ${stats.skipped} skipped, ${stats.errors} errors`);
    console.log(`📦 Processed ${stats.batchesProcessed} batches`);

    return stats;
  } catch (error) {
    console.error('Error in optimized auto sync:', error);
    throw error;
  }
}
