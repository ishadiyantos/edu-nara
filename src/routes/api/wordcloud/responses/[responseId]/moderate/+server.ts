import { json } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { body, message, requireAdmin } from '$lib/server/http';
import { wordcloudModerationSchema } from '$lib/poll/validation';
import { moderateWordcloudResponse } from '$lib/server/poll/wordcloud';

export const POST: import('./$types').RequestHandler = async (event) => {
	let adminId: string;
	try {
		adminId = requireAdmin(event);
	} catch {
		return json({ ok: false, message: 'Silakan masuk.' }, { status: 401 });
	}
	try {
		const data = await body(event);
		const { status } = wordcloudModerationSchema.parse(data);
		const row = moderateWordcloudResponse(database(), adminId, event.params.responseId, status);
		return json({ ok: true, responseId: row.id, status: row.status, lastEventId: row.lastEventId });
	} catch (err) {
		return json({ ok: false, message: message(err) }, { status: 400 });
	}
};
