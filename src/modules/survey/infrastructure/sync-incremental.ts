
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
    console.log(`Starting incremental sync: ${detailData.length} detail + ${summaryData.length} summary records from sheets`);

    const enumCache = new Map<string, string | null>();
    
    const resolveEnumId = async (enumType: EnumType, value: string | null, displayName?: string | null): Promise<string | null> => {
      if (!value || value.trim() === '-') return null;
      
      const cacheKey = `${enumType}:${value}`;
      if (enumCache.has(cacheKey)) {
        return enumCache.get(cacheKey)!;
      }
      
      try {
        // Debug logging for first 3 enum resolutions
        if (enumCache.size < 3) {
          console.log(`[ENUM DEBUG] Resolving ${enumType}.${value} with displayName: "${displayName}"`);
        }
        const id = await enumValueService.findOrCreateEnumValue(enumType, value, displayName || undefined);
        enumCache.set(cacheKey, id);
        return id;
      } catch (error) {
        enumCache.set(cacheKey, null);
        return null;
      }
    };

    console.log('Pre-resolving enums...');
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
    console.log(`Pre-resolved ${enumCache.size} unique enum values`);

    console.log('Fetching existing records...');
    const [existingDetails, existingSummaries] = await Promise.all([
      prisma.newBgesB2BOlo.findMany({
        select: { 
          idKendala: true,
          id: true,
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

    
    console.log(`Processing ${detailData.length} detail records...`);
      const BATCH_SIZE = 50; // Increased from 10 to 50 for better performance

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
                      tglInputUsulan: detail.tglInputUsulan !== undefined ? detail.tglInputUsulan : null,
                      umur: detail.umur !== undefined ? detail.umur : null,
                      bln: detail.bln !== undefined ? detail.bln : null,
                      jenisOrder: detail.jenisOrder !== undefined ? detail.jenisOrder : null,
                      datel: detail.datel !== undefined ? detail.datel : null,
                      sto: detail.sto !== undefined ? detail.sto : null,
                      namaPelanggan: detail.namaPelanggan !== undefined ? detail.namaPelanggan : null,
                      latitude: detail.latitude !== undefined ? detail.latitude : null,
                      longitude: detail.longitude !== undefined ? detail.longitude : null,
                      ...enumFields,
                      rabHld: detail.rabHld !== null && detail.rabHld !== undefined ? new Prisma.Decimal(detail.rabHld.toString()) : null,
                      ihldValue: detail.ihldValue !== undefined ? detail.ihldValue : null,
                      statusIhld: detail.statusIhld !== undefined ? detail.statusIhld : null,
                      idEprop: detail.idEprop !== undefined ? detail.idEprop : null,
                      newSc: detail.newSc !== undefined ? detail.newSc : null,
                      namaOdp: detail.namaOdp !== undefined ? detail.namaOdp : null,
                      tglGolive: detail.tglGolive !== undefined ? detail.tglGolive : null,
                      avai: detail.avai !== undefined ? detail.avai : null,
                      used: detail.used !== undefined ? detail.used : null,
                      isTotal: detail.isTotal !== undefined ? detail.isTotal : null,
                      occPercentage: detail.occPercentage !== null && detail.occPercentage !== undefined ? new Prisma.Decimal(detail.occPercentage.toString()) : null,
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
            { maxWait: 5000, timeout: 15000 }
          );
        } catch (batchError) {
          console.error(`Error processing detail batch:`, batchError);
          stats.errors += batch.length;
        }
      }

    // Set of resolved idKendala untuk setiap baris NDE di sheet (supaya delete tidak salah hapus baris yang pakai NEW SC)
    const sheetSummaryResolvedIds = new Set<string>();

    /**
     * IMPORTANT:
     * Summary sheet memiliki kolom `no` yang unik di DB.
     * Kalau ada record lama yang sudah hilang dari sheet tapi belum di-delete,
     * record baru dengan `no` yang sama akan gagal create (P2002) sebelum fase delete dijalankan.
     *
     * Jadi kita lakukan pre-delete untuk summary yang jelas-jelas tidak ada di sheet (berdasarkan nomorNCX/newSC),
     * sebelum proses upsert summary dimulai.
     */
    if (summaryData.length > 0 && existingSummaries.length > 0) {
      const rawSheetNomorValues = Array.from(
        new Set(
          summaryData
            .map((s: any) => (s.nomorNcx || s.nomorNc)?.trim())
            .filter(Boolean)
        )
      ) as string[];

      if (rawSheetNomorValues.length > 0) {
        const masters = await prisma.newBgesB2BOlo.findMany({
          where: {
            OR: [
              { idKendala: { in: rawSheetNomorValues } },
              { newSc: { in: rawSheetNomorValues } },
            ],
          },
          select: { idKendala: true, newSc: true },
        });

        const newScToIdKendala = new Map<string, string>();
        for (const m of masters) {
          if (m.newSc) newScToIdKendala.set(String(m.newSc).trim(), m.idKendala);
          newScToIdKendala.set(String(m.idKendala).trim(), m.idKendala);
        }

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
      console.log(`Processing ${summaryData.length} summary records...`);
      const BATCH_SIZE = 50; // Increased from 10 to 50 for better performance

      for (let i = 0; i < summaryData.length; i += BATCH_SIZE) {
        const batch = summaryData.slice(i, i + BATCH_SIZE);

        try {
          await prisma.$transaction(
            async (tx: any) => {
              for (const summary of batch) {
                let nomorNcx = (summary.nomorNcx || summary.nomorNc)?.trim();
                // NO kadang kosong di sheet (mis. row 259); pakai nomorNcx sebagai fallback agar baris tetap masuk
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
                  // Step 1: Cari master by idKendala (kolom Nomer NCX/Starclick di sheet bisa berisi idKendala)
                  let existingMaster = await tx.newBgesB2BOlo.findUnique({
                    where: { idKendala: nomorNcx },
                    select: { idKendala: true, namaPelanggan: true, newSc: true }
                  });

                  // Step 2: Jika tidak ketemu, cari by newSc (kolom Nomer NCX/Starclick kadang berisi nomor NEW SC)
                  if (!existingMaster) {
                    existingMaster = await tx.newBgesB2BOlo.findFirst({
                      where: { newSc: nomorNcx },
                      select: { idKendala: true, namaPelanggan: true, newSc: true }
                    });
                    
                    if (existingMaster) {
                      nomorNcx = existingMaster.idKendala;
                    }
                  }

                  // Step 3: Jika masih tidak ketemu dan nomor dari sheet numerik (idKendala/newSC), JANGAN match by nama
                  // agar summary tetap punya nomorNcx = nilai sheet dan bisa ditemukan saat search (1002249961).
                  // Match by nama hanya untuk nilai non-numerik (bisa salah link ke master lain).
                  const sheetNomorNcx = (summary.nomorNcx || summary.nomorNc)?.trim() ?? '';
                  const isNumericNcx = /^\d+$/.test(sheetNomorNcx);
                  if (!existingMaster && summary.namaPelanggan && !isNumericNcx) {
                    const customerName = summary.namaPelanggan.trim();
                    
                    existingMaster = await tx.newBgesB2BOlo.findFirst({
                      where: {
                        namaPelanggan: {
                          equals: customerName,
                          mode: 'insensitive'
                        }
                      },
                      select: { idKendala: true, namaPelanggan: true, newSc: true }
                    });
                    
                    if (existingMaster) {
                      nomorNcx = existingMaster.idKendala;
                    }
                  }

                  // Simpan idKendala yang dipakai untuk baris ini (untuk logika delete nanti)
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

                  // Debug logging for missing statusJt
                  if (summary.statusJt && !statusJtId) {
                    console.log(`[WARN] StatusJt not found in cache: "${summary.statusJt}" for ${nomorNcx}`);
                  }

                  // Debug logging for summary data BEFORE upsert
                  if (nomorNcx === '1002237835' || nomorNcx === '1002235636') {
                    console.log(`[DEBUG] BEFORE upsert for ${nomorNcx}:`, {
                      statusJt: summary.statusJt,
                      statusJtId,
                      alamatInstalasi: summary.alamatInstalasi,
                      jenisLayanan: summary.jenisLayanan,
                      nilaiKontrak: summary.nilaiKontrak,
                    });
                  }

                  const upsertResult = await tx.ndeUsulanB2B.upsert({
                    where: { nomorNcx: nomorNcx },
                    update: {
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
                  
                  // Debug logging AFTER upsert
                  if (nomorNcx === '1002237835' || nomorNcx === '1002235636') {
                    console.log(`[DEBUG] AFTER upsert for ${nomorNcx}:`, {
                      id: upsertResult.id,
                      statusJtId: upsertResult.statusJtId,
                      alamatInstalasi: upsertResult.alamatInstalasi,
                      jenisLayanan: upsertResult.jenisLayanan,
                      nilaiKontrak: upsertResult.nilaiKontrak?.toString(),
                    });
                  }
                  
                  if (existingSummaryIds.has(nomorNcx)) {
                    stats.updated++;
                  } else {
                    stats.created++;
                  }
                } catch (error: any) {
                  console.error(`Error upserting summary ${nomorNcx} (no: ${no}):`, error.message);
                  if (error.code === 'P2002') {
                    console.error(`Duplicate 'no' detected: ${no}. This summary will be skipped.`);
                  }
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

    // Delete records that exist in DB but not in sheets
    const sheetDetailIds = new Set(detailData.map((d: any) => d.idKendala?.trim()).filter(Boolean));
    // Pakai resolved idKendala (bukan raw dari sheet) supaya baris yang di sheet pakai NEW SC tidak ikut terhapus
    const detailsToDelete = existingDetails.filter((d: any) => !sheetDetailIds.has(d.idKendala));
    const summariesToDelete = existingSummaries.filter((s: any) => !sheetSummaryResolvedIds.has(s.nomorNcx));
    
    if (summariesToDelete.length > 0 || detailsToDelete.length > 0) {
      console.log(`Deleting ${summariesToDelete.length} summaries and ${detailsToDelete.length} details...`);
      
      try {
        // Batch delete summaries first (due to foreign key constraint)
        if (summariesToDelete.length > 0) {
          const summaryIds = summariesToDelete.map((s: any) => s.id);
          const deleteResult = await prisma.ndeUsulanB2B.deleteMany({
            where: { id: { in: summaryIds } }
          });
          stats.deleted += deleteResult.count;
        }
        
        // Batch delete details
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
    
    console.log(`✅ Incremental sync completed in ${timeInSeconds}s`);
    console.log(`📊 Results: ${stats.created} created, ${stats.updated} updated, ${stats.deleted} deleted, ${stats.skipped} skipped, ${stats.errors} errors`);

    return stats;
  } catch (error) {
    console.error('Error in incremental sync:', error);
    throw error;
  }
}
