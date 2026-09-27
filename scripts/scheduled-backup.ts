import Database from 'better-sqlite3';
import { chmodSync, closeSync, mkdirSync, openSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const DAY = 86_400_000;

function parseTimestamp(raw: string | undefined) {
	// Accepts only strict YYYYMMDDTHHMMSSZ (UTC, fixed width) — same format the script stamps files with.
	if (!raw || !/^\d{8}T\d{6}Z$/.test(raw)) return undefined;
	return raw;
}

const source = process.env.DATABASE_PATH;
const backupDir = process.env.BACKUP_DIR;
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 0);
const now = Number(process.env.BACKUP_NOW || Date.now());
const stamp =
	parseTimestamp(process.env.BACKUP_TIMESTAMP) ??
	new Date(now)
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');

if (
	!source ||
	!backupDir ||
	!Number.isSafeInteger(now) ||
	!Number.isInteger(retentionDays) ||
	retentionDays < 0
) {
	console.error(
		'Scheduled backup failed. Check DATABASE_PATH, BACKUP_DIR, BACKUP_NOW and BACKUP_RETENTION_DAYS.'
	);
	process.exitCode = 1;
} else {
	let reserved = false;
	const target = join(backupDir, `edu-nara-${stamp}.db`);
	try {
		mkdirSync(backupDir, { recursive: true, mode: 0o700 });
		closeSync(openSync(target, 'wx', 0o600));
		reserved = true;
		const db = new Database(source, { readonly: true, fileMustExist: true });
		try {
			await db.backup(target);
		} finally {
			db.close();
		}
		chmodSync(target, 0o600);
		if (retentionDays > 0) {
			const cutoff = new Date(now - retentionDays * DAY)
				.toISOString()
				.replace(/[-:]/g, '')
				.replace(/\.\d{3}/, '');
			for (const name of readdirSync(backupDir)) {
				if (!/^edu-nara-\d{8}T\d{6}Z\.db$/.test(name)) continue;
				const fileStamp = name.slice('edu-nara-'.length, -'.db'.length);
				if (fileStamp < cutoff) rmSync(join(backupDir, name), { force: true });
			}
		}
		console.log(`Backup snapshot complete: ${target}`);
	} catch {
		if (reserved) rmSync(target, { force: true });
		console.error('Scheduled backup failed. Check source, BACKUP_DIR and retention settings.');
		process.exitCode = 1;
	}
}
