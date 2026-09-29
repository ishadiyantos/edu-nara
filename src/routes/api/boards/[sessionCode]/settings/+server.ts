import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { database } from '$lib/server/db/client';
import { body, message, requireAdmin } from '$lib/server/http';
import { sessionByCode } from '$lib/server/sessions';
import { setBoardModeration } from '$lib/server/board';
export const POST: import('./$types').RequestHandler = async (event) => {
	const admin = requireAdmin(event);
	try {
		const store = database();
		const session = sessionByCode(store, event.params.sessionCode);
		if (!session) return json({ ok: false, message: 'Sesi tidak ditemukan.' }, { status: 404 });
		const data = z
			.object({ moderationEnabled: z.boolean() })
			.strict()
			.parse(await body(event));
		return json({
			ok: true,
			moderationEnabled: setBoardModeration(
				store,
				admin,
				session.activityId,
				data.moderationEnabled
			)
		});
	} catch (err) {
		return json({ ok: false, message: message(err) }, { status: 400 });
	}
};
