import prisma from './src/infrastructure/database/prisma.js';

async function fixEnum() {
  // Update all enums that have underscore in displayName
  const enums = await prisma.enumValue.findMany({
    where: {
      displayName: {
        contains: '_'
      }
    }
  });
  
  console.log(`Found ${enums.length} enums with underscore in displayName`);
  
  for (const enumValue of enums) {
    const cleanDisplayName = enumValue.displayName?.replace(/_/g, ' ') || enumValue.value.replace(/_/g, ' ');
    
    await prisma.enumValue.update({
      where: { id: enumValue.id },
      data: { displayName: cleanDisplayName }
    });
    
    console.log(`Updated ${enumValue.enumType}.${enumValue.value}: "${enumValue.displayName}" -> "${cleanDisplayName}"`);
  }
  
  console.log('Done!');
  await prisma.$disconnect();
}

fixEnum().catch(console.error);
