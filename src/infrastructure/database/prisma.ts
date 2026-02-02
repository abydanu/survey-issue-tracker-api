import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import logger from '../logging/logger.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  logger.error('❌ DATABASE_URL environment variable is not set');
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  logger.error('❌ PostgreSQL pool error');
  logger.error(err);
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

(async () => {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected');
  } catch (err) {
    logger.error('❌ Failed to connect database');
    logger.error(err);
    process.exit(1);
  }
})();

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  logger.info('🛑 Database disconnected');
  process.exit(0);
});

export default prisma;