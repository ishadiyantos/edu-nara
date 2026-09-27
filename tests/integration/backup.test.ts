import { expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openDatabase } from '../../src/lib/server/db/client';
test('online backup restores full committed WAL data and refuses overwrite', () => {
	const dir = mkdtempSync(join(tmpdir(), 'edu-backup-')),
		source = join(dir, 'source.db'),
		target = join(dir, 'backup.db');
	const store = openDatabase(source);
	try {
		store.sqlite
			.prepare('INSERT INTO admin_users VALUES (?,?,?,?)')
			.run('id', 'teacher@example.test', 'hash', 1);
		const run = () =>
			spawnSync(process.execPath, ['--import', 'tsx', 'scripts/backup.ts', target], {
				env: { ...process.env, DATABASE_PATH: source },
				encoding: 'utf8'
			});
		expect(run().status).toBe(0);
		expect(run().status).toBe(1);
		const restored = openDatabase(target);
		expect(restored.sqlite.pragma('integrity_check', { simple: true })).toBe('ok');
		expect(restored.sqlite.prepare('SELECT count(*) n FROM admin_users').get()).toEqual({ n: 1 });
		restored.sqlite.close();
	} finally {
		store.sqlite.close();
		rmSync(dir, { recursive: true, force: true });
	}
});
