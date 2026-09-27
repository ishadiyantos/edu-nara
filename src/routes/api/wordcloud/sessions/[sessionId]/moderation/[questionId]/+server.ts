import { json } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { message, requireAdmin } from '$lib/server/http';
import { moderationQueue } from '$lib/server/poll/wordcloud';
export const GET: import('./$types').RequestHandler = (event) => {
	const owner = requireAdmin(event);
	try {
		const rows = moderationQueue(
			database(),
			owner,
			event.params.sessionId,
			event.params.questionId
		);
		return json({ ok: true, responses: rows }, { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		return json({ ok: false, message: message(err) }, { status: 403 });
	}
};
