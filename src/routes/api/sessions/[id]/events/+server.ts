import { error } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { authorizeSession } from '$lib/server/sessions';
import { authenticate } from '$lib/server/auth';
import { events } from '$lib/server/events';
import { limits } from '$lib/server/security';
import { activities, sessions } from '$lib/server/db/schema';
import { sessionEventSnapshot } from '$lib/server/session-events';
import { eq } from 'drizzle-orm';

export const GET: import('./$types').RequestHandler = (event) => {
	const store = database(),
		id = event.params.id,
		guest = event.cookies.get(`edu_p_${id}`),
		adminCookie = event.cookies.get('edu_admin');
	const admin = authenticate(store, adminCookie);
	const valid = () => authorizeSession(store, id, authenticate(store, adminCookie)?.id, guest);
	if (!valid()) error(401, 'Session access denied.');
	const retry = limits.take(`stream:${admin?.id ?? guest}`, 30, 60000);
	if (retry)
		return new Response('Too many connections.', {
			status: 429,
			headers: { 'Retry-After': String(retry) }
		});
	const joined = store.db
		.select({ session: sessions, activity: activities })
		.from(sessions)
		.innerJoin(activities, eq(activities.id, sessions.activityId))
		.where(eq(sessions.id, id))
		.get();
	if (!joined) error(404, 'Session not found.');
	const isOwner = !!admin && joined.activity.ownerId === admin.id;
	const streamSnapshot = () =>
		sessionEventSnapshot(store, id, joined.activity.type, joined.session.activityId, isOwner);
	try {
		return new Response(
			events.subscribe(
				id,
				streamSnapshot,
				event.request.signal,
				event.request.headers.get('last-event-id') ?? undefined,
				valid
			),
			{
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-store',
					'X-Accel-Buffering': 'no'
				}
			}
		);
	} catch {
		return new Response('Server sibuk.', { status: 503, headers: { 'Retry-After': '20' } });
	}
};
