import { fail, redirect } from '@sveltejs/kit';
import { eq, desc, sql } from 'drizzle-orm';
import { database } from '$lib/server/db/client';
import { activities } from '$lib/server/db/schema';
import { body, message, requireAdmin } from '$lib/server/http';
import { launchSession } from '$lib/server/sessions';
import {
	createLibraryActivity,
	duplicateActivity,
	renameActivity
} from '$lib/server/activity-library';
import { editorPath } from '$lib/activity-templates';
export const load: import('./$types').PageServerLoad = (event) => {
	const owner = requireAdmin(event),
		store = database();
	return {
		activities: store.db
			.select({
				id: activities.id,
				title: activities.title,
				type: activities.type,
				createdAt: activities.createdAt,
				contentCount: sql<number>`CASE WHEN ${activities.type} = 'board' THEN (SELECT COUNT(*) FROM board_columns WHERE activity_id = ${activities.id}) ELSE (SELECT COUNT(*) FROM poll_questions WHERE activity_id = ${activities.id}) END`,
				preview: sql<
					string | null
				>`CASE WHEN ${activities.type} = 'board' THEN (SELECT title FROM board_columns WHERE activity_id = ${activities.id} ORDER BY position LIMIT 1) ELSE (SELECT prompt FROM poll_questions WHERE activity_id = ${activities.id} ORDER BY position LIMIT 1) END`,
				ongoing: sql<number>`(SELECT COUNT(*) FROM live_sessions WHERE activity_id = ${activities.id} AND state != 'ended')`
			})
			.from(activities)
			.where(eq(activities.ownerId, owner))
			.orderBy(desc(activities.createdAt))
			.all()
	};
};
export const actions = {
	create: async (event) => {
		const owner = requireAdmin(event);
		let activity;
		try {
			activity = createLibraryActivity(database(), owner, await body(event));
		} catch (err) {
			return fail(400, { message: message(err) });
		}
		redirect(303, editorPath(activity));
	},
	rename: async (event) => {
		const owner = requireAdmin(event);
		try {
			const data = await body(event);
			renameActivity(database(), owner, String(data.activityId), data.title);
		} catch (err) {
			return fail(400, { message: message(err) });
		}
		return { message: 'Activity renamed.' };
	},
	duplicate: async (event) => {
		const owner = requireAdmin(event);
		let activity;
		try {
			const data = await body(event);
			activity = duplicateActivity(database(), owner, String(data.activityId), data.title);
		} catch (err) {
			return fail(400, { message: message(err) });
		}
		redirect(303, editorPath(activity));
	},
	launch: async (event) => {
		const owner = requireAdmin(event);
		let id;
		try {
			const data = await body(event);
			const activity = database()
				.db.select()
				.from(activities)
				.where(eq(activities.id, String(data.activityId)))
				.get();
			if (!activity || activity.ownerId !== owner || activity.type === 'crossword')
				return fail(400, { message: 'Activity not available.' });
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
