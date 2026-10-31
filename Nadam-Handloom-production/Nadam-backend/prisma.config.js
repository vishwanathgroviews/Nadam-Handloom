// Prisma 7 configuration. The database URL comes from .env (DATABASE_URL).
// Migrations are shared with the live database's history: the first 20 were
// copied from the old backend so `migrate status` matches the live database.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL },
});
