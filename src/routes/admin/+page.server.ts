import { fail, redirect } from '@sveltejs/kit';
import { eq, desc } from 'drizzle-orm';
import { database } from '$lib/server/db/client';
import { activities, sessions } from '$lib/server/db/schema';
import { body, message, requireAdmin } from '$lib/server/http';
import { createActivity, launchSession } from '$lib/server/sessions';
export const load: import('./$types').PageServerLoad = (event) => {
	const owner = requireAdmin(event),
		store = database();
	return {
		activities: store.db
			.select()
			.from(activities)
			.where(eq(activities.ownerId, owner))
			.orderBy(desc(activities.createdAt))
			.all(),
		sessions: store.db
			.select({
				id: sessions.id,
				code: sessions.code,
				state: sessions.state,
				title: activities.title
			})
			.from(sessions)
			.innerJoin(activities, eq(activities.id, sessions.activityId))
			.where(eq(activities.ownerId, owner))
			.orderBy(desc(sessions.createdAt))
			.all()
	};
};
export const actions = {
	create: async (event) => {
		const owner = requireAdmin(event);
		try {
			createActivity(database(), owner, await body(event));
		} catch (err) {
			return fail(400, { message: message(err) });
		}
		return { message: 'Aktivitas dibuat. Buka editor untuk menyiapkan pertanyaan.' };
	},
	launch: async (event) => {
		const owner = requireAdmin(event);
		let id;
		try {
			const data = await body(event);
			id = launchSession(
				database(),
				owner,
				String(data.activityId),
				undefined,
				data.quizMode ?? 'guided'
			).id;
		} catch (err) {
			return fail(400, { message: message(err) });
		}
		redirect(303, `/admin/sessions/${id}`);
	}
} satisfies import('./$types').Actions;
