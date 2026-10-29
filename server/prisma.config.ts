import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 moved connection URLs out of schema.prisma into this file.
// Migrations/introspection use the UNPOOLED (direct) Neon URL, since PgBouncer-pooled
// connections are not suited to DDL and advisory locks. Falls back to DATABASE_URL
// for plain Postgres setups. The runtime client uses the pooled URL (src/config/prisma.ts).
function getMigrationDatabaseUrl(): string {
  if (process.env.DATABASE_URL_UNPOOLED) {
    return process.env.DATABASE_URL_UNPOOLED;
  }
  const dbUrl = process.env.DATABASE_URL ?? '';
  // If using a Neon pooled connection, automatically derive the unpooled (direct) URL
  // so Prisma migration DDL and pg_advisory_lock bypass PgBouncer transaction pooling.
  if (dbUrl.includes('-pooler.')) {
    return dbUrl.replace('-pooler.', '.');
  }
  return dbUrl;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: getMigrationDatabaseUrl(),
  },
});
