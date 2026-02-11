import prisma from './src/infrastructure/database/prisma.js';

async function checkData() {
  const records = await prisma.ndeUsulanB2B.findMany({
    where: {
      nomorNcx: {
        in: ['1002237835', '1002235636']
      }
    },
    include: {
      statusJt: true,
      statusInstalasi: true,
      masterData: {
        include: {
          jenisKendala: true,
          planTematik: true,
          statusUsulan: true,
          statusInstalasi: true,
          keterangan: true,
        }
      }
    }
  });

  console.log('Found', records.length, 'records');
  
  for (const record of records) {
    console.log('\n=== Record:', record.nomorNcx, '===');
    console.log('statusJt:', record.statusJt);
    console.log('alamatInstalasi:', record.alamatInstalasi);
    console.log('jenisLayanan:', record.jenisLayanan);
    console.log('nilaiKontrak:', record.nilaiKontrak?.toString());
    console.log('progressJt:', record.progressJt);
    console.log('namaOdp:', record.namaOdp);
    console.log('jarakOdp:', record.jarakOdp?.toString());
  }
  
  await prisma.$disconnect();
}

checkData().catch(console.error);
