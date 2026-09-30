import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { activityTemplates } from '../activity-templates';
import { activitySchema } from '../validation';
import type { Store } from './db/client';
import { activities, boardColumns, pollQuestions, pollOptions } from './db/schema';
import { UserError } from './errors';
import { createActivity } from './sessions';

function owned(store: Store, ownerId: string, id: string) {
	const row = store.db
		.select()
		.from(activities)
		.where(and(eq(activities.id, id), eq(activities.ownerId, ownerId)))
		.get();
	if (!row) throw new UserError('Activity not found.');
	if (row.type === 'crossword') throw new UserError('This activity type is not available yet.');
	return row;
}
export function renameActivity(store: Store, ownerId: string, id: string, input: unknown) {
	const title = activitySchema.shape.title.parse(input);
	owned(store, ownerId, id);
	return store.db
		.update(activities)
		.set({ title })
		.where(and(eq(activities.id, id), eq(activities.ownerId, ownerId)))
		.returning()
		.get()!;
}
export function createLibraryActivity(store: Store, ownerId: string, input: unknown) {
	const data = activitySchema
		.extend({
			type: z.enum(['choice', 'wordcloud', 'board']),
			templateId: z.string().max(80).default('')
		})
		.parse(input);
	const template = activityTemplates.find((t) => t.id === data.templateId);
	if (data.templateId && (!template || template.type !== data.type))
		throw new UserError('Template not found for this activity type.');
	return store.sqlite.transaction(() => {
		const row = createActivity(store, ownerId, { title: data.title, type: data.type });
		template?.questions?.forEach((q, position) => {
			const id = randomUUID();
			store.db
				.insert(pollQuestions)
				.values({
					id,
					activityId: row.id,
					prompt: q.prompt,
					position,
					kind: data.type === 'choice' ? 'choice' : 'wordcloud',
					timeLimit: q.timeLimit ?? 20,
					wordLimit: q.wordLimit ?? 1,
					moderationEnabled: true,
					createdAt: Date.now()
				})
				.run();
			q.options?.forEach((label, position) =>
				store.db
					.insert(pollOptions)
					.values({
						id: randomUUID(),
						questionId: id,
						label,
						position,
						isCorrect: q.correctOptions?.includes(position) ?? false
					})
					.run()
			);
		});
		template?.columns?.forEach((title, position) =>
			store.db
				.insert(boardColumns)
				.values({ id: randomUUID(), activityId: row.id, title, position, createdAt: Date.now() })
				.run()
		);
		return row;
	})();
}
export function duplicateActivity(store: Store, ownerId: string, id: string, input?: unknown) {
	return store.sqlite.transaction(() => {
		const source = owned(store, ownerId, id);
		const title = activitySchema.shape.title.parse(input ?? `Copy — ${source.title}`.slice(0, 120));
		const copy = { ...source, id: randomUUID(), title, createdAt: Date.now() };
		store.db.insert(activities).values(copy).run();
		// Explicit allowlist: instructional content only. Never copy classroom records or media.
		for (const question of store.db
			.select()
			.from(pollQuestions)
			.where(eq(pollQuestions.activityId, id))
			.orderBy(asc(pollQuestions.position))
			.all()) {
			const questionId = randomUUID();
			store.db
				.insert(pollQuestions)
				.values({ ...question, id: questionId, activityId: copy.id, createdAt: Date.now() })
				.run();
			for (const option of store.db
				.select()
				.from(pollOptions)
				.where(eq(pollOptions.questionId, question.id))
				.orderBy(asc(pollOptions.position))
				.all()) {
				store.db
					.insert(pollOptions)
					.values({ ...option, id: randomUUID(), questionId })
					.run();
			}
		}
		for (const column of store.db
			.select()
			.from(boardColumns)
			.where(eq(boardColumns.activityId, id))
			.orderBy(asc(boardColumns.position))
			.all()) {
			store.db
				.insert(boardColumns)
				.values({ ...column, id: randomUUID(), activityId: copy.id, createdAt: Date.now() })
				.run();
		}
		return copy;
	})();
}
