import Database from 'better-sqlite3';
import { closeSync, openSync, rmSync, chmodSync } from 'node:fs';
const source = process.env.DATABASE_PATH,
	target = process.argv[2];
let reserved = false;
try {
	if (!source || !target) throw new Error('Missing paths');
	closeSync(openSync(target, 'wx', 0o600));
	reserved = true;
	const db = new Database(source, { readonly: true, fileMustExist: true });
	try {
		await db.backup(target);
	} finally {
		db.close();
	}
	chmodSync(target, 0o600);
	console.log('Database backup complete.');
} catch {
	if (reserved) rmSync(target, { force: true });
	console.error(
		'Backup failed. Check source, destination directory and ensure destination does not exist.'
	);
	process.exitCode = 1;
}
