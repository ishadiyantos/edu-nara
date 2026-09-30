import { expect, test, vi, afterEach } from 'vitest';
import { SseHub } from '../../src/lib/server/events';
afterEach(() => vi.useRealTimers());
test('replay overflow closes without leaking heartbeat timer', async () => {
	vi.useFakeTimers();
	const hub = new SseHub();
	const first = hub.publish('overflow', 'participant.count', { count: 0 });
	for (let i = 1; i <= 40; i++) hub.publish('overflow', 'participant.count', { count: i });
	const reader = hub
		.subscribe('overflow', () => ({ count: 40 }), new AbortController().signal, first)
		.getReader();
	expect(hub.connections).toBe(0);
	expect(vi.getTimerCount()).toBe(0);
	await reader.cancel();
});
test('snapshot first, bounded replay, resync on expired cursor/restart; abort cleans heartbeat', async () => {
	vi.useFakeTimers();
	const hub = new SseHub(2, 2);
	let count = 0;
	const abort = new AbortController();
	const stream = hub.subscribe('a', () => ({ count }), abort.signal);
	const reader = stream.getReader();
	expect(new TextDecoder().decode((await reader.read()).value)).toContain('event: snapshot');
	const first = hub.publish('a', 'participant.count', { count: ++count });
	expect(new TextDecoder().decode((await reader.read()).value)).toContain('"count":1');
	hub.publish('a', 'participant.count', { count: ++count });
	hub.publish('a', 'participant.count', { count: ++count });
	const replay = hub
		.subscribe('a', () => ({ count }), new AbortController().signal, first)
		.getReader();
	expect(new TextDecoder().decode((await replay.read()).value)).toContain(
		'event: participant.count'
	);
	await replay.cancel();
	hub.publish('a', 'participant.count', { count: ++count });
	const old = hub
		.subscribe('a', () => ({ count }), new AbortController().signal, first)
		.getReader();
	expect(new TextDecoder().decode((await old.read()).value)).toContain('event: resync');
	await old.cancel();
	const restart = new SseHub()
		.subscribe('a', () => ({ count }), new AbortController().signal, first)
		.getReader();
	expect(new TextDecoder().decode((await restart.read()).value)).toContain('event: resync');
	await restart.cancel();
	abort.abort();
	expect(hub.connections).toBe(0);
	expect(vi.getTimerCount()).toBe(0);
});
test('heartbeat every 20 seconds needs no ack and slow clients disconnect', async () => {
	vi.useFakeTimers();
	const hub = new SseHub();
	const controller = new AbortController();
	const reader = hub.subscribe('x', () => ({ count: 0 }), controller.signal).getReader();
	await reader.read();
	await vi.advanceTimersByTimeAsync(20000);
	expect(new TextDecoder().decode((await reader.read()).value)).toContain('event: heartbeat');
	await vi.advanceTimersByTimeAsync(40000);
	expect(hub.connections).toBe(1);
	controller.abort();
	expect(hub.connections).toBe(0);
	const slow = hub.subscribe('x', () => ({}), new AbortController().signal).getReader();
	for (let i = 0; i < 200; i++) hub.publish('x', 'participant.count', { count: i });
	expect(hub.connections).toBe(0);
	await slow.cancel();
});
test('clear removes private events from later replay', async () => {
	const hub = new SseHub();
	const id = hub.publish('room', 'poll.tally', { counts: { secret: 1 } });
	hub.clear('room');
	const reader = hub
		.subscribe('room', () => ({ safe: true }), new AbortController().signal, id)
		.getReader();
	expect(new TextDecoder().decode((await reader.read()).value)).toContain('event: resync');
	await reader.cancel();
});
