import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { database } from '$lib/server/db/client';
import { sessions, activities } from '$lib/server/db/schema';
import { sessionByCode, authorizeSession } from '$lib/server/sessions';
import {
	choiceTally,
	getChoiceQuestionByActivity,
	getChoiceQuestionsByActivity
} from '$lib/server/poll/choice';
import { authenticate } from '$lib/server/auth';
export const GET: import('./$types').RequestHandler = (event) => {
	const store = database();
	const session = sessionByCode(store, event.params.sessionCode);
	if (!session) return json({ ok: false }, { status: 404 });
	const token = event.cookies.get(`edu_p_${session.id}`);
	const admin = authenticate(store, event.cookies.get('edu_admin'));
	if (!authorizeSession(store, session.id, admin?.id, token))
		return json({ ok: false }, { status: 401 });
	const questionId = event.url.searchParams.get('questionId');
	const question = questionId
		? getChoiceQuestionsByActivity(store, session.activityId).find((q) => q.id === questionId)
		: getChoiceQuestionByActivity(store, session.activityId);
	if (!question) return json({ ok: false }, { status: 404 });
	const isOwner =
		!!admin &&
		store.db
			.select({ ownerId: activities.ownerId })
			.from(sessions)
			.innerJoin(activities, eq(activities.id, sessions.activityId))
			.where(eq(sessions.id, session.id))
			.get()?.ownerId === admin.id;
	if (!isOwner && !question.showResults)
		return json({ ok: false, message: 'Hasil belum dibuka dosen.' }, { status: 403 });
	return json(
		{
			ok: true,
			questionId: question.id,
			counts: choiceTally(store, session.id, question.id),
			correctOptionIds: question.options
				.filter((option) => option.isCorrect)
				.map((option) => option.id)
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};
