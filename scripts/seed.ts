import { database } from '../src/lib/server/db/client';
import { seedAdmin } from '../src/lib/server/auth';
const store = database();
try {
	await seedAdmin(store, { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
	console.log('Admin provisioned (existing credentials unchanged).');
} catch {
	console.error(
		'Admin seed failed. Supply valid ADMIN_EMAIL and ADMIN_PASSWORD (16–256 characters).'
	);
	process.exitCode = 1;
} finally {
	store.sqlite.close();
}
