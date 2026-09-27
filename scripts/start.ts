import { database } from '../src/lib/server/db/client';
import { seedAdmin } from '../src/lib/server/auth';
import pino from 'pino';
const log = pino({ level: process.env.LOG_LEVEL || 'info', base: undefined });
try {
	const store = database();
	try {
		const count = (
			store.sqlite.prepare('SELECT count(*) n FROM admin_users').get() as { n: number }
		).n;
		if (!count)
			await seedAdmin(store, {
				email: process.env.ADMIN_EMAIL,
				password: process.env.ADMIN_PASSWORD
			});
	} finally {
		store.sqlite.close();
	}
	delete process.env.ADMIN_PASSWORD;
	delete process.env.ADMIN_EMAIL;
	log.info('Database initialized.');
	if (!process.argv.includes('--initialize-only'))
		await import(new URL('../build/index.js', import.meta.url).href);
} catch {
	log.error('Startup failed. Check database access and initial admin environment.');
	process.exitCode = 1;
}
