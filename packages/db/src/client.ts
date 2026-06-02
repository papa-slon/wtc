import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

export function createDbClient(url: string) {
  const client = postgres(url, { max: 10 });
  return { client, db: drizzle(client, { schema }) };
}

export function createDb(url: string) {
  return createDbClient(url).db;
}

export type Db = ReturnType<typeof createDb>;
