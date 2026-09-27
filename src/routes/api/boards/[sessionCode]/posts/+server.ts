import { json } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { body, message } from '$lib/server/http';
import { boardSession, listBoard, submitBoardPost } from '$lib/server/board';
import { sessionByCode } from '$lib/server/sessions';
import { authenticate } from '$lib/server/auth';
import { boardPostSchema } from '$lib/validation';

export const GET: import('./$types').RequestHandler = (event) => {
	const store = database();
	const session = sessionByCode(store, event.params.sessionCode);
	if (!session) return json({ ok: false, message: 'Sesi tidak tersedia.' }, { status: 404 });
	const token = event.cookies.get(`edu_p_${session.id}`);
	const admin = authenticate(store, event.cookies.get('edu_admin'));
	if (!boardSession(store, session.id, token, admin?.id))
		return json({ ok: false, message: 'Akses papan ditolak.' }, { status: 401 });
	const { columns, posts } = listBoard(store, session.id, admin?.id);
	return json(
		{
			ok: true,
			columns: columns.map(({ id, title, position }) => ({ id, title, position })),
			posts: posts.map(({ id, columnId, body, status, position, createdAt }) => ({
				id,
				columnId,
				body,
				status,
				position,
				createdAt
			}))
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};

export const POST: import('./$types').RequestHandler = async (event) => {
	const store = database();
	const session = sessionByCode(store, event.params.sessionCode);
	if (!session) return json({ ok: false, message: 'Sesi tidak tersedia.' }, { status: 404 });
	const token = event.cookies.get(`edu_p_${session.id}`);
	if (!token) return json({ ok: false, message: 'Peserta belum terautentikasi.' }, { status: 401 });
	try {
		const data = boardPostSchema.parse(await body(event));
		const post = submitBoardPost(store, session.id, token, data.columnId, data.body);
		return json({ ok: true, postId: post.id, status: post.status, position: post.position });
	} catch (err) {
		return json({ ok: false, message: message(err) }, { status: 400 });
	}
};
