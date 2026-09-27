import { UserError } from './errors';
import { randomInt, randomUUID } from 'node:crypto';
import { and, count, eq, gt } from 'drizzle-orm';
import type { Store } from './db/client';
import { activities, participants, sessions } from './db/schema';
import { hashToken, newToken } from './auth';
import { activitySchema, joinSchema, stateSchema } from '../validation';
export function generateSessionCode() {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
}
export function createActivity(store: Store, ownerId: string, input: unknown) {
	const { title, type } = activitySchema.parse(input);
	const row = { id: randomUUID(), ownerId, title, type, createdAt: Date.now() };
	store.db.insert(activities).values(row).run();
	return row;
}
export function ownedSession(store: Store, adminId: string, id: string) {
	const row = store.db
		.select({ session: sessions })
		.from(sessions)
		.innerJoin(activities, eq(activities.id, sessions.activityId))
		.where(and(eq(sessions.id, id), eq(activities.ownerId, adminId)))
		.get();
	if (!row) throw new UserError('Sesi tidak ditemukan.');
	return row.session;
}
export function launchSession(
	store: Store,
	adminId: string,
	activityId: string,
	generate = generateSessionCode
) {
	if (
		!store.db
			.select()
			.from(activities)
			.where(and(eq(activities.id, activityId), eq(activities.ownerId, adminId)))
			.get()
	)
		throw new UserError('Aktivitas tidak ditemukan.');
	for (let attempt = 0; attempt < 10; attempt++) {
		const row = {
			id: randomUUID(),
			activityId,
			code: generate(),
			state: 'draft' as const,
			createdAt: Date.now()
		};
		const inserted = store.db
			.insert(sessions)
			.values(row)
			.onConflictDoNothing({ target: sessions.code })
			.returning()
			.get();
		if (inserted) return inserted;
	}
	throw new UserError('Kode sesi tidak tersedia.');
}
export function changeState(store: Store, adminId: string, id: string, input: unknown) {
	const state = stateSchema.parse(input);
	const current = ownedSession(store, adminId, id);
	if (current.state === 'ended' || (current.state === 'draft' && state === 'closed'))
		throw new UserError('Perubahan status tidak diizinkan.');
	return store.db
		.update(sessions)
		.set({ state, endedAt: state === 'ended' ? Date.now() : null })
		.where(eq(sessions.id, id))
		.returning()
		.get()!;
}
export function sessionByCode(store: Store, code: string) {
	return store.db.select().from(sessions).where(eq(sessions.code, code)).get();
}
export function participantValid(store: Store, id: string, token?: string, now = Date.now()) {
	if (!token || token.length > 100) return false;
	return !!store.db
		.select({ id: participants.id })
		.from(participants)
		.where(
			and(
				eq(participants.sessionId, id),
				eq(participants.tokenHash, hashToken(token)),
				gt(participants.expiresAt, now)
			)
		)
		.get();
}
export function authorizeSession(
	store: Store,
	id: string,
	adminId?: string,
	token?: string,
	now = Date.now()
) {
	if (participantValid(store, id, token, now)) return true;
	if (adminId) {
		try {
			ownedSession(store, adminId, id);
			return true;
		} catch {
			return false;
		}
	}
	return false;
}
export function joinSession(store: Store, input: unknown, existing?: string, now = Date.now()) {
	const data = joinSchema.parse(input);
	return store.sqlite.transaction(() => {
		const scoped = store;
		const session = sessionByCode(scoped, data.code);
		if (!session) throw new UserError('Sesi tidak tersedia.');
		if (participantValid(scoped, session.id, existing, now))
			return { sessionId: session.id, code: session.code, token: existing!, created: false };
		if (session.state !== 'open') throw new UserError('Sesi belum dibuka atau sudah ditutup.');
		const token = newToken();
		store.db
			.insert(participants)
			.values({
				id: randomUUID(),
				sessionId: session.id,
				displayName: data.displayName,
				tokenHash: hashToken(token),
				expiresAt: now + 86400000,
				createdAt: now
			})
			.run();
		return { sessionId: session.id, code: session.code, token, created: true };
	})();
}
export function snapshot(store: Store, id: string) {
	const row = store.db
		.select({
			id: sessions.id,
			code: sessions.code,
			state: sessions.state,
			title: activities.title
		})
		.from(sessions)
		.innerJoin(activities, eq(activities.id, sessions.activityId))
		.where(eq(sessions.id, id))
		.get();
	if (!row) throw new UserError('Sesi tidak ditemukan.');
	return {
		...row,
		count: store.db
			.select({ n: count() })
			.from(participants)
			.where(eq(participants.sessionId, id))
			.get()!.n
	};
}
