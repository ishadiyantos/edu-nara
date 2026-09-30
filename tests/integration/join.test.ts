import { afterEach, expect, test } from 'vitest';
import { openDatabase } from '../../src/lib/server/db/client';
import { seedAdmin, hashToken } from '../../src/lib/server/auth';
import {
	createActivity,
	launchSession,
	changeState,
	joinSession,
	snapshot,
	authorizeSession,
	generateSessionCode
} from '../../src/lib/server/sessions';
import { createBoardColumn } from '../../src/lib/server/board';
const s = openDatabase(':memory:');
afterEach(() => {
	s.sqlite.exec(
		'DELETE FROM participants; DELETE FROM board_columns; DELETE FROM live_sessions; DELETE FROM activities; DELETE FROM admin_users;'
	);
});
async function fixture() {
	const a = await seedAdmin(s, {
		email: 'one@example.test',
		password: 'test-password-long-enough'
	});
	const activity = createActivity(s, a.id, { title: ' Kelas ' });
	return { a, activity };
}
test('owner launches unique draft, controls lifecycle, and cannot reopen ended session', async () => {
	const { a, activity } = await fixture();
	expect(() => createActivity(s, a.id, { title: '' })).toThrow();
	expect(createActivity(s, a.id, { title: 'Poll', type: 'choice' }).type).toBe('choice');
	expect(() => createActivity(s, a.id, { title: 'Bad', type: 'unknown' })).toThrow();
	const session = launchSession(s, a.id, activity.id, () => 'ABC234');
	expect(session.state).toBe('draft');
	expect(() => launchSession(s, 'other', activity.id)).toThrow();
	let attempts = 0;
	const second = launchSession(s, a.id, activity.id, () => (++attempts < 3 ? 'ABC234' : 'DEF567'));
	expect(attempts).toBe(3);
	expect(second.code).toBe('DEF567');
	expect(() => launchSession(s, a.id, activity.id, () => 'ABC234')).toThrow(
		'Session code not available.'
	);
	expect(() => changeState(s, 'other', session.id, 'open')).toThrow();
	for (const state of ['open', 'closed', 'open', 'ended'] as const)
		expect(changeState(s, a.id, session.id, state).state).toBe(state);
	expect(() => changeState(s, a.id, session.id, 'open')).toThrow();
	for (let i = 0; i < 100; i++) expect(generateSessionCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
});
test('join token hashed, rejoin idempotent, cookie scoped, counts aggregate, closed denies new join', async () => {
	const { a, activity } = await fixture();
	const session = launchSession(s, a.id, activity.id);
	const p = joinSession(s, { code: session.code, displayName: 'Ana' });
	changeState(s, a.id, session.id, 'open');
	const again = joinSession(s, { code: session.code, displayName: 'Different' }, p.token);
	expect(again.token).toBe(p.token);
	expect(snapshot(s, session.id).count).toBe(1);
	expect(s.sqlite.prepare('SELECT token_hash FROM participants').get()).toEqual({
		token_hash: hashToken(p.token)
	});
	expect(authorizeSession(s, session.id, undefined, p.token)).toBe(true);
	expect(authorizeSession(s, session.id, 'other', undefined)).toBe(false);
	const other = launchSession(s, a.id, activity.id);
	changeState(s, a.id, other.id, 'open');
	expect(authorizeSession(s, other.id, undefined, p.token)).toBe(false);
	expect(authorizeSession(s, session.id, undefined, p.token, Date.now() + 86400001)).toBe(false);
	changeState(s, a.id, session.id, 'closed');
	expect(() => joinSession(s, { code: session.code, displayName: 'Bob' })).toThrow();
	expect(joinSession(s, { code: session.code, displayName: 'Ana' }, p.token).token).toBe(p.token);
	expect(Object.keys(snapshot(s, session.id)).sort()).toEqual([
		'activeQuestionId',
		'code',
		'count',
		'id',
		'quizMode',
		'serverNow',
		'state',
		'timerDeadline',
		'timerDuration',
		'timerRunning',
		'title'
	]);
});

test('existing ungrouped participant becomes column-bound from a group link once', async () => {
	const { a } = await fixture();
	const activity = createActivity(s, a.id, { title: 'Board', type: 'board' });
	const first = createBoardColumn(s, a.id, activity.id, { title: 'Ide' });
	const second = createBoardColumn(s, a.id, activity.id, { title: 'Refleksi' });
	const session = launchSession(s, a.id, activity.id);
	changeState(s, a.id, session.id, 'open');
	const plain = joinSession(s, { code: session.code, displayName: 'Ana' });
	const grouped = joinSession(
		s,
		{ code: session.code, displayName: 'Ana', columnId: first.id },
		plain.token
	);
	expect(grouped.token).toBe(plain.token);
	expect(s.sqlite.prepare('SELECT column_id FROM participants').get()).toEqual({
		column_id: first.id
	});
	expect(() =>
		joinSession(s, { code: session.code, displayName: 'Ana', columnId: second.id }, plain.token)
	).toThrow('Participant is already assigned to another group.');
});
