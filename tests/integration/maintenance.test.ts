import { expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openDatabase } from '../../src/lib/server/db/client';

test('maintenance removes expired credentials and expired ended session data only', () => {
	const dir = mkdtempSync(join(tmpdir(), 'edu-maintenance-'));
	const source = join(dir, 'source.db');
	const store = openDatabase(source);
	try {
		const now = 1_000_000;
		store.sqlite.exec(`
			INSERT INTO admin_users VALUES ('admin', 'teacher@example.test', 'hash', 1);
			INSERT INTO admin_sessions VALUES ('old-admin', 'admin', ${now - 1});
			INSERT INTO admin_sessions VALUES ('live-admin', 'admin', ${now + 1});
			INSERT INTO activities (id, owner_id, title, type, created_at, board_moderation) VALUES ('old-activity', 'admin', 'Old', 'choice', 1, 1);
			INSERT INTO activities (id, owner_id, title, type, created_at, board_moderation) VALUES ('live-activity', 'admin', 'Live', 'choice', 1, 1);
			INSERT INTO live_sessions (id, activity_id, code, state, created_at, ended_at) VALUES ('old-session', 'old-activity', 'OLD123', 'ended', 1, ${now - 1});
							INSERT INTO live_sessions (id, activity_id, code, state, created_at, ended_at) VALUES ('live-session', 'live-activity', 'LIVE12', 'ended', 1, ${now + 1});
			INSERT INTO participants VALUES ('expired-participant', 'old-session', 'Old', 'expired-token', ${now - 1}, 1);
			INSERT INTO participants VALUES ('live-participant', 'live-session', 'Live', 'live-token', ${now + 1}, 1);
			INSERT INTO poll_questions (id, activity_id, prompt, position, show_results, time_limit, created_at) VALUES ('question', 'old-activity', 'Prompt', 0, 0, 20, 1);
			INSERT INTO poll_options VALUES ('option', 'question', 'Answer', 0, 1);
			INSERT INTO poll_responses VALUES ('response', 'question', 'old-session', 'expired-participant', 'option', 1, 100, 1);
			INSERT INTO poll_response_options VALUES ('response', 'option');
		`);
		const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/maintenance.ts'], {
			env: {
				...process.env,
				DATABASE_PATH: source,
				MAINTENANCE_NOW: String(now),
				SESSION_RETENTION_DAYS: '0'
			},
			encoding: 'utf8'
		});
		expect(result.status, result.stderr).toBe(0);
		expect(store.sqlite.prepare('SELECT count(*) n FROM admin_sessions').get()).toEqual({ n: 1 });
		expect(store.sqlite.prepare('SELECT count(*) n FROM participants').get()).toEqual({ n: 1 });
		expect(store.sqlite.prepare('SELECT count(*) n FROM live_sessions').get()).toEqual({ n: 1 });
		expect(store.sqlite.prepare('SELECT count(*) n FROM activities').get()).toEqual({ n: 1 });
	} finally {
		store.sqlite.close();
		rmSync(dir, { recursive: true, force: true });
	}
});

test('scheduled backup creates unique snapshot and removes snapshots beyond retention', () => {
	const dir = mkdtempSync(join(tmpdir(), 'edu-scheduled-backup-'));
	const source = join(dir, 'source.db');
	const backups = join(dir, 'backups');
	const store = openDatabase(source);
	try {
		store.sqlite
			.prepare('INSERT INTO admin_users VALUES (?,?,?,?)')
			.run('id', 'teacher@example.test', 'hash', 1);
		const run = (stamp: string, nowMs: number) =>
			spawnSync(process.execPath, ['--import', 'tsx', 'scripts/scheduled-backup.ts'], {
				env: {
					...process.env,
					DATABASE_PATH: source,
					BACKUP_DIR: backups,
					BACKUP_RETENTION_DAYS: '1',
					BACKUP_TIMESTAMP: stamp,
					BACKUP_NOW: String(nowMs)
				},
				encoding: 'utf8'
			});
		expect(run('20260101T000000Z', Date.parse('2026-01-01T00:00:00Z')).status).toBe(0);
		expect(run('20260103T000000Z', Date.parse('2026-01-03T00:00:00Z')).status).toBe(0);
		const backup = openDatabase(join(backups, 'edu-nara-20260103T000000Z.db'));
		expect(backup.sqlite.pragma('integrity_check', { simple: true })).toBe('ok');
		expect(backup.sqlite.prepare('SELECT count(*) n FROM admin_users').get()).toEqual({ n: 1 });
		backup.sqlite.close();
		expect(
			spawnSync('sh', ['-c', `test ! -e ${join(backups, 'edu-nara-20260101T000000Z.db')}`]).status
		).toBe(0);
	} finally {
		store.sqlite.close();
		rmSync(dir, { recursive: true, force: true });
	}
});
