import { and, asc, eq, gt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Store } from './db/client';
import {
	activities,
	crosswordAttempts,
	crosswordEntries,
	participants,
	sessions
} from './db/schema';
import { UserError } from './errors';
import { hashToken } from './auth';

const entrySchema = z.object({
	answer: z
		.string()
		.trim()
		.min(1)
		.max(40)
		.regex(/^[A-Za-z0-9]+$/, 'Answer must contain letters or numbers only.')
		.transform((value) => value.toUpperCase()),
	clue: z.string().trim().min(1).max(240),
	row: z.coerce.number().int().min(0).max(24),
	col: z.coerce.number().int().min(0).max(24),
	direction: z.enum(['across', 'down'])
});
const cellsSchema = z.record(z.string().regex(/^\d+,\d+$/), z.string().max(1));
const progressSchema = z.object({ cells: cellsSchema });
type Cell = { row: number; col: number };

type EntryInput = z.infer<typeof entrySchema>;

function ownedActivity(store: Store, ownerId: string, activityId: string) {
	const activity = store.db
		.select()
		.from(activities)
		.where(and(eq(activities.id, activityId), eq(activities.ownerId, ownerId)))
		.get();
	if (!activity || activity.type !== 'crossword')
		throw new UserError('Crossword activity not found.');
	return activity;
}
function cells(entry: Pick<EntryInput, 'row' | 'col' | 'answer' | 'direction'>): Cell[] {
	return [...entry.answer].map((_, index) => ({
		row: entry.row + (entry.direction === 'down' ? index : 0),
		col: entry.col + (entry.direction === 'across' ? index : 0)
	}));
}
function currentEntries(store: Store, activityId: string) {
	return store.db
		.select()
		.from(crosswordEntries)
		.where(eq(crosswordEntries.activityId, activityId))
		.orderBy(asc(crosswordEntries.number))
		.all();
}
function validateLayout(entries: Array<EntryInput & { id?: string }>) {
	const occupied = new Map<string, string>();
	for (const entry of entries) {
		for (const [index, cell] of cells(entry).entries()) {
			if (cell.row > 24 || cell.col > 24)
				throw new UserError('Crossword entry exceeds the 25 by 25 grid.');
			const key = `${cell.row},${cell.col}`;
			const letter = entry.answer[index];
			const previous = occupied.get(key);
			if (previous && previous !== letter)
				throw new UserError('Crossword letters overlap with different answers.');
			occupied.set(key, letter);
		}
	}
	return occupied;
}
function nextNumber(entries: Array<{ row: number; col: number }>, row: number, col: number) {
	const starts = new Set(entries.map((entry) => `${entry.row},${entry.col}`));
	let number = 1;
	for (const key of [...starts].sort((a, b) => {
		const [ar, ac] = a.split(',').map(Number);
		const [br, bc] = b.split(',').map(Number);
		return ar - br || ac - bc;
	})) {
		if (key === `${row},${col}`) return number;
		number++;
	}
	return number;
}
function ensureParticipant(store: Store, sessionId: string, token?: string, now = Date.now()) {
	if (!token) throw new UserError('Participant access denied.');
	const participant = store.db
		.select({ id: participants.id, columnId: participants.columnId })
		.from(participants)
		.where(
			and(
				eq(participants.sessionId, sessionId),
				eq(participants.tokenHash, hashToken(token)),
				gt(participants.expiresAt, now)
			)
		)
		.get();
	if (!participant) throw new UserError('Participant access denied.');
	return participant;
}
function sessionActivity(store: Store, sessionId: string) {
	const row = store.db
		.select({ sessionId: sessions.id, activityId: sessions.activityId, state: sessions.state })
		.from(sessions)
		.innerJoin(activities, eq(activities.id, sessions.activityId))
		.where(and(eq(sessions.id, sessionId), eq(activities.type, 'crossword')))
		.get();
	if (!row) throw new UserError('Crossword session not found.');
	return row;
}

function openSession(store: Store, sessionId: string) {
	const session = sessionActivity(store, sessionId);
	if (session.state !== 'open') throw new UserError('Session is not accepting answers.');
	return session;
}

export function listCrosswordEntries(store: Store, ownerId: string, activityId: string) {
	ownedActivity(store, ownerId, activityId);
	return currentEntries(store, activityId);
}

export function createCrosswordEntry(
	store: Store,
	ownerId: string,
	activityId: string,
	input: unknown
) {
	ownedActivity(store, ownerId, activityId);
	const data = entrySchema.parse(input);
	const existing = currentEntries(store, activityId);
	if (existing.some((entry) => entry.answer === data.answer))
		throw new UserError('Duplicate crossword answer.');
	validateLayout([...existing, data]);
	const id = randomUUID();
	const number = nextNumber(existing, data.row, data.col);
	return store.db
		.insert(crosswordEntries)
		.values({ ...data, id, activityId, number, createdAt: Date.now() })
		.returning()
		.get()!;
}

export function updateCrosswordEntry(
	store: Store,
	ownerId: string,
	activityId: string,
	entryId: string,
	input: unknown
) {
	ownedActivity(store, ownerId, activityId);
	const data = entrySchema.parse(input);
	const existing = currentEntries(store, activityId).filter((entry) => entry.id !== entryId);
	if (
		!store.db
			.select()
			.from(crosswordEntries)
			.where(and(eq(crosswordEntries.id, entryId), eq(crosswordEntries.activityId, activityId)))
			.get()
	)
		throw new UserError('Crossword entry not found.');
	if (existing.some((entry) => entry.answer === data.answer))
		throw new UserError('Duplicate crossword answer.');
	validateLayout([...existing, data]);
	return store.db
		.update(crosswordEntries)
		.set({ ...data, number: nextNumber(existing, data.row, data.col) })
		.where(eq(crosswordEntries.id, entryId))
		.returning()
		.get()!;
}

