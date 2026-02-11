import { PrismaClient } from './src/generated/prisma/client.js';

const prisma = new PrismaClient();

async function checkEnums() {
  const enums = await prisma.enumValue.findMany({
    where: {
      displayName: {
        contains: '_'
      }
    },
    select: {
      enumType: true,
      value: true,
      displayName: true,
    },
    take: 10
  });
  
  console.log('Enums with underscore in displayName:');
  console.log(JSON.stringify(enums, null, 2));
  
  await prisma.$disconnect();
}

checkEnums();
