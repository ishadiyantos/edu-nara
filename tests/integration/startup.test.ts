import { expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openDatabase } from '../../src/lib/server/db/client';
test('startup fails closed with missing seed, valid env initializes once without leaking password', () => {
	const dir = mkdtempSync(join(tmpdir(), 'edu-start-'));
	const path = join(dir, 'test.db');
	try {
		const run = (extra: Record<string, string>) =>
			spawnSync(process.execPath, ['--import', 'tsx', 'scripts/start.ts', '--initialize-only'], {
				encoding: 'utf8',
				env: { ...process.env, DATABASE_PATH: path, ADMIN_EMAIL: '', ADMIN_PASSWORD: '', ...extra }
			});
		expect(run({}).status).toBe(1);
		const password = 'startup-test-password-only';
		const good = run({ ADMIN_EMAIL: 'seed@example.test', ADMIN_PASSWORD: password });
		expect(good.status).toBe(0);
		expect(good.stdout + good.stderr).not.toContain(password);
		expect(run({}).status).toBe(0);
		const store = openDatabase(path);
		expect(store.sqlite.prepare('SELECT count(*) n FROM admin_users').get()).toEqual({ n: 1 });
		store.sqlite.close();
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
