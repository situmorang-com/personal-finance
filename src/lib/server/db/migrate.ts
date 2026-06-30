import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';

const url = process.env.DATABASE_URL ?? 'data/db.sqlite';
const sqlite = new Database(url);
migrate(drizzle(sqlite), { migrationsFolder: 'drizzle' });
sqlite.close();
console.log('Migrations applied.');
