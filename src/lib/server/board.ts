import { randomUUID } from 'node:crypto';
import { and, asc, eq, max } from 'drizzle-orm';
import type { Store } from './db/client';
import { UserError } from './errors';
import { hashToken } from './auth';
import { events } from './events';
import {
	boardColumnSchema,
	boardOrderSchema,
	boardPostSchema,
	boardStatusSchema
} from '../validation';
import { activities, boardColumns, boardPosts, participants, sessions } from './db/schema';

function sessionBoard(store: Store, sessionId: string) {
	const row = store.db
		.select({ session: sessions, activity: activities })
		.from(sessions)
		.innerJoin(activities, eq(activities.id, sessions.activityId))
		.where(and(eq(sessions.id, sessionId), eq(activities.type, 'board')))
		.get();
	if (!row) throw new UserError('Papan tidak ditemukan.');
	return row;
}

function ownedPost(store: Store, adminId: string, postId: string) {
	const row = store.db
		.select({ post: boardPosts, activity: activities })
		.from(boardPosts)
		.innerJoin(sessions, eq(sessions.id, boardPosts.sessionId))
		.innerJoin(activities, eq(activities.id, sessions.activityId))
		.where(
			and(eq(boardPosts.id, postId), eq(activities.ownerId, adminId), eq(activities.type, 'board'))
		)
		.get();
	if (!row) throw new UserError('Post tidak ditemukan.');
	return row.post;
}

function participant(store: Store, sessionId: string, token: string) {
	if (!token || token.length > 100) return null;
	return (
		store.db
			.select({ participant: participants })
			.from(participants)
			.where(
				and(eq(participants.sessionId, sessionId), eq(participants.tokenHash, hashToken(token)))
			)
			.get()?.participant ?? null
	);
}

function nextColumnPosition(store: Store, activityId: string) {
	const row = store.db
		.select({ position: max(boardColumns.position) })
		.from(boardColumns)
		.where(eq(boardColumns.activityId, activityId))
		.get();
	return row?.position == null ? 0 : Number(row.position) + 1;
}
function nextPostPosition(store: Store, sessionId: string, columnId: string) {
	const row = store.db
		.select({ position: max(boardPosts.position) })
		.from(boardPosts)
		.where(and(eq(boardPosts.sessionId, sessionId), eq(boardPosts.columnId, columnId)))
		.get();
	return row?.position == null ? 0 : Number(row.position) + 1;
}

export function createBoardColumn(
	store: Store,
	adminId: string,
	activityId: string,
	input: unknown
) {
	const data = boardColumnSchema.parse(input);
	const activity = store.db
		.select({ id: activities.id })
		.from(activities)
		.where(
			and(
				eq(activities.id, activityId),
				eq(activities.ownerId, adminId),
				eq(activities.type, 'board')
			)
		)
		.get();
	if (!activity) throw new UserError('Aktivitas papan tidak ditemukan.');
	const row = {
		id: randomUUID(),
		activityId,
		title: data.title,
		position: nextColumnPosition(store, activityId),
		createdAt: Date.now()
	};
	store.db.insert(boardColumns).values(row).run();
	return row;
}

export function submitBoardPost(
	store: Store,
	sessionId: string,
	token: string,
	columnId: string,
	body: string
) {
	const { session, activity } = sessionBoard(store, sessionId);
	if (session.state !== 'open') throw new UserError('Sesi tidak menerima post.');
	const author = participant(store, sessionId, token);
	if (!author) throw new UserError('Peserta belum terautentikasi.');
	const data = boardPostSchema.parse({ columnId, body });
	const column = store.db
		.select({ id: boardColumns.id })
		.from(boardColumns)
		.where(and(eq(boardColumns.id, data.columnId), eq(boardColumns.activityId, activity.id)))
		.get();
	if (!column) throw new UserError('Kolom tidak tersedia.');
	const now = Date.now();
	const row = {
		id: randomUUID(),
		sessionId,
		columnId: data.columnId,
		participantId: author.id,
		body: data.body,
		status: 'pending' as const,
		position: nextPostPosition(store, sessionId, data.columnId),
		createdAt: now,
		updatedAt: now
	};
	store.db.insert(boardPosts).values(row).run();
	events.publish(sessionId, 'board.post.new', {
		postId: row.id,
		columnId: row.columnId,
		status: row.status
	});
	return row;
}

export function moderateBoardPost(store: Store, adminId: string, postId: string, status: unknown) {
	const next = boardStatusSchema.parse(status);
	const post = ownedPost(store, adminId, postId);
	const updated = store.db
		.update(boardPosts)
		.set({ status: next, updatedAt: Date.now() })
		.where(eq(boardPosts.id, postId))
		.returning()
		.get()!;
	if (next === 'rejected')
		events.publish(post.sessionId, 'board.post.removed', { postId, columnId: post.columnId });
	else
		events.publish(post.sessionId, 'board.post.moderated', {
			postId,
			columnId: post.columnId,
			status: next,
			...(next === 'approved' ? { body: updated.body } : {})
		});
	return updated;
}

export function reorderBoardPosts(
	store: Store,
	adminId: string,
	sessionId: string,
	columnId: string,
	ids: unknown
) {
	const order = boardOrderSchema.parse({ ids }).ids;
	const { activity } = sessionBoard(store, sessionId);
	const column = store.db
		.select({ id: boardColumns.id })
		.from(boardColumns)
		.where(and(eq(boardColumns.id, columnId), eq(boardColumns.activityId, activity.id)))
		.get();
	if (!column) throw new UserError('Kolom tidak tersedia.');
	if (activity.ownerId !== adminId) throw new UserError('Akses admin ditolak.');
	const rows = store.db
		.select({ id: boardPosts.id })
		.from(boardPosts)
		.where(and(eq(boardPosts.sessionId, sessionId), eq(boardPosts.columnId, columnId)))
		.all()
		.map(({ id }) => id);
	if (
		order.length !== rows.length ||
		new Set(order).size !== order.length ||
		order.some((id) => !rows.includes(id))
	)
		throw new UserError('Urutan post tidak valid.');
	store.db.transaction((tx) =>
		order.forEach((id, position) =>
			tx
				.update(boardPosts)
				.set({ position, updatedAt: Date.now() })
				.where(eq(boardPosts.id, id))
				.run()
		)
	);
	events.publish(sessionId, 'board.reordered', { columnId, ids: order });
	return order;
}

export function listBoard(store: Store, sessionId: string, adminId?: string) {
	const { activity } = sessionBoard(store, sessionId);
	const isAdmin = !!adminId && activity.ownerId === adminId;
	const columns = store.db
		.select()
		.from(boardColumns)
		.where(eq(boardColumns.activityId, activity.id))
		.orderBy(asc(boardColumns.position))
		.all();
	const posts = store.db
		.select()
		.from(boardPosts)
		.where(
			isAdmin
				? eq(boardPosts.sessionId, sessionId)
				: and(eq(boardPosts.sessionId, sessionId), eq(boardPosts.status, 'approved'))
		)
		.orderBy(asc(boardPosts.position), asc(boardPosts.createdAt))
		.all();
	return { columns, posts };
}

export function boardSession(store: Store, sessionId: string, token?: string, adminId?: string) {
	const { activity } = sessionBoard(store, sessionId);
	if (adminId && activity.ownerId === adminId) return true;
	return !!token && !!participant(store, sessionId, token);
}
