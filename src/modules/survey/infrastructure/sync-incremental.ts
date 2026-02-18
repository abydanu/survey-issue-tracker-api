
import logger from '@/infrastructure/logging/logger.js';
import { Prisma } from '../../../generated/prisma/client.js';
import type { EnumType } from '../application/enum-value.service.js';

export async function incrementalSyncFromSheets(
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
    logger.info(`Starting incremental sync: ${detailData.length} detail + ${summaryData.length} summary records from sheets`);

    const enumCache = new Map<string, string | null>();
    
    const resolveEnumId = async (enumType: EnumType, value: string | null, displayName?: string | null): Promise<string | null> => {
      if (!value || value.trim() === '-') return null;
      
      const cacheKey = `${enumType}:${value}`;
      if (enumCache.has(cacheKey)) {
        return enumCache.get(cacheKey)!;
      }
      
      try {
        const id = await enumValueService.findOrCreateEnumValue(enumType, value, displayName || undefined);
        enumCache.set(cacheKey, id);
        return id;
      } catch (error) {
        enumCache.set(cacheKey, null);
        return null;
      }
    };

    logger.info('Pre-resolving enums...');
    const enumPromises: Promise<any>[] = [];
    
    for (const detail of detailData) {
      if (detail.jenisKendala) enumPromises.push(resolveEnumId('JenisKendala', detail.jenisKendala, detail.jenisKendalaRaw ?? undefined));
      if (detail.planTematik) enumPromises.push(resolveEnumId('PlanTematik', detail.planTematik, detail.planTematikRaw ?? undefined));
      if (detail.statusUsulan) enumPromises.push(resolveEnumId('StatusUsulan', detail.statusUsulan, detail.statusUsulanRaw ?? undefined));
      if (detail.statusInstalasi) enumPromises.push(resolveEnumId('StatusInstalasi', detail.statusInstalasi, detail.statusInstalasiRaw ?? undefined));
      if (detail.keterangan) enumPromises.push(resolveEnumId('Keterangan', detail.keterangan, detail.keteranganRaw ?? undefined));
    }
    
    for (const summary of summaryData) {
      if (summary.statusJt) enumPromises.push(resolveEnumId('StatusJt', summary.statusJt, summary.statusJtRaw ?? undefined));
      if (summary.statusInstalasi) enumPromises.push(resolveEnumId('StatusInstalasi', summary.statusInstalasi, summary.statusInstalasiRaw ?? undefined));
    }
    
    await Promise.all(enumPromises);
    logger.info(`Pre-resolved ${enumCache.size} unique enum values`);

    logger.info('Fetching existing records...');
    const [existingDetails, existingSummaries] = await Promise.all([
      prisma.newBgesB2BOlo.findMany({
        select: { 
          idKendala: true,
          id: true,
          newSc: true,
          namaPelanggan: true,
        }
      }),
      prisma.ndeUsulanB2B.findMany({
        select: { 
          nomorNcx: true,
          id: true,
        }
      })
    ]);

    const existingDetailIds = new Set(existingDetails.map((d: any) => d.idKendala));
    const existingSummaryIds = new Set(existingSummaries.map((s: any) => s.nomorNcx));
    
    // Build lookup maps for faster resolution
    const newScToIdKendala = new Map<string, string>();
    const customerNameToIdKendala = new Map<string, string>();
    for (const m of existingDetails) {
      if (m.newSc) newScToIdKendala.set(String(m.newSc).trim(), m.idKendala);
      if (m.namaPelanggan) customerNameToIdKendala.set(String(m.namaPelanggan).trim().toLowerCase(), m.idKendala);
    }

    
    logger.info(`Processing ${detailData.length} detail records...`);
      const BATCH_SIZE = 200; // Increased from 100

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

                  const result = await tx.newBgesB2BOlo.upsert({
                    where: { idKendala: detail.idKendala.trim() },
                    update: {
                      syncStatus: 'SYNCED',
                      lastSyncAt: new Date(),
                      tglInputUsulan: detail.tglInputUsulan !== undefined ? detail.tglInputUsulan : undefined,
                      umur: detail.umur !== undefined ? detail.umur : undefined,
                      bln: detail.bln !== undefined ? detail.bln : undefined,
                      jenisOrder: detail.jenisOrder !== undefined ? detail.jenisOrder : undefined,
                      datel: detail.datel !== undefined ? detail.datel : undefined,
                      sto: detail.sto !== undefined ? detail.sto : undefined,
                      namaPelanggan: detail.namaPelanggan !== undefined ? detail.namaPelanggan : undefined,
                      latitude: detail.latitude !== undefined ? detail.latitude : undefined,
                      longitude: detail.longitude !== undefined ? detail.longitude : undefined,
                      ...enumFields,
                      rabHld: detail.rabHld !== null && detail.rabHld !== undefined ? new Prisma.Decimal(detail.rabHld.toString()) : undefined,
                      ihldValue: detail.ihldValue !== undefined ? detail.ihldValue : undefined,
                      statusIhld: detail.statusIhld !== undefined ? detail.statusIhld : undefined,
                      idEprop: detail.idEprop !== undefined ? detail.idEprop : undefined,
                      newSc: detail.newSc !== undefined ? detail.newSc : undefined,
                      namaOdp: detail.namaOdp !== undefined ? detail.namaOdp : undefined,
                      tglGolive: detail.tglGolive !== undefined ? detail.tglGolive : undefined,
                      avai: detail.avai !== undefined ? detail.avai : undefined,
                      used: detail.used !== undefined ? detail.used : undefined,
                      isTotal: detail.isTotal !== undefined ? detail.isTotal : undefined,
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
                  
                  const wasCreated = !existingDetailIds.has(detail.idKendala.trim());
                  if (wasCreated) {
                    stats.created++;
                  } else {
                    stats.updated++;
                  }
                } catch (error: any) {
                  console.error(`Error upserting detail ${detail.idKendala}:`, error.message);
                  stats.errors++;
                }
              }
            },
            { maxWait: 15000, timeout: 60000 } // Further increased timeout for larger batches
          );
        } catch (batchError) {
          console.error(`Error processing detail batch:`, batchError);
          stats.errors += batch.length;
        }
      }

    
    const sheetSummaryResolvedIds = new Set<string>();

    if (summaryData.length > 0 && existingSummaries.length > 0) {
      const rawSheetNomorValues = Array.from(
        new Set(
          summaryData
            .map((s: any) => (s.nomorNcx || s.nomorNc)?.trim())
            .filter(Boolean)
        )
      ) as string[];

      if (rawSheetNomorValues.length > 0) {
        // Use already built newScToIdKendala map instead of querying again
        const preResolvedSheetIds = new Set<string>();
        for (const raw of rawSheetNomorValues) {
          const resolved = newScToIdKendala.get(raw) ?? raw;
          if (resolved && String(resolved).trim()) preResolvedSheetIds.add(String(resolved).trim());
        }

        const preSummariesToDelete = existingSummaries.filter(
          (s: any) => !preResolvedSheetIds.has(String(s.nomorNcx).trim())
        );

        if (preSummariesToDelete.length > 0) {
          console.log(`Pre-deleting ${preSummariesToDelete.length} summaries before upsert to avoid duplicate 'no'...`);
          await prisma.ndeUsulanB2B.deleteMany({
            where: { id: { in: preSummariesToDelete.map((s: any) => s.id) } },
          });
        }
      }
    }

    if (summaryData.length > 0) {
      logger.info(`Processing ${summaryData.length} summary records...`);
      const BATCH_SIZE = 200; // Increased from 100

      for (let i = 0; i < summaryData.length; i += BATCH_SIZE) {
        const batch = summaryData.slice(i, i + BATCH_SIZE);

        try {
          await prisma.$transaction(
            async (tx: any) => {
              for (const summary of batch) {
                let nomorNcx = (summary.nomorNcx || summary.nomorNc)?.trim();
                
                const no = (summary.no ?? summary.NO ?? summary.nomorNcx ?? nomorNcx ?? '').toString().trim();

                if (!nomorNcx) {
                  stats.skipped++;
                  continue;
                }
                if (!no) {
                  stats.skipped++;
                  continue;
                }

                try {
                  // Use pre-fetched lookup maps instead of querying
                  let existingMaster = null;
                  let resolvedNcx = nomorNcx;
                  
                  // Check if exists in detail records
                  if (existingDetailIds.has(nomorNcx)) {
                    existingMaster = { idKendala: nomorNcx };
                  } else if (newScToIdKendala.has(nomorNcx)) {
                    // Check newSc mapping
                    resolvedNcx = newScToIdKendala.get(nomorNcx)!;
                    existingMaster = { idKendala: resolvedNcx };
                  } else if (summary.namaPelanggan) {
                    // Check customer name mapping
                    const sheetNomorNcx = (summary.nomorNcx || summary.nomorNc)?.trim() ?? '';
                    const isNumericNcx = /^\d+$/.test(sheetNomorNcx);
                    if (!isNumericNcx) {
                      const customerKey = summary.namaPelanggan.trim().toLowerCase();
                      if (customerNameToIdKendala.has(customerKey)) {
                        resolvedNcx = customerNameToIdKendala.get(customerKey)!;
                        existingMaster = { idKendala: resolvedNcx };
                      }
                    }
                  }
                  
                  nomorNcx = resolvedNcx;

                  
                  sheetSummaryResolvedIds.add(nomorNcx);

                  if (!existingMaster) {
                    const masterEnumFields: any = {};
                    
                    const planTematikId = enumCache.get(`PlanTematik:${summary.planTematik}`);
                    if (planTematikId) masterEnumFields.planTematik = { connect: { id: planTematikId } };
                    
                    const statusUsulanId = enumCache.get(`StatusUsulan:${summary.statusUsulan}`);
                    if (statusUsulanId) masterEnumFields.statusUsulan = { connect: { id: statusUsulanId } };

                    await tx.newBgesB2BOlo.create({
                      data: {
                        idKendala: nomorNcx,
                        syncStatus: 'SYNCED',
                        lastSyncAt: new Date(),
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

                  const statusJtId = summary.statusJt ? enumCache.get(`StatusJt:${summary.statusJt}`) : null;
                  const statusInstalasiId = summary.statusInstalasi ? enumCache.get(`StatusInstalasi:${summary.statusInstalasi}`) : null;

                  const upsertResult = await tx.ndeUsulanB2B.upsert({
                    where: { nomorNcx: nomorNcx },
                    update: {
                      syncStatus: 'SYNCED',
                      lastSyncAt: new Date(),
                      statusJtId: statusJtId !== null ? statusJtId : undefined,
                      statusInstalasiId: statusInstalasiId !== null ? statusInstalasiId : undefined,
                      c2r: summary.c2r !== null && summary.c2r !== undefined ? new Prisma.Decimal(summary.c2r.toString()) : undefined,
                      alamatInstalasi: summary.alamatInstalasi !== undefined ? summary.alamatInstalasi : undefined,
                      jenisLayanan: summary.jenisLayanan !== undefined ? summary.jenisLayanan : undefined,
                      nilaiKontrak: summary.nilaiKontrak !== null && summary.nilaiKontrak !== undefined ? new Prisma.Decimal(summary.nilaiKontrak.toString()) : undefined,
                      rabSurvey: summary.rabSurvey !== null && summary.rabSurvey !== undefined ? new Prisma.Decimal(summary.rabSurvey.toString()) : undefined,
                      nomorNde: summary.nomorNde !== undefined ? summary.nomorNde : undefined,
                      progressJt: summary.progressJt !== undefined ? summary.progressJt : undefined,
                      namaOdp: summary.namaOdp !== undefined ? summary.namaOdp : undefined,
                      jarakOdp: summary.jarakOdp !== null && summary.jarakOdp !== undefined ? new Prisma.Decimal(summary.jarakOdp.toString()) : undefined,
                      keterangan: summary.keterangan !== undefined ? summary.keterangan : undefined,
                      datel: summary.datel !== undefined ? summary.datel : undefined,
                      sto: summary.sto !== undefined ? summary.sto : undefined,
                      namaPelanggan: summary.namaPelanggan !== undefined ? summary.namaPelanggan : undefined,
                      latitude: summary.latitude !== undefined ? summary.latitude : undefined,
                      longitude: summary.longitude !== undefined ? summary.longitude : undefined,
                      ihldLopId: summary.ihldLopId !== undefined ? summary.ihldLopId : undefined,
                      planTematik: summary.planTematik !== undefined ? summary.planTematik : undefined,
                      rabHld: summary.rabHld !== null && summary.rabHld !== undefined ? new Prisma.Decimal(summary.rabHld.toString()) : undefined,
                      statusUsulan: summary.statusUsulan !== undefined ? summary.statusUsulan : undefined,
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
                  logger.error(`Error upserting summary ${nomorNcx} (no: ${no}):`, error.message);
                  if (error.code === 'P2002') {
                    logger.error(`Duplicate 'no' detected: ${no}. This summary will be skipped.`);
                  }
                  stats.errors++;
                }
              }
            },
            { maxWait: 15000, timeout: 60000 } // Further increased timeout for larger batches
          );
        } catch (batchError) {
          console.error(`Error processing summary batch:`, batchError);
          stats.errors += batch.length;
        }
      }
    }

    
    const sheetDetailIds = new Set(detailData.map((d: any) => d.idKendala?.trim()).filter(Boolean));
    
    const detailsToDelete = existingDetails.filter((d: any) => !sheetDetailIds.has(d.idKendala));
    const summariesToDelete = existingSummaries.filter((s: any) => !sheetSummaryResolvedIds.has(s.nomorNcx));
    
    if (summariesToDelete.length > 0 || detailsToDelete.length > 0) {
      logger.info(`Deleting ${summariesToDelete.length} summaries and ${detailsToDelete.length} details...`);
      
      try {
        
        if (summariesToDelete.length > 0) {
          const summaryIds = summariesToDelete.map((s: any) => s.id);
          const deleteResult = await prisma.ndeUsulanB2B.deleteMany({
            where: { id: { in: summaryIds } }
          });
          stats.deleted += deleteResult.count;
        }
        
        
        if (detailsToDelete.length > 0) {
          const detailIds = detailsToDelete.map((d: any) => d.idKendala);
          const deleteResult = await prisma.newBgesB2BOlo.deleteMany({
            where: { idKendala: { in: detailIds } }
          });
          stats.deleted += deleteResult.count;
        }
      } catch (deleteError: any) {
        console.error('Error during batch delete:', deleteError.message);
        stats.errors += (summariesToDelete.length + detailsToDelete.length);
      }
    }

    const totalTime = Date.now() - startTime;
    const timeInSeconds = (totalTime / 1000).toFixed(2);
    
    logger.info(`✅ Incremental sync completed in ${timeInSeconds}s`);
    logger.info(`📊 Results: ${stats.created} created, ${stats.updated} updated, ${stats.deleted} deleted, ${stats.skipped} skipped, ${stats.errors} errors`);

    return stats;
  } catch (error) {
    console.error('Error in incremental sync:', error);
    throw error;
  }
}
