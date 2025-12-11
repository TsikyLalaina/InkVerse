import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // Point to your existing Prisma schema
  schema: path.join(process.cwd(), 'prisma', 'schema.prisma'),
  // Datasource configuration for Prisma v7
  // DATABASE_URL is used for Prisma Migrate and introspection
  // DIRECT_URL is used for direct database connections (optional, for connection pooling)
  datasource: {
    url: env('DATABASE_URL'),
    directUrl: env('DIRECT_URL'),
  },
});