export function deleteCrosswordEntry(
	store: Store,
	ownerId: string,
	activityId: string,
	entryId: string
) {
	ownedActivity(store, ownerId, activityId);
	store.db
		.delete(crosswordEntries)
		.where(and(eq(crosswordEntries.id, entryId), eq(crosswordEntries.activityId, activityId)))
		.run();
}

export function crosswordPlayerPayload(store: Store, sessionId: string, token?: string) {
	const session = sessionActivity(store, sessionId);
	const participant = token ? ensureParticipant(store, sessionId, token) : undefined;
	const entries = currentEntries(store, session.activityId);
	const occupied = validateLayout(entries);
	const maxRow = Math.max(0, ...[...occupied.keys()].map((key) => Number(key.split(',')[0])));
	const maxCol = Math.max(0, ...[...occupied.keys()].map((key) => Number(key.split(',')[1])));
	const gridShape = Array.from({ length: maxRow + 1 }, (_, row) =>
		Array.from({ length: maxCol + 1 }, (_, col) => (occupied.has(`${row},${col}`) ? 1 : 0))
	);
	const numbers = Array.from({ length: maxRow + 1 }, (_, row) =>
		Array.from({ length: maxCol + 1 }, (_, col) => {
			const entry = entries.find((item) => item.row === row && item.col === col);
			return entry?.number ?? 0;
		})
	);
	return {
		gridShape,
		numbers,
		entries: entries.map(({ id, clue, row, col, direction, number, answer }) => ({
			id,
			clue,
			row,
			col,
			direction,
			number,
			length: answer.length
		})),
		progress: participant ? participantCrosswordProgress(store, sessionId, token) : { cells: {} }
	};
}

export function participantCrosswordProgress(store: Store, sessionId: string, token?: string) {
	const participant = ensureParticipant(store, sessionId, token);
	const row = store.db
		.select({ answerStateJson: crosswordAttempts.answerStateJson })
		.from(crosswordAttempts)
		.where(
			and(
				eq(crosswordAttempts.sessionId, sessionId),
				eq(crosswordAttempts.participantId, participant.id)
			)
		)
		.get();
	return { cells: row ? (JSON.parse(row.answerStateJson) as Record<string, string>) : {} };
}

export function saveCrosswordProgress(
	store: Store,
	sessionId: string,
	token: string,
	input: unknown
) {
	const participant = ensureParticipant(store, sessionId, token);
	const { cells: rawCells } = progressSchema.parse(input);
	const entries = currentEntries(store, openSession(store, sessionId).activityId);
	const layout = validateLayout(entries);
	const cells = Object.fromEntries(
		Object.entries(rawCells)
			.filter(([key, value]) => layout.has(key) && /^[A-Za-z0-9]$/.test(value))
			.map(([key, value]) => [key, value.toUpperCase()])
	);
	const now = Date.now();
	store.db
		.insert(crosswordAttempts)
		.values({
			id: randomUUID(),
			sessionId,
			participantId: participant.id,
			answerStateJson: JSON.stringify(cells),
			updatedAt: now
		})
		.onConflictDoUpdate({
			target: [crosswordAttempts.sessionId, crosswordAttempts.participantId],
			set: { answerStateJson: JSON.stringify(cells), updatedAt: now }
		})
		.run();
	return { cells };
}

export function checkCrossword(store: Store, sessionId: string, token: string, input: unknown) {
	const participant = ensureParticipant(store, sessionId, token);
	const { cells: rawCells } = progressSchema.parse(input);
	const entries = currentEntries(store, openSession(store, sessionId).activityId);
	const expected = new Map<string, string>();
	for (const entry of entries)
		for (const cell of cells(entry)) {
			const key = `${cell.row},${cell.col}`;
			expected.set(
				key,
				entry.answer[entry.direction === 'across' ? cell.col - entry.col : cell.row - entry.row]
			);
		}
	const inputCells = Object.fromEntries(
		Object.entries(rawCells)
			.filter(([key, value]) => expected.has(key) && /^[A-Za-z0-9]$/.test(value))
			.map(([key, value]) => [key, value.toUpperCase()])
	);
	const correctCells = Object.fromEntries(
		[...expected].map(([key, value]) => [key, inputCells[key] === value])
	);
	const filledCount = Object.keys(inputCells).length;
	const totalCells = expected.size;
	const score = Object.values(correctCells).filter(Boolean).length;
	const complete = score === totalCells && totalCells > 0;
	const now = Date.now();
	store.db
		.insert(crosswordAttempts)
		.values({
			id: randomUUID(),
			sessionId,
			participantId: participant.id,
			answerStateJson: JSON.stringify(inputCells),
			score,
			completedAt: complete ? now : null,
			updatedAt: now
		})
		.onConflictDoUpdate({
			target: [crosswordAttempts.sessionId, crosswordAttempts.participantId],
			set: {
				answerStateJson: JSON.stringify(inputCells),
				score,
				completedAt: complete ? now : null,
				updatedAt: now
			}
		})
		.run();
	return { ok: true, correctCells, complete, filledCount, totalCells, score };
}
