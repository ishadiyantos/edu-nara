import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { openDatabase } from '../src/lib/server/db/client';
import { seedAdmin } from '../src/lib/server/auth';
const dir = mkdtempSync(join(tmpdir(), 'edu-e2e-'));
const path = join(dir, 'test.db');
const store = openDatabase(path);
await seedAdmin(store, {
	email: 'phase1@example.test',
	password: 'phase1-test-only-password-2026'
});
store.sqlite.close();
const child = spawn(process.execPath, ['build/index.js'], {
	stdio: 'inherit',
	env: {
		...process.env,
		DATABASE_PATH: path,
		UPLOAD_DIR: join(dir, 'uploads'),
		BODY_SIZE_LIMIT: '6M',
		COOKIE_SECURE: 'false',
		ORIGIN: 'http://127.0.0.1:4173',
		HOST: '127.0.0.1',
		PORT: '4173'
	}
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => {
	rmSync(dir, { recursive: true, force: true });
	process.exitCode = code ?? 0;
});
