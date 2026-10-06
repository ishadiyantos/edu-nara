import { and, eq } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { activities } from '$lib/server/db/schema';
import { body, message, requireAdmin } from '$lib/server/http';
import {
	createCrosswordEntry,
	deleteCrosswordEntry,
	listCrosswordEntries,
	updateCrosswordEntry
} from '$lib/server/crossword';

export const load: import('./$types').PageServerLoad = (event) => {
	const owner = requireAdmin(event);
	const store = database();
	const activity = store.db
		.select()
		.from(activities)
		.where(
			and(
				eq(activities.id, event.params.id),
				eq(activities.ownerId, owner),
				eq(activities.type, 'crossword')
			)
		)
		.get();
	if (!activity) error(404, 'Crossword not found.');
	return { activity, entries: listCrosswordEntries(store, owner, activity.id) };
};

export const actions = {
	addEntry: async (event) => {
		const owner = requireAdmin(event);
		try {
			const data = await body(event);
			createCrosswordEntry(database(), owner, event.params.id, data);
			return { ok: true, message: 'Entry saved.' };
		} catch (err) {
			return fail(400, { message: message(err) });
		}
	},
	editEntry: async (event) => {
		const owner = requireAdmin(event);
		try {
			const data = await body(event);
			updateCrosswordEntry(database(), owner, event.params.id, String(data.entryId), data);
			return { ok: true, message: 'Entry updated.' };
		} catch (err) {
			return fail(400, { message: message(err) });
		}
	},
	deleteEntry: async (event) => {
		const owner = requireAdmin(event);
		try {
			const data = await body(event);
			deleteCrosswordEntry(database(), owner, event.params.id, String(data.entryId));
			return { ok: true, message: 'Entry deleted.' };
		} catch (err) {
			return fail(400, { message: message(err) });
		}
	}
} satisfies import('./$types').Actions;
