import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import * as schema from './schema';
export function openDatabase(path: string) {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	const sqlite = new Database(path);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	sqlite.pragma('busy_timeout = 5000');
	const db = drizzle(sqlite, { schema });
	try {
		migrate(db, { migrationsFolder: 'drizzle' });
	} catch (err) {
		sqlite.close();
		throw err;
	}
	return { db, sqlite };
}
export type Store = ReturnType<typeof openDatabase>;
let singleton: Store | undefined;
export function database() {
	return (singleton ??= openDatabase(
		process.env.DATABASE_PATH || join(homedir(), '.local/share/edu-nara/edu-nara.db')
	));
}
