import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../../src/lib/server/db/client';
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true })));
test('migrations persist core tables with WAL and foreign keys, and rerun safely', () => {
	const dir = mkdtempSync(join(tmpdir(), 'edu-db-'));
	dirs.push(dir);
	const path = join(dir, 'test.db');
	const db = openDatabase(path);
	expect(db.sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
	expect(db.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
	expect(() =>
		db.sqlite
			.prepare('INSERT INTO activities(id, owner_id, title, created_at) VALUES (?, ?, ?, ?)')
			.run('a', 'missing', 'Test', 0)
	).toThrow(/FOREIGN KEY/);
	db.sqlite.close();
	const again = openDatabase(path);
	expect(again.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).toEqual(
		expect.arrayContaining(
			['admin_users', 'admin_sessions', 'activities', 'live_sessions', 'participants'].map(
				(name) => ({ name })
			)
		)
	);
	again.sqlite.close();
});
