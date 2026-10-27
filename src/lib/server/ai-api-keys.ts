import { randomUUID } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { hashToken, newToken } from './auth';
import type { Store } from './db/client';
import { activities, aiApiKeyRequests, aiApiKeys, boardColumns } from './db/schema';
import { UserError } from './errors';
import { createLibraryActivity } from './activity-library';

export const createAiKeySchema = z
	.object({
		label: z.string().trim().min(1).max(80),
		expiresInDays: z.number().int().min(1).max(365).default(90)
	})
	.strict();

export function createAiApiKey(store: Store, adminId: string, input: unknown, now = Date.now()) {
	const data = createAiKeySchema.parse(input);
	const token = `eduai_${newToken()}`;
	const id = randomUUID();
	const expiresAt = now + data.expiresInDays * 24 * 60 * 60 * 1000;
	store.db
		.insert(aiApiKeys)
		.values({
			id,
			tokenHash: hashToken(token),
			adminId,
			label: data.label,
			createdAt: now,
			expiresAt
		})
		.run();
	return { id, token, label: data.label, createdAt: now, expiresAt };
}

export function listAiApiKeys(store: Store, adminId: string, now = Date.now()) {
	return store.db
		.select({
			id: aiApiKeys.id,
			label: aiApiKeys.label,
			createdAt: aiApiKeys.createdAt,
			expiresAt: aiApiKeys.expiresAt,
			revokedAt: aiApiKeys.revokedAt
		})
		.from(aiApiKeys)
		.where(eq(aiApiKeys.adminId, adminId))
		.orderBy(desc(aiApiKeys.createdAt))
		.all()
		.map((key) => ({ ...key, active: key.revokedAt === null && key.expiresAt > now }));
}

export function revokeAiApiKey(store: Store, adminId: string, id: string, now = Date.now()) {
	const result = store.db
		.update(aiApiKeys)
		.set({ revokedAt: now })
		.where(and(eq(aiApiKeys.id, id), eq(aiApiKeys.adminId, adminId), isNull(aiApiKeys.revokedAt)))
		.run();
	if (!result.changes) throw new UserError('API key not found.');
}

export function authenticateAiApiKey(store: Store, token: string | undefined, now = Date.now()) {
	if (!token || token.length > 100 || !token.startsWith('eduai_')) return null;
	return (
		store.db
			.select({ id: aiApiKeys.id, adminId: aiApiKeys.adminId, label: aiApiKeys.label })
			.from(aiApiKeys)
			.where(
				and(
					eq(aiApiKeys.tokenHash, hashToken(token)),
					gt(aiApiKeys.expiresAt, now),
					isNull(aiApiKeys.revokedAt)
				)
			)
			.get() ?? null
	);
}

export function bearerToken(header: string | null) {
	if (!header || header.length > 120) return undefined;
	return /^Bearer (eduai_[A-Za-z0-9_-]{43})$/.exec(header)?.[1];
}

export const createAiBoardSchema = z
	.object({
		title: z.string().trim().min(1).max(120),
		columns: z.array(z.string().trim().min(1).max(120)).min(1).max(20)
	})
	.strict();

export function createAiBoardDraft(
	store: Store,
	adminId: string,
	apiKeyId: string,
	requestKey: string,
	input: unknown,
	now = Date.now()
) {
	const data = createAiBoardSchema.parse(input);
	if (!/^[A-Za-z0-9._:-]{1,100}$/.test(requestKey)) throw new UserError('Invalid Idempotency-Key.');
	const payloadHash = hashToken(JSON.stringify(data));
	return store.sqlite.transaction(() => {
		const prior = store.db
			.select({
				activityId: aiApiKeyRequests.activityId,
				payloadHash: aiApiKeyRequests.payloadHash
			})
			.from(aiApiKeyRequests)
			.where(
				and(eq(aiApiKeyRequests.apiKeyId, apiKeyId), eq(aiApiKeyRequests.requestKey, requestKey))
			)
			.get();
		if (prior) {
			if (prior.payloadHash !== payloadHash) throw new UserError('Idempotency-Key already used.');
			const activity = store.db
				.select()
				.from(activities)
				.where(and(eq(activities.id, prior.activityId), eq(activities.ownerId, adminId)))
				.get();
			if (activity) return activity;
			throw new UserError('Idempotency-Key already used.');
		}
		const activity = createLibraryActivity(store, adminId, {
			title: data.title,
			type: 'board',
			templateId: ''
		});
		store.db
			.insert(boardColumns)
			.values(
				data.columns.map((title, position) => ({
					id: randomUUID(),
					activityId: activity.id,
					title,
					position,
					createdAt: now
				}))
			)
			.run();
		store.db
			.insert(aiApiKeyRequests)
			.values({ apiKeyId, requestKey, payloadHash, activityId: activity.id, createdAt: now })
			.run();
		return activity;
	})();
}
