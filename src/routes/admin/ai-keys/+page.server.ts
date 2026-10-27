import { fail } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { body, message, requireAdmin } from '$lib/server/http';
import { createAiApiKey, listAiApiKeys, revokeAiApiKey } from '$lib/server/ai-api-keys';

export const load: import('./$types').PageServerLoad = (event) => {
	event.setHeaders({ 'Cache-Control': 'no-store, private' });
	return { keys: listAiApiKeys(database(), requireAdmin(event)) };
};

export const actions = {
	create: async (event) => {
		try {
			const data = await body(event);
			const key = createAiApiKey(database(), requireAdmin(event), {
				...data,
				expiresInDays: Number(data.expiresInDays)
			});
			return { ok: true, key };
		} catch (err) {
			return fail(400, { ok: false, message: message(err) });
		}
	},
	revoke: async (event) => {
		try {
			const data = await body(event);
			revokeAiApiKey(database(), requireAdmin(event), String(data.id));
			return { ok: true, message: 'API key revoked.' };
		} catch (err) {
			return fail(400, { ok: false, message: message(err) });
		}
	}
} satisfies import('./$types').Actions;
