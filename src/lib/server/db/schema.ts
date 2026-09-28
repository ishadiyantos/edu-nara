import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const admins = sqliteTable('admin_users', {
	id: text().primaryKey(),
	email: text().notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	createdAt: integer('created_at').notNull()
});
export const adminSessions = sqliteTable('admin_sessions', {
	tokenHash: text('token_hash').primaryKey(),
	adminId: text('admin_id')
		.notNull()
		.references(() => admins.id),
	expiresAt: integer('expires_at').notNull()
});
export const activities = sqliteTable('activities', {
	id: text().primaryKey(),
	ownerId: text('owner_id')
		.notNull()
		.references(() => admins.id),
	title: text().notNull(),
	type: text({ enum: ['choice', 'wordcloud', 'board', 'crossword'] })
		.notNull()
		.default('choice'),
	createdAt: integer('created_at').notNull()
});
export const sessions = sqliteTable('live_sessions', {
	id: text().primaryKey(),
	activityId: text('activity_id')
		.notNull()
		.references(() => activities.id),
	code: text().notNull().unique(),
	state: text({ enum: ['draft', 'open', 'closed', 'ended'] })
		.notNull()
		.default('draft'),
	activeQuestionId: text('active_question_id'),
	quizMode: text('quiz_mode', { enum: ['guided', 'self_paced'] })
		.notNull()
		.default('self_paced'),
	timerDeadline: integer('timer_deadline'),
	// Milliseconds remaining when paused; zero with no deadline means untimed.
	timerDuration: integer('timer_duration').notNull().default(0),
	createdAt: integer('created_at').notNull(),
	endedAt: integer('ended_at')
});
export const participants = sqliteTable(
	'participants',
	{
		id: text().primaryKey(),
		sessionId: text('session_id')
			.notNull()
			.references(() => sessions.id),
		displayName: text('display_name').notNull(),
		tokenHash: text('token_hash').notNull().unique(),
		expiresAt: integer('expires_at').notNull(),
		createdAt: integer('created_at').notNull()
	},
	(t) => [index('participant_session').on(t.sessionId)]
);
export const pollQuestions = sqliteTable(
	'poll_questions',
	{
		id: text().primaryKey(),
		activityId: text('activity_id')
			.notNull()
			.references(() => activities.id),
		prompt: text().notNull(),
		position: integer().notNull().default(0),
		showResults: integer('show_results', { mode: 'boolean' }).notNull().default(false),
		timeLimit: integer('time_limit').notNull().default(20),
		kind: text({ enum: ['choice', 'wordcloud'] })
			.notNull()
			.default('choice'),
		wordLimit: integer('word_limit').notNull().default(1),
		moderationEnabled: integer('moderation_enabled', { mode: 'boolean' }).notNull().default(true),
		createdAt: integer('created_at').notNull()
	},
	(t) => [
		index('poll_question_activity').on(t.activityId),
		uniqueIndex('poll_question_position').on(t.activityId, t.position)
	]
);
export const pollOptions = sqliteTable(
	'poll_options',
	{
		id: text().primaryKey(),
		questionId: text('question_id')
			.notNull()
			.references(() => pollQuestions.id),
		label: text().notNull(),
		position: integer().notNull(),
		isCorrect: integer('is_correct', { mode: 'boolean' }).notNull().default(false)
	},
	(t) => [index('poll_option_question').on(t.questionId)]
);
export const pollResponses = sqliteTable(
	'poll_responses',
	{
		id: text().primaryKey(),
		questionId: text('question_id')
			.notNull()
			.references(() => pollQuestions.id),
		sessionId: text('session_id')
			.notNull()
			.references(() => sessions.id),
		participantId: text('participant_id')
			.notNull()
			.references(() => participants.id),
		optionId: text('option_id')
			.notNull()
			.references(() => pollOptions.id),
		isCorrect: integer('is_correct', { mode: 'boolean' }).notNull().default(false),
		points: integer().notNull().default(0),
		createdAt: integer('created_at').notNull()
	},
	(t) => [
		uniqueIndex('poll_response_once').on(t.questionId, t.participantId),
		index('poll_response_session').on(t.sessionId, t.questionId)
	]
);
export const pollResponseOptions = sqliteTable(
	'poll_response_options',
	{
		responseId: text('response_id')
			.notNull()
			.references(() => pollResponses.id),
		optionId: text('option_id')
			.notNull()
			.references(() => pollOptions.id)
	},
	(t) => [
		uniqueIndex('poll_response_option_once').on(t.responseId, t.optionId),
		index('poll_response_option_option').on(t.optionId)
	]
);
export const boardColumns = sqliteTable(
	'board_columns',
	{
		id: text().primaryKey(),
		activityId: text('activity_id')
			.notNull()
			.references(() => activities.id),
		title: text().notNull(),
		position: integer().notNull().default(0),
		createdAt: integer('created_at').notNull()
	},
	(t) => [index('board_column_activity').on(t.activityId)]
);
export const boardPosts = sqliteTable(
	'board_posts',
	{
		id: text().primaryKey(),
		sessionId: text('session_id')
			.notNull()
			.references(() => sessions.id),
		columnId: text('column_id')
			.notNull()
			.references(() => boardColumns.id),
		participantId: text('participant_id')
			.notNull()
			.references(() => participants.id),
		body: text().notNull(),
		status: text({ enum: ['pending', 'approved', 'rejected'] })
			.notNull()
			.default('pending'),
		position: integer().notNull().default(0),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull()
	},
	(t) => [
		index('board_post_session_column').on(t.sessionId, t.columnId),
		index('board_post_status').on(t.sessionId, t.status)
	]
);
export const wordcloudResponses = sqliteTable(
	'wordcloud_responses',
	{
		id: text().primaryKey(),
		questionId: text('question_id')
			.notNull()
			.references(() => pollQuestions.id),
		sessionId: text('session_id')
			.notNull()
			.references(() => sessions.id),
		participantId: text('participant_id')
			.notNull()
			.references(() => participants.id),
		word: text().notNull(),
		status: text({ enum: ['pending', 'approved', 'rejected'] })
			.notNull()
			.default('pending'),
		createdAt: integer('created_at').notNull()
	},
	(t) => [
		uniqueIndex('wordcloud_response_once').on(t.questionId, t.sessionId, t.participantId, t.word),
		index('wordcloud_response_question_status').on(t.questionId, t.sessionId, t.status)
	]
);
