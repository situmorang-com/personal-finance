import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

const sqlite = new Database(env.DATABASE_URL ?? 'data/db.sqlite');
sqlite.pragma('journal_mode = WAL');

// Add new columns if they don't exist (safe to run repeatedly; SQLite throws on duplicates)
for (const sql of [
	"ALTER TABLE expenses ADD COLUMN direction TEXT NOT NULL DEFAULT 'expense'",
	"ALTER TABLE expenses ADD COLUMN source_type TEXT DEFAULT 'manual'",
	"ALTER TABLE expenses ADD COLUMN recipient TEXT",
	"ALTER TABLE expenses ADD COLUMN remark TEXT",
	"ALTER TABLE expenses ADD COLUMN import_ref TEXT",
	"ALTER TABLE categories ADD COLUMN monthly_budget REAL",
	"ALTER TABLE subscriptions ADD COLUMN cancel_url TEXT",
	"ALTER TABLE subscriptions ADD COLUMN is_trial INTEGER NOT NULL DEFAULT 0"
]) {
	try { sqlite.exec(sql); } catch { /* column already exists */ }
}

// Migrate existing import metadata from notes → import_ref
sqlite.exec(`
	UPDATE expenses
	SET import_ref = notes, notes = NULL
	WHERE notes LIKE '[bca-%' AND import_ref IS NULL
`);


// Create tag tables if they don't exist yet
sqlite.exec(`
	CREATE TABLE IF NOT EXISTS tags (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		color TEXT NOT NULL DEFAULT '#6366f1'
	);
	CREATE TABLE IF NOT EXISTS expense_tags (
		expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
		tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE
	);
	CREATE UNIQUE INDEX IF NOT EXISTS expense_tags_pk ON expense_tags(expense_id, tag_id);
	CREATE TABLE IF NOT EXISTS tag_rules (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		merchant TEXT NOT NULL,
		tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
		weight INTEGER NOT NULL DEFAULT 1
	);
	CREATE UNIQUE INDEX IF NOT EXISTS tag_rules_uniq ON tag_rules(user_id, merchant, tag_id);
	CREATE TABLE IF NOT EXISTS category_rules (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		merchant TEXT NOT NULL,
		category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
		weight INTEGER NOT NULL DEFAULT 1
	);
	CREATE UNIQUE INDEX IF NOT EXISTS category_rules_uniq ON category_rules(user_id, merchant, category_id);
	CREATE TABLE IF NOT EXISTS category_keywords (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
		keyword TEXT NOT NULL
	);
	CREATE UNIQUE INDEX IF NOT EXISTS category_keywords_uniq ON category_keywords(user_id, category_id, keyword);
`);

export const db = drizzle(sqlite, { schema });
