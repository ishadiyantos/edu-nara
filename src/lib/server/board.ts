import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt, max, or } from 'drizzle-orm';
import { z } from 'zod';
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
export function ownedBoard(store: Store, adminId: string, activityId: string) {
	const row = store.db
		.select()
		.from(activities)
		.where(
			and(
				eq(activities.id, activityId),
				eq(activities.ownerId, adminId),
				eq(activities.type, 'board')
			)
		)
		.get();
	if (!row) throw new UserError('Aktivitas papan tidak ditemukan.');
	return row;
}
function participant(store: Store, sessionId: string, token?: string) {
	if (!token || token.length > 100) return null;
	return (
		store.db
			.select()
			.from(participants)
			.where(
				and(
					eq(participants.sessionId, sessionId),
					eq(participants.tokenHash, hashToken(token)),
					gt(participants.expiresAt, Date.now())
				)
			)
			.get() ?? null
	);
}
export function boardSession(store: Store, sessionId: string, token?: string, adminId?: string) {
	const { activity } = sessionBoard(store, sessionId);
	return (!!adminId && activity.ownerId === adminId) || !!participant(store, sessionId, token);
}
function invalidateBoard(store: Store, activityId: string) {
	for (const session of store.db
		.select({ id: sessions.id })
		.from(sessions)
		.where(eq(sessions.activityId, activityId))
		.all())
		events.publish(session.id, 'board.reordered', {});
}
export function boardColumnsForActivity(store: Store, activityId: string) {
	return store.db
		.select()
		.from(boardColumns)
		.where(eq(boardColumns.activityId, activityId))
		.orderBy(asc(boardColumns.position))
		.all();
}
export function createBoardColumn(
	store: Store,
	adminId: string,
	activityId: string,
	input: unknown
) {
	const data = boardColumnSchema.parse(input);
	ownedBoard(store, adminId, activityId);
	const columns = boardColumnsForActivity(store, activityId);
	if (columns.length >= 20) throw new UserError('Maksimal 20 kolom.');
	const row = {
		id: randomUUID(),
		activityId,
		title: data.title,
		position: (columns.at(-1)?.position ?? -1) + 1,
		createdAt: Date.now()
	};
	store.db.insert(boardColumns).values(row).run();
	invalidateBoard(store, activityId);
	return row;
}
export function updateBoardColumn(
	store: Store,
	adminId: string,
	activityId: string,
	columnId: string,
	action: unknown,
	title?: unknown
) {
	ownedBoard(store, adminId, activityId);
	const columns = boardColumnsForActivity(store, activityId);
	const index = columns.findIndex((c) => c.id === columnId);
	if (index < 0) throw new UserError('Kolom tidak tersedia.');
	const operation = z.enum(['rename', 'delete', 'left', 'right']).parse(action);
	store.sqlite.transaction(() => {
		if (operation === 'rename') {
			store.db
				.update(boardColumns)
				.set(boardColumnSchema.parse({ title }))
				.where(eq(boardColumns.id, columnId))
				.run();
		} else if (operation === 'delete') {
			if (
				store.db
					.select({ id: boardPosts.id })
					.from(boardPosts)
					.where(eq(boardPosts.columnId, columnId))
					.get()
			)
				throw new UserError(
					'Kolom berisi kartu tidak dapat dihapus, termasuk kartu dari sesi lama.'
				);
			store.db.delete(boardColumns).where(eq(boardColumns.id, columnId)).run();
		} else {
			const target = index + (operation === 'left' ? -1 : 1);
			if (target < 0 || target >= columns.length) throw new UserError('Urutan kolom tidak valid.');
			[columns[index], columns[target]] = [columns[target], columns[index]];
			columns.forEach((column, position) =>
				store.db.update(boardColumns).set({ position }).where(eq(boardColumns.id, column.id)).run()
			);
		}
	})();
	invalidateBoard(store, activityId);
}
export function setBoardModeration(
	store: Store,
	adminId: string,
	activityId: string,
	enabled: unknown
) {
	ownedBoard(store, adminId, activityId);
	const boardModeration = z.boolean().parse(enabled);
	store.db.update(activities).set({ boardModeration }).where(eq(activities.id, activityId)).run();
	// Existing pending cards deliberately stay pending.
	invalidateBoard(store, activityId);
	return boardModeration;
}
export function submitBoardPost(
	store: Store,
	sessionId: string,
	token: string,
	columnId: string,
	body: string,
	extras: {
		title?: string;
		linkUrl?: string;
		requestId?: string;
		imageId?: string;
		previewTitle?: string;
		previewImageId?: string;
		cardColor?: string;
	} = {}
) {
	const { session, activity } = sessionBoard(store, sessionId);
	const author = participant(store, sessionId, token);
	if (!author) throw new UserError('Peserta belum terautentikasi.');
	const { imageId, previewTitle, previewImageId, ...fields } = extras;
	const data = boardPostSchema.parse({ columnId, body, ...fields });
	if (data.requestId) {
		const prior = store.db
			.select()
			.from(boardPosts)
			.where(
				and(
					eq(boardPosts.sessionId, sessionId),
					eq(boardPosts.participantId, author.id),
					eq(boardPosts.requestId, data.requestId)
				)
			)
			.get();
		if (prior) return { ...prior, lastEventId: null };
	}
	if (session.state !== 'open') throw new UserError('Sesi tidak menerima post.');
	if (!data.body && !data.title && !data.linkUrl && !imageId)
		throw new UserError('Isi teks, judul, tautan, atau gambar terlebih dahulu.');
	if (imageId) z.uuid().parse(imageId);
	if (previewImageId) z.uuid().parse(previewImageId);
	if (previewTitle) z.string().max(200).parse(previewTitle);
	const column = store.db
		.select({ id: boardColumns.id })
		.from(boardColumns)
		.where(and(eq(boardColumns.id, data.columnId), eq(boardColumns.activityId, activity.id)))
		.get();
	if (!column) throw new UserError('Kolom tidak tersedia.');
	const last = store.db
		.select({ position: max(boardPosts.position) })
		.from(boardPosts)
		.where(and(eq(boardPosts.sessionId, sessionId), eq(boardPosts.columnId, columnId)))
		.get();
	const now = Date.now();
	const row = {
		id: randomUUID(),
		sessionId,
		columnId,
		participantId: author.id,
		body: data.body,
		title: data.title,
		linkUrl: data.linkUrl || null,
		imageId: imageId ?? null,
		previewTitle: previewTitle ?? null,
		previewImageId: previewImageId ?? null,
		cardColor: data.cardColor,
		requestId: data.requestId ?? null,
		status: activity.boardModeration ? ('pending' as const) : ('approved' as const),
		position: (last?.position ?? -1) + 1,
		createdAt: now,
		updatedAt: now
	};
	store.db.insert(boardPosts).values(row).run();
	// Global replay contains invalidation only, never private content or identifiers.
	const lastEventId = events.publish(sessionId, 'board.post.new', {});
	return { ...row, lastEventId };
}
export function moveBoardPost(
	store: Store,
	adminId: string,
	sessionId: string,
	postId: string,
	targetColumnId: string,
	targetPosition: number
) {
	const { activity } = sessionBoard(store, sessionId);
	if (activity.ownerId !== adminId) throw new UserError('Akses admin ditolak.');
	if (!Number.isInteger(targetPosition) || targetPosition < 0) {
		throw new UserError('Posisi kartu tidak valid.');
	}
	const post = store.db
		.select()
		.from(boardPosts)
		.where(and(eq(boardPosts.id, postId), eq(boardPosts.sessionId, sessionId)))
		.get();
	const target = store.db
		.select({ id: boardColumns.id })
		.from(boardColumns)
		.where(and(eq(boardColumns.id, targetColumnId), eq(boardColumns.activityId, activity.id)))
		.get();
	if (!post || !target) throw new UserError('Kartu atau kolom tidak tersedia.');
	const sourcePosts = store.db
		.select()
		.from(boardPosts)
		.where(and(eq(boardPosts.sessionId, sessionId), eq(boardPosts.columnId, post.columnId)))
		.orderBy(asc(boardPosts.position), asc(boardPosts.createdAt))
		.all()
		.filter((item) => item.id !== postId);
	const targetPosts =
		post.columnId === targetColumnId
			? sourcePosts
			: store.db
					.select()
					.from(boardPosts)
					.where(and(eq(boardPosts.sessionId, sessionId), eq(boardPosts.columnId, targetColumnId)))
					.orderBy(asc(boardPosts.position), asc(boardPosts.createdAt))
					.all();
	const next = [...targetPosts];
	next.splice(Math.min(targetPosition, next.length), 0, post);
	store.sqlite.transaction(() => {
		if (post.columnId !== targetColumnId) {
			store.db
				.update(boardPosts)
				.set({ columnId: targetColumnId })
				.where(eq(boardPosts.id, postId))
				.run();
		}
		sourcePosts.forEach((item, position) =>
			store.db
				.update(boardPosts)
				.set({ position, updatedAt: Date.now() })
				.where(eq(boardPosts.id, item.id))
				.run()
		);
		next.forEach((item, position) =>
			store.db
				.update(boardPosts)
				.set({ columnId: targetColumnId, position, updatedAt: Date.now() })
				.where(eq(boardPosts.id, item.id))
				.run()
		);
	})();
	events.publish(sessionId, 'board.reordered', {});
	return next.map((item) => item.id);
}

