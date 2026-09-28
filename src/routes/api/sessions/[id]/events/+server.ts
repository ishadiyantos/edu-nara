import { error } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { authorizeSession, snapshot } from '$lib/server/sessions';
import { authenticate } from '$lib/server/auth';
import { events } from '$lib/server/events';
import { limits } from '$lib/server/security';
import { activities, sessions } from '$lib/server/db/schema';
import { choiceTally, getChoiceQuestion } from '$lib/server/poll/choice';
import { eq } from 'drizzle-orm';
import { getWordcloudQuestionsByActivity, wordcloudSnapshot } from '$lib/server/poll/wordcloud';
export const GET: import('./$types').RequestHandler = (event) => {
	const store = database(),
		id = event.params.id,
		guest = event.cookies.get(`edu_p_${id}`),
		adminCookie = event.cookies.get('edu_admin');
	const admin = authenticate(store, adminCookie);
	const valid = () => authorizeSession(store, id, authenticate(store, adminCookie)?.id, guest);
	if (!valid()) error(401, 'Akses sesi ditolak.');
	const retry = limits.take(`stream:${admin?.id ?? guest}`, 30, 60000);
	if (retry)
		return new Response('Terlalu banyak koneksi.', {
			status: 429,
			headers: { 'Retry-After': String(retry) }
		});
	const joined = store.db
		.select({ session: sessions, activity: activities })
		.from(sessions)
		.innerJoin(activities, eq(activities.id, sessions.activityId))
		.where(eq(sessions.id, id))
		.get();
	if (!joined) error(404, 'Sesi tidak ditemukan.');
	const isOwner = !!admin && joined.activity.ownerId === admin.id;
	const streamSnapshot = () => {
		const base = snapshot(store, id);
		const question = base.activeQuestionId ? getChoiceQuestion(store, base.activeQuestionId) : null;
		if (joined.activity.type === 'wordcloud')
			return {
				...base,
				wordcloud: getWordcloudQuestionsByActivity(store, joined.session.activityId).map((q) => ({
					questionId: q.id,
					words: wordcloudSnapshot(store, id, q.id)
				}))
			};
		if (isOwner)
			return { ...base, question, tally: question ? choiceTally(store, id, question.id) : null };
		if (question?.showResults) return { ...base, tally: choiceTally(store, id, question.id) };
		return base;
	};
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
