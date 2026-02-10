// Simple sync - upsert all records (create or update automatically)
import { Prisma } from '../../../generated/prisma/client.js';
import type { EnumType } from '../application/enum-value.service.js';

export async function simpleSyncFromSheets(
  prisma: any,
  enumValueService: any,
  summaryData: any[],
  detailData: any[]
): Promise<{
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  errors: number;
}> {
  const startTime = Date.now();
  const stats = {
    created: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    console.log(`Starting simple sync: ${detailData.length} detail + ${summaryData.length} summary records from sheets`);

    // Get existing IDs to track created vs updated
    const [existingDetails, existingSummaries] = await Promise.all([
      prisma.newBgesB2BOlo.findMany({ select: { idKendala: true } }),
      prisma.ndeUsulanB2B.findMany({ select: { nomorNcx: true } })
    ]);

    const existingDetailIds = new Set(existingDetails.map((d: any) => d.idKendala));
    const existingSummaryIds = new Set(existingSummaries.map((s: any) => s.nomorNcx));

    // PRE-PROCESS: Resolve all enum IDs in parallel
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
        console.warn(`Failed to resolve enum ${enumType}.${value}`);
        enumCache.set(cacheKey, null);
        return null;
      }
    };

    console.log('Pre-resolving enums...');
    const enumPromises: Promise<any>[] = [];
    
    for (const detail of detailData) {
      if (detail.jenisKendala) enumPromises.push(resolveEnumId('JenisKendala', detail.jenisKendala));
      if (detail.planTematik) enumPromises.push(resolveEnumId('PlanTematik', detail.planTematik));
      if (detail.statusUsulan) enumPromises.push(resolveEnumId('StatusUsulan', detail.statusUsulan));
      if (detail.statusInstalasi) enumPromises.push(resolveEnumId('StatusInstalasi', detail.statusInstalasi));
      if (detail.keterangan) enumPromises.push(resolveEnumId('Keterangan', detail.keterangan));
    }
    
    for (const summary of summaryData) {
      if (summary.statusJt) enumPromises.push(resolveEnumId('StatusJt', summary.statusJt));
      if (summary.statusInstalasi) enumPromises.push(resolveEnumId('StatusInstalasi', summary.statusInstalasi));
    }
    
    await Promise.all(enumPromises);
    console.log(`Pre-resolved ${enumCache.size} unique enum values`);

    // PROCESS DETAIL DATA with upsert
    if (detailData.length > 0) {
      console.log(`Processing ${detailData.length} detail records...`);
      const BATCH_SIZE = 10;

      for (let i = 0; i < detailData.length; i += BATCH_SIZE) {
        const batch = detailData.slice(i, i + BATCH_SIZE);

        try {
          await prisma.$transaction(
            async (tx: any) => {
              for (const detail of batch) {
                if (!detail.idKendala || !detail.idKendala.trim()) {
                  stats.skipped++;
                  continue;
                }

                try {
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
                  
                  if (existingDetailIds.has(detail.idKendala.trim())) {
                    stats.updated++;
                  } else {
                    stats.created++;
                  }
                } catch (error: any) {
                  console.error(`Error upserting detail ${detail.idKendala}:`, error.message);
                  stats.errors++;
                }
              }
            },
            { maxWait: 5000, timeout: 15000 }
          );
        } catch (batchError) {
          console.error(`Error processing detail batch:`, batchError);
          stats.errors += batch.length;
        }
      }
    }

    // PROCESS SUMMARY DATA with upsert
    if (summaryData.length > 0) {
      console.log(`Processing ${summaryData.length} summary records...`);
      const BATCH_SIZE = 10;

      for (let i = 0; i < summaryData.length; i += BATCH_SIZE) {
        const batch = summaryData.slice(i, i + BATCH_SIZE);

        try {
          await prisma.$transaction(
            async (tx: any) => {
              for (const summary of batch) {
                const nomorNcx = (summary.nomorNcx || summary.nomorNc)?.trim();
                const no = (summary.no || summary.NO);

                if (!no || !nomorNcx) {
                  stats.skipped++;
                  continue;
                }

                try {
                  // Ensure master exists
                  const existingMaster = await tx.newBgesB2BOlo.findUnique({
                    where: { idKendala: nomorNcx },
                    select: { idKendala: true }
                  });

                  if (!existingMaster) {
                    console.warn(`Master data not found for ${nomorNcx}, skipping summary`);
                    stats.skipped++;
                    continue;
                  }

                  const statusJtId = enumCache.get(`StatusJt:${summary.statusJt}`);
                  const statusInstalasiId = enumCache.get(`StatusInstalasi:${summary.statusInstalasi}`);

                  await tx.ndeUsulanB2B.upsert({
                    where: { nomorNcx: nomorNcx },
                    update: {
                      syncStatus: 'SYNCED',
                      lastSyncAt: new Date(),
                      statusJtId: statusJtId ?? undefined,
                      statusInstalasiId: statusInstalasiId ?? undefined,
                      c2r: summary.c2r !== null && summary.c2r !== undefined ? new Prisma.Decimal(summary.c2r.toString()) : undefined,
                      alamatInstalasi: summary.alamatInstalasi ?? undefined,
                      jenisLayanan: summary.jenisLayanan ?? undefined,
                      nilaiKontrak: summary.nilaiKontrak !== null && summary.nilaiKontrak !== undefined ? new Prisma.Decimal(summary.nilaiKontrak.toString()) : undefined,
                      rabSurvey: summary.rabSurvey !== null && summary.rabSurvey !== undefined ? new Prisma.Decimal(summary.rabSurvey.toString()) : undefined,
                      nomorNde: summary.nomorNde ?? undefined,
                      progressJt: summary.progressJt ?? undefined,
                      namaOdp: summary.namaOdp ?? undefined,
                      jarakOdp: summary.jarakOdp !== null && summary.jarakOdp !== undefined ? new Prisma.Decimal(summary.jarakOdp.toString()) : undefined,
                      keterangan: summary.keterangan ?? undefined,
                      datel: summary.datel ?? undefined,
                      sto: summary.sto ?? undefined,
                      namaPelanggan: summary.namaPelanggan ?? undefined,
                      latitude: summary.latitude ?? undefined,
                      longitude: summary.longitude ?? undefined,
                      ihldLopId: summary.ihldLopId ?? undefined,
                      planTematik: summary.planTematik ?? undefined,
                      rabHld: summary.rabHld !== null && summary.rabHld !== undefined ? new Prisma.Decimal(summary.rabHld.toString()) : undefined,
                      statusUsulan: summary.statusUsulan ?? undefined,
                    },
                    create: {
                      no: no,
                      nomorNcx: nomorNcx,
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
                  
                  if (existingSummaryIds.has(nomorNcx)) {
                    stats.updated++;
                  } else {
                    stats.created++;
                  }
                } catch (error: any) {
                  console.error(`Error upserting summary ${nomorNcx}:`, error.message);
                  stats.errors++;
                }
              }
            },
            { maxWait: 5000, timeout: 15000 }
          );
        } catch (batchError) {
          console.error(`Error processing summary batch:`, batchError);
          stats.errors += batch.length;
        }
      }
    }

    const totalTime = Date.now() - startTime;
    const timeInSeconds = (totalTime / 1000).toFixed(2);
    
    console.log(`✅ Simple sync completed in ${timeInSeconds}s`);
    console.log(`📊 Results: ${stats.created} created, ${stats.updated} updated, ${stats.skipped} skipped, ${stats.errors} errors`);

    return stats;
  } catch (error) {
    console.error('Error in simple sync:', error);
    throw error;
  }
}
