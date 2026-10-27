import { afterEach, expect, test } from 'vitest';
import { openDatabase } from '../../src/lib/server/db/client';
import { activities, admins, boardColumns, sessions } from '../../src/lib/server/db/schema';
import { isAiAuthoringRequest } from '../../src/lib/server/security';
import {
	authenticateAiApiKey,
	bearerToken,
	createAiApiKey,
	createAiBoardDraft,
	listAiApiKeys,
	revokeAiApiKey
} from '../../src/lib/server/ai-api-keys';

const stores: ReturnType<typeof openDatabase>[] = [];
afterEach(() => stores.splice(0).forEach((store) => store.sqlite.close()));
function fixture() {
	const store = openDatabase(':memory:');
	stores.push(store);
	store.db
		.insert(admins)
		.values(
			['owner', 'other'].map((id) => ({
				id,
				email: `${id}@example.test`,
				passwordHash: 'unused',
				createdAt: 1
			}))
		)
		.run();
	return store;
}

test('AI key is shown once, stored as hash, owner-bound, expires, and revokes', () => {
	const store = fixture();
	const key = createAiApiKey(
		store,
		'owner',
		{ label: 'Local teaching agent', expiresInDays: 30 },
		1000
	);
	expect(key.token).toMatch(/^eduai_[A-Za-z0-9_-]{43}$/);
	expect(authenticateAiApiKey(store, key.token, 1001)?.adminId).toBe('owner');
	expect(authenticateAiApiKey(store, key.token, key.expiresAt)).toBeNull();
	const stored = store.sqlite.prepare('SELECT token_hash FROM ai_api_keys').get() as {
		token_hash: string;
	};
	expect(stored.token_hash).not.toBe(key.token);
	expect(listAiApiKeys(store, 'other')).toEqual([]);
	expect(bearerToken(`Bearer ${key.token}`)).toBe(key.token);
	expect(bearerToken(`bearer ${key.token}`)).toBeUndefined();
	revokeAiApiKey(store, 'owner', key.id, 2000);
	expect(authenticateAiApiKey(store, key.token, 2001)).toBeNull();
	expect(listAiApiKeys(store, 'owner', 2001)[0].active).toBe(false);
});

test('AI authoring accepts strict Board draft payload and never launches session', () => {
	const store = fixture();
	const key = createAiApiKey(store, 'owner', { label: 'Agent' }, 1000);
	const payload = { title: 'Diagnosis komunikasi', columns: ['Fakta', 'Diagnosis', 'Usulan'] };
	const activity = createAiBoardDraft(store, 'owner', key.id, 'retry-1', payload, 1001);
	const retry = createAiBoardDraft(store, 'owner', key.id, 'retry-1', payload, 1002);
	expect(() =>
		createAiBoardDraft(
			store,
			'owner',
			key.id,
			'retry-1',
			{ ...payload, title: 'Different payload' },
			1003
		)
	).toThrow('Idempotency-Key already used.');
	expect(activity.type).toBe('board');
	expect(retry.id).toBe(activity.id);
	expect(store.db.select().from(activities).all()).toHaveLength(1);
	expect(
		store.db
			.select()
			.from(boardColumns)
			.all()
			.map((column) => [column.title, column.position])
	).toEqual([
		['Fakta', 0],
		['Diagnosis', 1],
		['Usulan', 2]
	]);
	expect(store.db.select().from(sessions).all()).toEqual([]);
	expect(() =>
		createAiBoardDraft(store, 'owner', key.id, 'retry-2', {
			title: 'Invalid',
			columns: ['Fakta'],
			launch: true
		})
	).toThrow();
	expect(store.db.select().from(sessions).all()).toEqual([]);
});

test('only exact AI bearer authoring POST bypasses same-origin gate', () => {
	const valid = `Bearer eduai_${'A'.repeat(43)}`;
	expect(isAiAuthoringRequest('/api/v1/admin/activities', 'POST', valid)).toBe(true);
	expect(isAiAuthoringRequest('/api/v1/admin/activities', 'DELETE', valid)).toBe(false);
	expect(isAiAuthoringRequest('/api/admin/ai-keys', 'POST', valid)).toBe(false);
	expect(isAiAuthoringRequest('/api/v1/admin/activities', 'POST', 'Bearer wrong')).toBe(false);
});

test('AI API key creation rejects invalid expiry and unknown fields', () => {
	const store = fixture();
	expect(() =>
		createAiApiKey(store, 'owner', { label: 'Bad expiry', expiresInDays: 999 }, 1000)
	).toThrow();
	expect(() => createAiApiKey(store, 'owner', { label: 'Bad', scope: 'admin' }, 1000)).toThrow();
	expect(store.sqlite.prepare('SELECT count(*) AS count FROM ai_api_keys').get()).toEqual({
		count: 0
	});
});
