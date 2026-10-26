import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 moved connection URLs out of schema.prisma into this file.
// Migrations/introspection use the UNPOOLED (direct) Neon URL, since PgBouncer-pooled
// connections are not suited to DDL and advisory locks. Falls back to DATABASE_URL
// for plain Postgres setups. The runtime client uses the pooled URL (src/config/prisma.ts).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
});
