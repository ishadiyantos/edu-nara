import { error, fail } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { body, message, requireAdmin } from '$lib/server/http';
import {
	boardColumnsForActivity,
	createBoardColumn,
	ownedBoard,
	setBoardModeration,
	updateBoardColumn
} from '$lib/server/board';
export const load: import('./$types').PageServerLoad = (event) => {
	const store = database();
	try {
		const activity = ownedBoard(store, requireAdmin(event), event.params.id);
		return { activity, columns: boardColumnsForActivity(store, activity.id) };
	} catch {
		error(404, 'Board not found.');
	}
};
export const actions = {
	default: async (event) => {
		const admin = requireAdmin(event);
		try {
			const data = await body(event);
			const store = database();
			if (data.action === 'create')
				createBoardColumn(store, admin, event.params.id, { title: data.title });
			else if (data.action === 'moderation') {
				if (!['true', 'false'].includes(String(data.enabled)))
					return fail(400, { ok: false, message: 'Invalid settings.' });
				setBoardModeration(store, admin, event.params.id, data.enabled === 'true');
			} else
				updateBoardColumn(
					store,
					admin,
					event.params.id,
					String(data.columnId),
					data.action,
					data.title
				);
			return { ok: true, message: 'Board saved.' };
		} catch (err) {
			return fail(400, { ok: false, message: message(err) });
		}
	}
} satisfies import('./$types').Actions;
