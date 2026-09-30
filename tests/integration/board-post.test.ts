import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../../src/lib/server/db/client';
import { seedAdmin } from '../../src/lib/server/auth';
import {
	changeState,
	createActivity,
	joinSession,
	launchSession
} from '../../src/lib/server/sessions';
import {
	createBoardColumn,
	setBoardModeration,
	boardImageAccess,
	listBoard,
	moderateBoardPost,
	moveBoardPost,
	reorderBoardPosts,
	submitBoardPost,
	updateBoardColumn
} from '../../src/lib/server/board';

const stores: ReturnType<typeof openDatabase>[] = [];
const dirs: string[] = [];
afterEach(() => {
	stores.splice(0).forEach((store) => {
		if (store.sqlite.open) store.sqlite.close();
	});
	dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

async function fixture(path = ':memory:') {
	const store = openDatabase(path);
	stores.push(store);
	const admin = await seedAdmin(store, {
		email: 'board@example.test',
		password: 'test-board-password-long'
	});
	const activity = createActivity(store, admin.id, { title: 'Class board', type: 'board' });
	const firstColumn = createBoardColumn(store, admin.id, activity.id, { title: 'Ide' });
	const secondColumn = createBoardColumn(store, admin.id, activity.id, { title: 'Aksi' });
	const session = launchSession(store, admin.id, activity.id);
	changeState(store, admin.id, session.id, 'open');
	const participant = joinSession(store, { code: session.code, displayName: 'Ana' });
	return { store, admin, activity, firstColumn, secondColumn, session, participant };
}

test('media and moderation remain scoped across toggle, retry, rejection and token expiry', async () => {
	const { store, admin, activity, firstColumn, session, participant } = await fixture();
	const other = joinSession(store, { code: session.code, displayName: 'Bela' });
	const post = submitBoardPost(store, session.id, participant.token, firstColumn.id, 'Privat', {
		requestId: 'retry-1',
		imageId: '12345678-1234-4234-8234-123456789abc'
	});
	expect(boardImageAccess(store, post.imageId!, undefined, other.token)).toBeNull();
	expect(boardImageAccess(store, post.imageId!, undefined, participant.token)).not.toBeNull();
	setBoardModeration(store, admin.id, activity.id, false);
	expect(listBoard(store, session.id, admin.id).posts[0].status).toBe('pending');
	expect(
		submitBoardPost(store, session.id, participant.token, firstColumn.id, 'Privat', {
			requestId: 'retry-1'
		}).id
	).toBe(post.id);
	expect(
		submitBoardPost(store, session.id, participant.token, firstColumn.id, 'Publik').status
	).toBe('approved');
	moderateBoardPost(store, admin.id, post.id, 'approved');
	expect(boardImageAccess(store, post.imageId!, undefined, other.token)).not.toBeNull();
	moderateBoardPost(store, admin.id, post.id, 'hidden');
	expect(boardImageAccess(store, post.imageId!, undefined, other.token)).toBeNull();
	expect(boardImageAccess(store, post.imageId!, admin.id)).not.toBeNull();
	setBoardModeration(store, admin.id, activity.id, true);
	expect(submitBoardPost(store, session.id, participant.token, firstColumn.id, 'Baru').status).toBe(
		'pending'
	);
	store.sqlite.prepare('UPDATE participants SET expires_at = 0').run();
	expect(() =>
		submitBoardPost(store, session.id, participant.token, firstColumn.id, 'Expired')
	).toThrow();
	expect(boardImageAccess(store, post.imageId!, undefined, participant.token)).toBeNull();
});

test('card color and link preview metadata persist and use scoped media access', async () => {
	const { store, admin, firstColumn, session, participant } = await fixture();
	const post = submitBoardPost(store, session.id, participant.token, firstColumn.id, 'Cek tautan', {
		linkUrl: 'https://example.com/video',
		cardColor: 'rose',
		previewTitle: 'Video pembelajaran',
		previewImageId: '12345678-1234-4234-8234-123456789abc'
	});
	const own = listBoard(store, session.id, undefined, participant.token).posts[0];
	expect(own).toMatchObject({
		cardColor: 'rose',
		previewTitle: 'Video pembelajaran',
		previewImageUrl: '/api/boards/images/12345678-1234-4234-8234-123456789abc'
	});
	expect(
		boardImageAccess(store, post.previewImageId!, undefined, participant.token)
	).not.toBeNull();
	expect(boardImageAccess(store, post.previewImageId!)).toBeNull();
	moderateBoardPost(store, admin.id, post.id, 'approved');
	expect(boardImageAccess(store, post.previewImageId!)).toBeNull();
	const other = joinSession(store, { code: session.code, displayName: 'Bela' });
	expect(boardImageAccess(store, post.previewImageId!, undefined, other.token)).not.toBeNull();
});

test('card color rejects arbitrary CSS values', async () => {
	const { store, firstColumn, session, participant } = await fixture();
	expect(() =>
		submitBoardPost(store, session.id, participant.token, firstColumn.id, 'X', {
			cardColor: 'url(javascript:alert(1))'
		})
	).toThrow();
});

test('board post validates 500 Unicode characters and persists as pending', async () => {
	const { store, firstColumn, session, participant } = await fixture();
	const post = submitBoardPost(
		store,
		session.id,
		participant.token,
		firstColumn.id,
		'😀'.repeat(500)
	);
	expect(post.status).toBe('pending');
	expect(post.body).toBe('😀'.repeat(500));
	expect(listBoard(store, session.id).posts).toHaveLength(0);
	expect(() =>
		submitBoardPost(store, session.id, participant.token, firstColumn.id, '😀'.repeat(501))
	).toThrow();
});

test('approved posts and reorder survive a fresh database handle', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'edu-board-'));
	dirs.push(dir);
	const { store, admin, firstColumn, secondColumn, session, participant } = await fixture(
		join(dir, 'test.db')
	);
	const first = submitBoardPost(store, session.id, participant.token, firstColumn.id, 'Pertama');
	const second = submitBoardPost(store, session.id, participant.token, firstColumn.id, 'Kedua');
	moderateBoardPost(store, admin.id, first.id, 'approved');
	moderateBoardPost(store, admin.id, second.id, 'approved');
	reorderBoardPosts(store, admin.id, session.id, firstColumn.id, [second.id, first.id]);
	const path = store.sqlite.name;
	store.sqlite.close();
	const reopened = openDatabase(path);
	stores.push(reopened);
	expect(listBoard(reopened, session.id).posts.map((post) => post.body)).toEqual([
		'Kedua',
		'Pertama'
	]);
	expect(
		reopened.db
			.select()
			.from((await import('../../src/lib/server/db/schema')).boardColumns)
			.all()
	).toHaveLength(2);
	expect(secondColumn.title).toBe('Aksi');
});

