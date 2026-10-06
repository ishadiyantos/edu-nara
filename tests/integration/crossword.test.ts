import { afterEach, expect, test } from 'vitest';
import { openDatabase } from '../../src/lib/server/db/client';
import { seedAdmin } from '../../src/lib/server/auth';
import {
	changeState,
	createActivity,
	joinSession,
	launchSession
} from '../../src/lib/server/sessions';
import {
	checkCrossword,
	createCrosswordEntry,
	crosswordPlayerPayload,
	deleteCrosswordEntry,
	participantCrosswordProgress,
	saveCrosswordProgress
} from '../../src/lib/server/crossword';

const stores: ReturnType<typeof openDatabase>[] = [];
afterEach(() => stores.splice(0).forEach((store) => store.sqlite.close()));

async function fixture() {
	const store = openDatabase(':memory:');
	stores.push(store);
	const admin = await seedAdmin(store, {
		email: 'crossword@example.test',
		password: 'test-crossword-password-long'
	});
	const activity = createActivity(store, admin.id, { title: 'Crossword', type: 'crossword' });
	const session = launchSession(store, admin.id, activity.id);
	changeState(store, admin.id, session.id, 'open');
	const participant = joinSession(store, { code: session.code, displayName: 'Ana' });
	return { store, admin, activity, session, participant };
}

test('manual crossword validates overlap and hides answers from player payload', async () => {
	const { store, admin, activity, session, participant } = await fixture();
	const first = createCrosswordEntry(store, admin.id, activity.id, {
		answer: 'rice',
		clue: 'Staple crop',
		row: 0,
		col: 0,
		direction: 'across'
	});
	expect(first.answer).toBe('RICE');
	expect(() =>
		createCrosswordEntry(store, admin.id, activity.id, {
			answer: 'BAD ANSWER',
			clue: 'Invalid',
			row: 5,
			col: 5,
			direction: 'across'
		})
	).toThrow();
	expect(() =>
		createCrosswordEntry(store, admin.id, activity.id, {
			answer: 'TOOLONG',
			clue: 'Runs off grid',
			row: 24,
			col: 24,
			direction: 'across'
		})
	).toThrow('Crossword entry exceeds the 25 by 25 grid.');
	const crossing = createCrosswordEntry(store, admin.id, activity.id, {
		answer: 'CROP',
		clue: 'Wilayah permukiman rural',
		row: 0,
		col: 2,
		direction: 'down'
	});
	expect(first.number).toBe(1);
	expect(crossing.number).toBe(2);
	expect(() =>
		createCrosswordEntry(store, admin.id, activity.id, {
			answer: 'KOTA',
			clue: 'Overlap salah',
			row: 0,
			col: 2,
			direction: 'down'
		})
	).toThrow('Crossword letters overlap with different answers.');
	expect(() =>
		createCrosswordEntry(store, admin.id, activity.id, {
			answer: 'RICE',
			clue: 'Duplikat',
			row: 4,
			col: 0,
			direction: 'across'
		})
	).toThrow('Duplicate crossword answer.');
	const payload = crosswordPlayerPayload(store, session.id, participant.token);
	expect(JSON.stringify(payload)).not.toMatch(/RICE|CROP/);
	expect(payload.entries.every((entry) => !('answer' in entry))).toBe(true);
	expect(payload.entries).toEqual([
		expect.objectContaining({ number: 1, row: 0, col: 0, direction: 'across', length: 4 }),
		expect.objectContaining({ number: 2, row: 0, col: 2, direction: 'down', length: 4 })
	]);
	expect(payload.gridShape[0].slice(0, 4)).toEqual([1, 1, 1, 1]);
	expect(payload.numbers[0][0]).toBe(1);
	expect(payload.numbers[0][2]).toBe(2);
});

test('crossword progress is scoped by participant and checked server-side', async () => {
	const { store, admin, activity, session, participant } = await fixture();
	createCrosswordEntry(store, admin.id, activity.id, {
		answer: 'PADI',
		clue: 'Tanaman pangan sawah',
		row: 0,
		col: 0,
		direction: 'across'
	});
	const saved = saveCrosswordProgress(store, session.id, participant.token, {
		cells: { '0,0': 'p', '0,1': 'a', '0,2': '', '9,9': 'X' }
	});
	expect(saved.cells).toEqual({ '0,0': 'P', '0,1': 'A' });
	expect(participantCrosswordProgress(store, session.id, participant.token)).toEqual({
		cells: { '0,0': 'P', '0,1': 'A' }
	});
	const result = checkCrossword(store, session.id, participant.token, {
		cells: { '0,0': 'P', '0,1': 'A', '0,2': 'x', '0,3': 'I' }
	});
	expect(result).toEqual({
		ok: true,
		correctCells: { '0,0': true, '0,1': true, '0,2': false, '0,3': true },
		complete: false,
		filledCount: 4,
		totalCells: 4,
		score: 3
	});
	changeState(store, admin.id, session.id, 'closed');
	expect(() => saveCrosswordProgress(store, session.id, participant.token, { cells: {} })).toThrow(
		'Session is not accepting answers.'
	);
	expect(() => checkCrossword(store, session.id, participant.token, { cells: {} })).toThrow(
		'Session is not accepting answers.'
	);
});

test('crossword entries can be deleted by owner only', async () => {
	const { store, admin, activity } = await fixture();
	const entry = createCrosswordEntry(store, admin.id, activity.id, {
		answer: 'AIR',
		clue: 'Kebutuhan irigasi',
		row: 1,
		col: 1,
		direction: 'across'
	});
	expect(() => deleteCrosswordEntry(store, 'other', activity.id, entry.id)).toThrow();
	deleteCrosswordEntry(store, admin.id, activity.id, entry.id);
	expect(
		crosswordPlayerPayload(store, launchSession(store, admin.id, activity.id).id).entries
	).toEqual([]);
});
