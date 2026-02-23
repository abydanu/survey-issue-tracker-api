export async function fixNullDatesFromDetailSheet(
  prisma: any,
  detailData: any[]
): Promise<{ fixed: number }> {
  console.log('Fixing null dates by matching with detail data...');
  console.log(`[DEBUG] Total detail records in sheet: ${detailData.length}`);
  
  // Log sample detail data to see structure
  if (detailData.length > 0) {
    console.log('[DEBUG] Sample detail record:', JSON.stringify({
      idKendala: detailData[0].idKendala,
      newSc: detailData[0].newSc,
      namaPelanggan: detailData[0].namaPelanggan,
      tglInputUsulan: detailData[0].tglInputUsulan,
    }, null, 2));
  }
  
  let fixed = 0;
  
  const nullDateRecords = await prisma.newBgesB2BOlo.findMany({
    where: { tglInputUsulan: null },
    select: {
      idKendala: true,
      newSc: true,
      namaPelanggan: true,
    }
  });
  
  console.log(`Found ${nullDateRecords.length} records with null tanggal`);
  
  // Log first few records to debug
  if (nullDateRecords.length > 0) {
    console.log('[DEBUG] First 3 null date records:');
    nullDateRecords.slice(0, 3).forEach((r: { idKendala: string; newSc: string; namaPelanggan: any; }) => {
      console.log(`  - idKendala: ${r.idKendala}, newSc: ${r.newSc}, name: ${r.namaPelanggan}`);
      
      // Try to find in detail
      const byId = detailData.find(d => d.idKendala && d.idKendala.trim() === r.idKendala.trim());
      const byNewSc = r.newSc ? detailData.find(d => d.newSc && d.newSc.trim() === r.newSc.trim()) : null;
      
      console.log(`    Found by idKendala: ${!!byId}, Found by newSc: ${!!byNewSc}`);
      if (byId) {
        console.log(`    Detail data: idKendala=${byId.idKendala}, newSc=${byId.newSc}, date=${byId.tglInputUsulan}`);
      }
    });
  }
  
  
  for (const record of nullDateRecords) {
    let matchingDetail = null;
    let dateToUse = null;
    let source = '';
    
    // Priority 1: Match by newSc (nomor starclick) from detail sheet
    if (record.newSc) {
      matchingDetail = detailData.find(d => 
        d.newSc && 
        d.newSc.trim() === record.newSc.trim() &&
        d.tglInputUsulan !== null &&
        d.tglInputUsulan !== undefined
      );
      
      if (matchingDetail) {
        dateToUse = matchingDetail.tglInputUsulan;
        source = 'detail-newSc';
      }
    }
    
    // Priority 2: Match by idKendala from detail sheet
    if (!dateToUse && record.idKendala) {
      matchingDetail = detailData.find(d => 
        d.idKendala && 
        d.idKendala.trim() === record.idKendala.trim() &&
        d.tglInputUsulan !== null &&
        d.tglInputUsulan !== undefined
      );
      
      if (matchingDetail) {
        dateToUse = matchingDetail.tglInputUsulan;
        source = 'detail-idKendala';
      }
    }
    
    // Priority 3: Match DB idKendala with sheet newSc (for mismatched data)
    if (!dateToUse && record.idKendala) {
      matchingDetail = detailData.find(d => 
        d.newSc && 
        d.newSc.trim() === record.idKendala.trim() &&
        d.tglInputUsulan !== null &&
        d.tglInputUsulan !== undefined
      );
      
      if (matchingDetail) {
        dateToUse = matchingDetail.tglInputUsulan;
        source = 'detail-idKendala-as-newSc';
      }
    }
    
    if (dateToUse) {
      try {
        await prisma.newBgesB2BOlo.update({
          where: { idKendala: record.idKendala },
          data: {
            tglInputUsulan: dateToUse,
            lastSyncAt: new Date(),
          }
        });
        
        console.log(`✓ Fixed tanggal for ${record.idKendala} (${record.namaPelanggan}) from ${source}`);
        fixed++;
      } catch (error: any) {
        console.error(`✗ Error fixing tanggal for ${record.idKendala}:`, error.message);
      }
    } else {
      console.warn(`✗ No date source found for idKendala: ${record.idKendala}, newSc: ${record.newSc} (${record.namaPelanggan})`);
    }
  }
  
  console.log(`\n✅ Fixed ${fixed} out of ${nullDateRecords.length} records with null tanggal`);
  
  return { fixed };
}
