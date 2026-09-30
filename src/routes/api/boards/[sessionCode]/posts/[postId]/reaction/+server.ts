import { json } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { body, message } from '$lib/server/http';
import { sessionByCode } from '$lib/server/sessions';
import { toggleBoardReaction } from '$lib/server/board';

export const POST: import('./$types').RequestHandler = async (event) => {
	const store = database();
	const session = sessionByCode(store, event.params.sessionCode);
	if (!session) return json({ ok: false, message: 'Session not available.' }, { status: 404 });
	try {
		const token = event.cookies.get(`edu_p_${session.id}`);
		if (!token)
			return json({ ok: false, message: 'Participant not authenticated.' }, { status: 401 });
		const data = await body(event);
		return json({
			ok: true,
			...toggleBoardReaction(store, session.id, token, event.params.postId, data.emoji)
		});
	} catch (err) {
		return json({ ok: false, message: message(err) }, { status: 400 });
	}
};
