import dotenv from 'dotenv';
dotenv.config({ override: true });
import { Prisma, PrismaClient } from '@prisma/client';

const logLevels: (Prisma.LogLevel | Prisma.LogDefinition)[] = ['error', 'warn', 'info'];

let prisma: PrismaClient;

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

if (process.env.NODE_ENV !== 'production') {
  if (!global.__prisma__) {
    global.__prisma__ = new PrismaClient({ log: logLevels });
  }
  prisma = global.__prisma__;
} else {
  prisma = new PrismaClient({ log: logLevels });
}

async function initPrisma() {
  try {
    // Soft check to help catch wrong host
    const url = process.env.DATABASE_URL || '';
    if (url.includes('db.') && url.includes('supabase.co') && !url.includes('pooler')) {
      console.warn('[Prisma] DATABASE_URL looks like a direct host (db.*). Prefer the transaction pooler URL (aws-*-pooler..., port 6543).');
    }
    await prisma.$connect();
  } catch (err) {
    // Helpful error for DB connectivity (Supabase Postgres)
    const dbUrl = process.env.DATABASE_URL ? 'set' : 'missing';
    console.error('[Prisma] Failed to connect to database.');
    console.error(`[Prisma] DATABASE_URL is ${dbUrl}.`);
    console.error(err);
    process.exit(1);
  }
}

void initPrisma();

export { prisma };