test('non-admin cannot moderate or reorder and public list hides rejected content', async () => {
	const { store, admin, firstColumn, session, participant } = await fixture();
	const post = submitBoardPost(store, session.id, participant.token, firstColumn.id, 'Rahasia');
	expect(() => moderateBoardPost(store, participant.token, post.id, 'approved')).toThrow();
	moderateBoardPost(store, admin.id, post.id, 'rejected');
	expect(listBoard(store, session.id).posts).toEqual([]);
	expect(() =>
		reorderBoardPosts(store, participant.token, session.id, firstColumn.id, [])
	).toThrow();
});

test('admin board read includes moderation state while public read returns approved only', async () => {
	const { store, admin, firstColumn, session, participant } = await fixture();
	const post = submitBoardPost(store, session.id, participant.token, firstColumn.id, 'Tinjau');
	expect(listBoard(store, session.id, admin.id).posts.map((row) => row.status)).toEqual([
		'pending'
	]);
	moderateBoardPost(store, admin.id, post.id, 'approved');
	expect(listBoard(store, session.id).posts.map((row) => row.body)).toEqual(['Tinjau']);
});

test('admin can move approved cards across columns and rename columns during a live session', async () => {
	const { store, admin, firstColumn, secondColumn, session, participant } = await fixture();
	const first = submitBoardPost(store, session.id, participant.token, firstColumn.id, 'Pertama');
	const second = submitBoardPost(store, session.id, participant.token, firstColumn.id, 'Kedua');
	const third = submitBoardPost(store, session.id, participant.token, secondColumn.id, 'Ketiga');
	for (const post of [first, second, third])
		moderateBoardPost(store, admin.id, post.id, 'approved');

	moveBoardPost(store, admin.id, session.id, first.id, secondColumn.id, 1);
	expect(
		listBoard(store, session.id).posts.map(({ body, columnId, position }) => ({
			body,
			columnId,
			position
		}))
	).toEqual([
		{ body: 'Kedua', columnId: firstColumn.id, position: 0 },
		{ body: 'Ketiga', columnId: secondColumn.id, position: 0 },
		{ body: 'Pertama', columnId: secondColumn.id, position: 1 }
	]);

	updateBoardColumn(store, admin.id, session.activityId, secondColumn.id, 'rename', 'Refleksi');
	expect(
		listBoard(store, session.id, admin.id).columns.find((column) => column.id === secondColumn.id)
			?.title
	).toBe('Refleksi');
});
