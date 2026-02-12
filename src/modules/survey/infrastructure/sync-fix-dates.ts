export async function fixNullDatesFromDetailSheet(
  prisma: any,
  detailData: any[]
): Promise<{ fixed: number }> {
  console.log('Fixing null dates by matching customer names...');
  
  let fixed = 0;
  
  const nullDateRecords = await prisma.newBgesB2BOlo.findMany({
    where: { tglInputUsulan: null },
    select: {
      idKendala: true,
      namaPelanggan: true,
    }
  });
  
  console.log(`Found ${nullDateRecords.length} records with null tanggal`);
  
  
  for (const record of nullDateRecords) {
    if (!record.namaPelanggan) continue;
    
    
    const matchingDetail = detailData.find(d => 
      d.namaPelanggan && 
      d.namaPelanggan.trim().toLowerCase() === record.namaPelanggan.trim().toLowerCase() &&
      d.tglInputUsulan !== null &&
      d.tglInputUsulan !== undefined
    );
    
    if (matchingDetail) {
      try {
        await prisma.newBgesB2BOlo.update({
          where: { idKendala: record.idKendala },
          data: {
            tglInputUsulan: matchingDetail.tglInputUsulan,
            lastSyncAt: new Date(),
          }
        });
        
        console.log(`Fixed tanggal for ${record.idKendala} (${record.namaPelanggan}) from detail sheet`);
        fixed++;
      } catch (error: any) {
        console.error(`Error fixing tanggal for ${record.idKendala}:`, error.message);
      }
    }
  }
  
  console.log(`✅ Fixed ${fixed} records with null tanggal`);
  
  return { fixed };
}
