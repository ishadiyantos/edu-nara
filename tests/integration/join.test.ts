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
const s = openDatabase(':memory:');
afterEach(() => {
	s.sqlite.exec(
		'DELETE FROM participants; DELETE FROM live_sessions; DELETE FROM activities; DELETE FROM admin_users;'
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
		'Kode sesi tidak tersedia.'
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
	expect(() => joinSession(s, { code: session.code, displayName: 'Ana' })).toThrow();
	changeState(s, a.id, session.id, 'open');
	const p = joinSession(s, { code: session.code, displayName: 'Ana' });
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
