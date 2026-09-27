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
	listBoard,
	moderateBoardPost,
	reorderBoardPosts,
	submitBoardPost
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
	const activity = createActivity(store, admin.id, { title: 'Papan kelas', type: 'board' });
	const firstColumn = createBoardColumn(store, admin.id, activity.id, { title: 'Ide' });
	const secondColumn = createBoardColumn(store, admin.id, activity.id, { title: 'Aksi' });
	const session = launchSession(store, admin.id, activity.id);
	changeState(store, admin.id, session.id, 'open');
	const participant = joinSession(store, { code: session.code, displayName: 'Ana' });
	return { store, admin, activity, firstColumn, secondColumn, session, participant };
}

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
