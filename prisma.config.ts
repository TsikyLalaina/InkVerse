import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // Use classic engine (no driver adapter) for now; this works with your current setup
  engine: 'classic',
  // Point to your existing Prisma schema
  schema: path.join(process.cwd(), 'prisma', 'schema.prisma'),
  // Move datasource URLs out of schema.prisma per Prisma 7 guidance
  datasource: {
    url: env('DATABASE_URL'),
    directUrl: env('DIRECT_URL'),
  },
});
