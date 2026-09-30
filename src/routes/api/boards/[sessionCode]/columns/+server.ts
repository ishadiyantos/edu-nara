import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { database } from '$lib/server/db/client';
import { body, message, requireAdmin } from '$lib/server/http';
import { createBoardColumn } from '$lib/server/board';
import { sessionByCode } from '$lib/server/sessions';

export const POST: import('./$types').RequestHandler = async (event) => {
	let adminId: string;
	try {
		adminId = requireAdmin(event);
	} catch {
		return json({ ok: false, message: 'Please log in.' }, { status: 401 });
	}
	try {
		const store = database();
		const session = sessionByCode(store, event.params.sessionCode);
		if (!session) return json({ ok: false, message: 'Session not available.' }, { status: 404 });
		const data = z
			.object({ title: z.string().trim().min(1).max(120) })
			.strict()
			.parse(await body(event));
		return json({ ok: true, column: createBoardColumn(store, adminId, session.activityId, data) });
	} catch (err) {
		return json({ ok: false, message: message(err) }, { status: 400 });
	}
};
