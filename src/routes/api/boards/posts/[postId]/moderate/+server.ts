import { json } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { body, message } from '$lib/server/http';
import { moderateBoardPost } from '$lib/server/board';
import { requireAdmin } from '$lib/server/http';
import { boardStatusSchema } from '$lib/validation';

export const POST: import('./$types').RequestHandler = async (event) => {
	let adminId: string;
	try {
		adminId = requireAdmin(event);
	} catch {
		return json({ ok: false, message: 'Silakan masuk.' }, { status: 401 });
	}
	try {
		const data = await body(event);
		const status = boardStatusSchema.parse(data.status ?? data.action);
		const post = moderateBoardPost(database(), adminId, event.params.postId, status);
		return json({ ok: true, postId: post.id, status: post.status });
	} catch (err) {
		return json({ ok: false, message: message(err) }, { status: 400 });
	}
};
