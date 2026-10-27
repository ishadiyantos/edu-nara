import { json } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { body, message, requireAdmin } from '$lib/server/http';
import { createAiApiKey, listAiApiKeys } from '$lib/server/ai-api-keys';

export const GET: import('./$types').RequestHandler = (event) => {
	try {
		return json({ ok: true, keys: listAiApiKeys(database(), requireAdmin(event)) });
	} catch {
		return json({ ok: false, message: 'Please log in.' }, { status: 401 });
	}
};

export const POST: import('./$types').RequestHandler = async (event) => {
	try {
		const ownerId = requireAdmin(event);
		const key = createAiApiKey(database(), ownerId, await body(event));
		return json({ ok: true, key }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		return json({ ok: false, message: message(err) }, { status: 400 });
	}
};
