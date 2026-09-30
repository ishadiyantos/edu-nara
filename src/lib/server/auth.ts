import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { and, eq, gt, lte } from 'drizzle-orm';
import { z } from 'zod';
import type { Store } from './db/client';
import { admins, adminSessions } from './db/schema';
const derive = promisify(scrypt);
export const credentialsSchema = z
	.object({
		email: z.string().trim().toLowerCase().email().max(254),
		password: z.string().min(1).max(256)
	})
	.strict();
const seedSchema = credentialsSchema.extend({ password: z.string().min(16).max(256) });
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export async function seedAdmin(store: Store, input: unknown) {
	const credentials = seedSchema.parse(input);
	const existing = store.db
		.select({ id: admins.id })
		.from(admins)
		.where(eq(admins.email, credentials.email))
		.get();
	if (existing) return existing;
	const salt = randomBytes(16).toString('hex');
	const hash = (await derive(credentials.password, salt, 64)) as Buffer;
	const id = randomUUID();
	store.db
		.insert(admins)
		.values({
			id,
			email: credentials.email,
			passwordHash: `${salt}:${hash.toString('hex')}`,
			createdAt: Date.now()
		})
		.run();
	return { id };
}
export async function login(store: Store, input: unknown, previous?: string, now = Date.now()) {
	const credentials = credentialsSchema.parse(input);
	const admin = store.db.select().from(admins).where(eq(admins.email, credentials.email)).get();
	const [salt, hex] = (admin?.passwordHash ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
	const candidate = (await derive(credentials.password, salt, 64)) as Buffer;
	const expected = Buffer.from(hex, 'hex');
	if (!admin || expected.length !== candidate.length || !timingSafeEqual(candidate, expected))
		throw new Error('Incorrect email or password.');
	const token = newToken();
	const expiresAt = now + 8 * 60 * 60 * 1000;
	store.db.transaction((tx) => {
		if (previous)
			tx.delete(adminSessions)
				.where(eq(adminSessions.tokenHash, hashToken(previous)))
				.run();
		tx.delete(adminSessions).where(lte(adminSessions.expiresAt, now)).run();
		tx.insert(adminSessions)
			.values({ tokenHash: hashToken(token), adminId: admin.id, expiresAt })
			.run();
	});
	return { token, expiresAt };
}
export function authenticate(store: Store, token?: string, now = Date.now()) {
	if (!token || token.length > 100) return null;
	return (
		store.db
			.select({ id: admins.id, email: admins.email })
			.from(adminSessions)
			.innerJoin(admins, eq(admins.id, adminSessions.adminId))
			.where(and(eq(adminSessions.tokenHash, hashToken(token)), gt(adminSessions.expiresAt, now)))
			.get() ?? null
	);
}
export function logout(store: Store, token?: string) {
	if (token)
		store.db
			.delete(adminSessions)
			.where(eq(adminSessions.tokenHash, hashToken(token)))
			.run();
}
