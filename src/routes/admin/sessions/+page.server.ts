import { eq, desc } from 'drizzle-orm';
import { database } from '$lib/server/db/client';
import { activities, sessions } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/http';
export const load: import('./$types').PageServerLoad = (event) => ({
	sessions: database()
		.db.select({
			id: sessions.id,
			code: sessions.code,
			state: sessions.state,
			createdAt: sessions.createdAt,
			title: activities.title
		})
		.from(sessions)
		.innerJoin(activities, eq(activities.id, sessions.activityId))
		.where(eq(activities.ownerId, requireAdmin(event)))
		.orderBy(desc(sessions.createdAt))
		.all()
});
