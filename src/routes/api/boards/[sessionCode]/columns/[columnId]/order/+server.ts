import { json } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { body, message, requireAdmin } from '$lib/server/http';
import { reorderBoardPosts } from '$lib/server/board';
import { sessionByCode } from '$lib/server/sessions';
import { boardOrderSchema } from '$lib/validation';

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
		const data = boardOrderSchema.parse(await body(event));
		const order = reorderBoardPosts(store, adminId, session.id, event.params.columnId, data.ids);
		return json({ ok: true, columnId: event.params.columnId, ids: order });
	} catch (err) {
		return json({ ok: false, message: message(err) }, { status: 400 });
	}
};
