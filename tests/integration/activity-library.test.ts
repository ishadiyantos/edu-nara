import { afterEach, expect, test } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDatabase } from '../../src/lib/server/db/client';
import {
	admins,
	activities,
	pollQuestions,
	pollOptions,
	boardColumns
} from '../../src/lib/server/db/schema';
import {
	createLibraryActivity,
	duplicateActivity,
	renameActivity
} from '../../src/lib/server/activity-library';
import { activityTemplates } from '../../src/lib/activity-templates';

const stores: ReturnType<typeof openDatabase>[] = [];
afterEach(() => stores.splice(0).forEach((s) => s.sqlite.close()));
function fixture() {
	const store = openDatabase(':memory:');
	stores.push(store);
	store.db
		.insert(admins)
		.values(
			['owner', 'other'].map((id) => ({
				id,
				email: `${id}@example.test`,
				passwordHash: 'unused',
				createdAt: 1
			}))
		)
		.run();
	return store;
}

test('all six templates create editable content; copies isolate owned content and exclude session data', () => {
	const store = fixture();
	expect(activityTemplates).toHaveLength(6);
	for (const template of activityTemplates) {
		const original = createLibraryActivity(store, 'owner', {
			title: 'Konten asli',
			type: template.type,
			templateId: template.id
		});
		const questions = store.db
			.select()
			.from(pollQuestions)
			.where(eq(pollQuestions.activityId, original.id))
			.all();
		const columns = store.db
			.select()
			.from(boardColumns)
			.where(eq(boardColumns.activityId, original.id))
			.all();
		expect(questions.length + columns.length).toBeGreaterThan(0);
		store.sqlite
			.prepare('INSERT INTO live_sessions (id, activity_id, code, created_at) VALUES (?, ?, ?, 1)')
			.run(template.id, original.id, template.id);
		store.sqlite
			.prepare(
				'INSERT INTO participants (id, session_id, display_name, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, 9999999999999, 1)'
			)
			.run(template.id, template.id, 'Student', template.id);
		if (columns.length)
			store.sqlite
				.prepare(
					'INSERT INTO board_posts (id, session_id, column_id, participant_id, body, image_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 1)'
				)
				.run(
					template.id,
					template.id,
					columns[0].id,
					template.id,
					'Private response',
					`private-image-${template.id}`
				);
		if (questions[0]?.kind === 'wordcloud')
			store.sqlite
				.prepare(
					'INSERT INTO wordcloud_responses (id, question_id, session_id, participant_id, word, created_at) VALUES (?, ?, ?, ?, ?, 1)'
				)
				.run(template.id, questions[0].id, template.id, template.id, 'private');
		const options = questions.flatMap((q) =>
			store.db.select().from(pollOptions).where(eq(pollOptions.questionId, q.id)).all()
		);
		if (options.length)
			store.sqlite
				.prepare(
					'INSERT INTO poll_responses (id, question_id, session_id, participant_id, option_id, created_at) VALUES (?, ?, ?, ?, ?, 1)'
				)
				.run(template.id, questions[0].id, template.id, template.id, options[0].id);
		const tables = [
			'live_sessions',
			'participants',
			'poll_responses',
			'wordcloud_responses',
			'board_posts'
		];
		const counts = () =>
			tables.map((t) => store.sqlite.prepare(`SELECT count(*) AS n FROM ${t}`).get());
		const before = counts();
		expect(() => duplicateActivity(store, 'other', original.id)).toThrow('Activity not found.');
		expect(() => renameActivity(store, 'other', original.id, 'Stolen')).toThrow(
			'Activity not found.'
		);
		const copy = duplicateActivity(store, 'owner', original.id);
		expect(copy.id).not.toBe(original.id);
		expect(copy.title).toBe('Copy — Konten asli');
		const copied = store.db
			.select()
			.from(pollQuestions)
			.where(eq(pollQuestions.activityId, copy.id))
			.all();
		expect(
			copied.map((q) => [q.kind, q.prompt, q.timeLimit, q.wordLimit, q.moderationEnabled])
		).toEqual(
			questions.map((q) => [q.kind, q.prompt, q.timeLimit, q.wordLimit, q.moderationEnabled])
		);
		copied.forEach((q, i) => {
			expect(q.id).not.toBe(questions[i].id);
			const newOptions = store.db
				.select()
				.from(pollOptions)
				.where(eq(pollOptions.questionId, q.id))
				.all();
			const oldOptions = options.filter((o) => o.questionId === questions[i].id);
			expect(newOptions.map((o) => [o.label, o.position, o.isCorrect])).toEqual(
				oldOptions.map((o) => [o.label, o.position, o.isCorrect])
			);
			expect(newOptions.every((o) => !options.some((old) => old.id === o.id))).toBe(true);
		});
		const copiedColumns = store.db
			.select()
			.from(boardColumns)
			.where(eq(boardColumns.activityId, copy.id))
			.all();
		expect(copiedColumns.map((c) => [c.title, c.position])).toEqual(
			columns.map((c) => [c.title, c.position])
		);
		expect(copiedColumns.every((c) => !columns.some((old) => old.id === c.id))).toBe(true);
		expect(counts()).toEqual(before);
		renameActivity(store, 'owner', copy.id, 'Independent copy');
		expect(
			store.db.select().from(activities).where(eq(activities.id, original.id)).get()?.title
		).toBe('Konten asli');
	}
});

test('copy rolls back all writes on child failure; invalid creation never writes', () => {
	const store = fixture();
	const original = createLibraryActivity(store, 'owner', {
		title: 'Original',
		type: 'choice',
		templateId: 'quiz-understanding'
	});
	const before = store.db.select().from(activities).all();
	store.sqlite.exec(
		"CREATE TRIGGER fail_copy BEFORE INSERT ON poll_options BEGIN SELECT RAISE(ABORT, 'copy failure'); END"
	);
	expect(() => duplicateActivity(store, 'owner', original.id)).toThrow();
	expect(store.db.select().from(activities).all()).toEqual(before);
	expect(
		store.db
			.select()
			.from(pollQuestions)
			.all()
			.every((q) => q.activityId === original.id)
	).toBe(true);
	expect(() =>
		createLibraryActivity(store, 'owner', {
			title: 'bad',
			type: 'board',
			templateId: 'quiz-understanding'
		})
	).toThrow();
	const crossword = createLibraryActivity(store, 'owner', {
		title: 'Crossword',
		type: 'crossword'
	});
	expect(crossword.type).toBe('crossword');
	expect(() => renameActivity(store, 'owner', original.id, ' ')).toThrow();
});

test('blank activity remains blank', () => {
	const store = fixture();
	const row = createLibraryActivity(store, 'owner', {
		title: 'Blank',
		type: 'board',
		templateId: ''
	});
	expect(row.type).toBe('board');
	expect(store.db.select().from(boardColumns).all()).toEqual([]);
});