export function moderateBoardPost(store: Store, adminId: string, postId: string, status: unknown) {
	const next = boardStatusSchema.parse(status);
	const row = store.db
		.select({ post: boardPosts, ownerId: activities.ownerId })
		.from(boardPosts)
		.innerJoin(sessions, eq(sessions.id, boardPosts.sessionId))
		.innerJoin(activities, eq(activities.id, sessions.activityId))
		.where(and(eq(boardPosts.id, postId), eq(activities.type, 'board')))
		.get();
	if (!row || row.ownerId !== adminId) throw new UserError('Post tidak ditemukan.');
	const updated = store.db
		.update(boardPosts)
		.set({ status: next, updatedAt: Date.now() })
		.where(eq(boardPosts.id, postId))
		.returning()
		.get()!;
	const lastEventId = events.publish(
		row.post.sessionId,
		next === 'rejected' || next === 'hidden' ? 'board.post.removed' : 'board.post.moderated',
		{}
	);
	return { ...updated, lastEventId };
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
	if (activity.ownerId !== adminId) throw new UserError('Akses admin ditolak.');
	if (!boardColumnsForActivity(store, activity.id).some((c) => c.id === columnId))
		throw new UserError('Kolom tidak tersedia.');
	const rows = store.db
		.select({ id: boardPosts.id })
		.from(boardPosts)
		.where(and(eq(boardPosts.sessionId, sessionId), eq(boardPosts.columnId, columnId)))
		.all()
		.map((p) => p.id);
	if (
		order.length !== rows.length ||
		new Set(order).size !== order.length ||
		order.some((id) => !rows.includes(id))
	)
		throw new UserError('Urutan post tidak valid. Muat ulang papan.');
	store.sqlite.transaction(() =>
		order.forEach((id, position) =>
			store.db
				.update(boardPosts)
				.set({ position, updatedAt: Date.now() })
				.where(eq(boardPosts.id, id))
				.run()
		)
	)();
	events.publish(sessionId, 'board.reordered', {});
	return order;
}
export function listBoard(store: Store, sessionId: string, adminId?: string, token?: string) {
	const { activity, session } = sessionBoard(store, sessionId);
	const isAdmin = !!adminId && activity.ownerId === adminId;
	const author = participant(store, sessionId, token);
	const columns = boardColumnsForActivity(store, activity.id);
	const posts = store.db
		.select({
			id: boardPosts.id,
			columnId: boardPosts.columnId,
			author: participants.displayName,
			body: boardPosts.body,
			title: boardPosts.title,
			linkUrl: boardPosts.linkUrl,
			imageId: boardPosts.imageId,
			previewTitle: boardPosts.previewTitle,
			previewImageId: boardPosts.previewImageId,
			cardColor: boardPosts.cardColor,
			status: boardPosts.status,
			position: boardPosts.position,
			createdAt: boardPosts.createdAt
		})
		.from(boardPosts)
		.innerJoin(participants, eq(participants.id, boardPosts.participantId))
		.where(
			and(
				eq(boardPosts.sessionId, sessionId),
				isAdmin
					? undefined
					: or(
							eq(boardPosts.status, 'approved'),
							author ? eq(boardPosts.participantId, author.id) : undefined
						)
			)
		)
		.orderBy(asc(boardPosts.position), asc(boardPosts.createdAt))
		.all()
		.map(({ imageId, previewImageId, createdAt, ...post }) => ({
			...post,
			createdAt: new Date(createdAt).toISOString(),
			imageUrl: imageId ? `/api/boards/images/${imageId}` : null,
			previewImageUrl: previewImageId ? `/api/boards/images/${previewImageId}` : null
		}));
	return {
		columns: columns.map(({ id, title, position }) => ({ id, title, position })),
		posts,
		moderationEnabled: activity.boardModeration,
		state: session.state
	};
}
export function boardImageAccess(store: Store, imageId: string, adminId?: string, token?: string) {
	const row = store.db
		.select({ post: boardPosts, ownerId: activities.ownerId })
		.from(boardPosts)
		.innerJoin(sessions, eq(sessions.id, boardPosts.sessionId))
		.innerJoin(activities, eq(activities.id, sessions.activityId))
		.where(
			and(
				or(eq(boardPosts.imageId, imageId), eq(boardPosts.previewImageId, imageId)),
				eq(activities.type, 'board')
			)
		)
		.get();
	if (!row) return null;
	if (adminId && row.ownerId === adminId) return row.post;
	const author = participant(store, row.post.sessionId, token);
	return author && (row.post.status === 'approved' || row.post.participantId === author.id)
		? row.post
		: null;
}
