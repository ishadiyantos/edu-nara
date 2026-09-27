import { error } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { authorizeSession, sessionByCode } from '$lib/server/sessions';
import { authenticate } from '$lib/server/auth';
import { choiceExportRows } from '$lib/server/poll/export';
import { csv } from '$lib/server/csv';
import { activities, sessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: import('./$types').RequestHandler = (event) => {
	const store = database();
	const session = sessionByCode(store, event.params.sessionCode);
	if (!session) error(404, 'Sesi tidak ditemukan.');
	const token = event.cookies.get(`edu_p_${session.id}`);
	const admin = authenticate(store, event.cookies.get('edu_admin'));
	if (!authorizeSession(store, session.id, admin?.id, token)) error(401, 'Akses sesi ditolak.');
	const owner = store.db
		.select({ ownerId: activities.ownerId })
		.from(sessions)
		.innerJoin(activities, eq(activities.id, sessions.activityId))
		.where(eq(sessions.id, session.id))
		.get();
	if (!admin || !owner || owner.ownerId !== admin.id) error(403, 'Akses ekspor ditolak.');
	return new Response(csv(choiceExportRows(store, session.id)), {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="rekap-${session.code}.csv"`,
			'Cache-Control': 'no-store'
		}
	});
};
