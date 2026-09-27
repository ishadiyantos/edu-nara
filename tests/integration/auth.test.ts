import { afterEach, expect, test } from 'vitest';
import { openDatabase } from '../../src/lib/server/db/client';
import { seedAdmin, login, authenticate, logout, hashToken } from '../../src/lib/server/auth';
const stores: ReturnType<typeof openDatabase>[] = [];
afterEach(() => stores.splice(0).forEach((s) => s.sqlite.close()));
function store() {
	const s = openDatabase(':memory:');
	stores.push(s);
	return s;
}
const credentials = { email: 'teacher@example.test', password: 'test-only-long-password-123' };
test('seed validates credentials, stores no plaintext, is idempotent and never resets password', async () => {
	const s = store();
	await expect(seedAdmin(s, { email: '', password: '' })).rejects.toThrow();
	const admin = await seedAdmin(s, credentials);
	await seedAdmin(s, { ...credentials, password: 'different-password-1234' });
	const row = s.sqlite.prepare('SELECT * FROM admin_users').get() as { password_hash: string };
	expect(row.password_hash).not.toContain(credentials.password);
	expect(s.sqlite.prepare('SELECT count(*) n FROM admin_users').get()).toEqual({ n: 1 });
	const session = await login(s, credentials, undefined, 1000);
	expect(authenticate(s, session.token, 1001)?.id).toBe(admin.id);
	await expect(login(s, { ...credentials, password: 'incorrect' })).rejects.toThrow(
		'Email atau kata sandi salah.'
	);
});
test('login rotates opaque persisted sessions, expiry and logout revoke access', async () => {
	const s = store();
	await seedAdmin(s, credentials);
	const first = await login(s, credentials, undefined, 1000);
	const second = await login(s, credentials, first.token, 2000);
	expect(second.token).not.toBe(first.token);
	expect(authenticate(s, first.token, 2001)).toBeNull();
	expect(authenticate(s, second.token, 2001)?.email).toBe(credentials.email);
	const row = s.sqlite.prepare('SELECT token_hash FROM admin_sessions').get();
	expect(row).toEqual({ token_hash: hashToken(second.token) });
	expect(authenticate(s, second.token, second.expiresAt)).toBeNull();
	const third = await login(s, credentials);
	logout(s, third.token);
	expect(authenticate(s, third.token)).toBeNull();
	expect(authenticate(s, 'bad-token')).toBeNull();
});
