import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { database } from '$lib/server/db/client';
import { body, message, requireAdmin } from '$lib/server/http';
import { moveBoardPost } from '$lib/server/board';
import { sessionByCode } from '$lib/server/sessions';

const moveSchema = z
	.object({
		columnId: z.uuid(),
		position: z.number().int().min(0)
	})
	.strict();

export const POST: import('./$types').RequestHandler = async (event) => {
	let adminId: string;
	try {
		adminId = requireAdmin(event);
	} catch {
		return json({ ok: false, message: 'Silakan masuk.' }, { status: 401 });
	}
	try {
		const store = database();
		const session = sessionByCode(store, event.params.sessionCode);
		if (!session) return json({ ok: false, message: 'Sesi tidak tersedia.' }, { status: 404 });
		const data = moveSchema.parse(await body(event));
		return json({
			ok: true,
			columnId: data.columnId,
			ids: moveBoardPost(
				store,
				adminId,
				session.id,
				event.params.postId,
				data.columnId,
				data.position
			)
		});
	} catch (err) {
		return json({ ok: false, message: message(err) }, { status: 400 });
	}
};
