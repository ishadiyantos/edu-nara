import { json } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { message, requireAdmin } from '$lib/server/http';
import { revokeAiApiKey } from '$lib/server/ai-api-keys';

export const DELETE: import('./$types').RequestHandler = (event) => {
	try {
		revokeAiApiKey(database(), requireAdmin(event), event.params.id);
		return json({ ok: true });
	} catch (err) {
		return json({ ok: false, message: message(err) }, { status: 404 });
	}
};
