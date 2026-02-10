// Auto-create summary for master data that doesn't have summary yet
export async function createMissingSummaries(prisma: any): Promise<{ created: number }> {
  console.log('Creating missing summaries for master data...');
  
  // Find all master data that doesn't have summary
  const masterWithoutSummary = await prisma.newBgesB2BOlo.findMany({
    where: {
      ndeUsulan: null
    },
    select: {
      idKendala: true,
      namaPelanggan: true,
      datel: true,
      sto: true,
      latitude: true,
      longitude: true,
      planTematikId: true,
      statusUsulanId: true,
      rabHld: true,
    }
  });
  
  console.log(`Found ${masterWithoutSummary.length} master records without summary`);
  
  let created = 0;
  let nextNo = await getNextSummaryNo(prisma);
  
  for (const master of masterWithoutSummary) {
    try {
      await prisma.ndeUsulanB2B.create({
        data: {
          no: String(nextNo).padStart(4, '0'),
          nomorNcx: master.idKendala,
          syncStatus: 'SYNCED',
          lastSyncAt: new Date(),
          namaPelanggan: master.namaPelanggan,
          datel: master.datel,
          sto: master.sto,
          latitude: master.latitude,
          longitude: master.longitude,
          planTematik: master.planTematikId,
          statusUsulan: master.statusUsulanId,
          rabHld: master.rabHld,
        }
      });
      
      created++;
      nextNo++;
      
      if (created % 10 === 0) {
        console.log(`Created ${created} summaries...`);
      }
    } catch (error: any) {
      console.error(`Error creating summary for ${master.idKendala}:`, error.message);
    }
  }
  
  console.log(`✅ Created ${created} missing summaries`);
  
  return { created };
}

async function getNextSummaryNo(prisma: any): Promise<number> {
  const lastSummary = await prisma.ndeUsulanB2B.findFirst({
    orderBy: { no: 'desc' },
    select: { no: true }
  });
  
  if (!lastSummary || !lastSummary.no) {
    return 1;
  }
  
  const lastNo = parseInt(lastSummary.no, 10);
  return isNaN(lastNo) ? 1 : lastNo + 1;
}
