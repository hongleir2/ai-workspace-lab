import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { seedPlans } from './plans';

if (process.env['NODE_ENV'] === 'production') {
  console.error('refusing to seed in production');
  process.exit(1);
}

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set — run: pnpm db:migrate first, then set DATABASE_URL');
  process.exit(1);
}

const client = postgres(DATABASE_URL, { prepare: false });
const db = drizzle(client, { casing: 'snake_case' });

async function main() {
  // biome-ignore lint/suspicious/noConsole: seed CLI script
  console.log('Seeding...');
  await seedPlans(db);
  // biome-ignore lint/suspicious/noConsole: seed CLI script
  console.log('Done.');
  await client.end();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
