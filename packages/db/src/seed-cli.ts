import { createDb } from './client.ts';
import { seedDatabase, DEMO_PASSWORD } from './seed.ts';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required to seed');
  const db = createDb(url);
  await seedDatabase(db);
   
  console.log(`Seeded demo data. Demo logins: admin@wtc.local / teacher@wtc.local / user@wtc.local (password: ${DEMO_PASSWORD})`);
  process.exit(0);
}

main().catch((err) => {
   
  console.error('Seed failed:', err);
  process.exit(1);
});
