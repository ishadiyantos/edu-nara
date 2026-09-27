import { randomUUID } from 'node:crypto';
type Event = { id: string; name: string; data: unknown; sequence: number };
type Room = {
	epoch: string;
	sequence: number;
	events: Event[];
	clients: Set<(event: Event) => void>;
};
export class SseHub {
	private rooms = new Map<string, Room>();
	constructor(
		private bufferSize = 100,
		private maxConnections = 500,
		private maxRooms = 200
	) {}
	get connections() {
		return [...this.rooms.values()].reduce((sum, room) => sum + room.clients.size, 0);
	}
	private room(id: string) {
		let room = this.rooms.get(id);
		if (!room) {
			if (this.rooms.size >= this.maxRooms) {
				const idle = [...this.rooms].find(([, r]) => !r.clients.size);
				if (idle) this.rooms.delete(idle[0]);
				else throw new Error('Server sibuk.');
			}
			room = { epoch: randomUUID(), sequence: 0, events: [], clients: new Set() };
			this.rooms.set(id, room);
		}
		return room;
	}
	publish(
		id: string,
		name:
			| 'session.state'
			| 'session.question'
			| 'participant.count'
			| 'poll.tally'
			| 'wordcloud.snapshot'
			| 'board.post.new'
			| 'board.post.moderated'
			| 'board.post.removed'
			| 'board.reordered',
		data: unknown
	) {
		const room = this.room(id);
		const sequence = ++room.sequence;
		const event = { id: `${room.epoch}:${sequence}`, sequence, name, data };
		room.events.push(event);
		if (room.events.length > this.bufferSize) room.events.shift();
		for (const client of room.clients) client(event);
		return event.id;
	}
	clear(id: string) {
		const room = this.rooms.get(id);
		if (room) room.events.length = 0;
	}
	subscribe(
		id: string,
		snapshot: () => unknown,
		signal: AbortSignal,
		lastId?: string,
		valid = () => true
	) {
		if (this.connections >= this.maxConnections) throw new Error('Server sibuk.');
		const room = this.room(id);
		const encoder = new TextEncoder();
		let cleanup = () => {};
		return new ReadableStream<Uint8Array>(
			{
				start: (controller) => {
					let closed = false;
					// Replay can close before timer initialization; avoid a const temporal dead zone.
					// eslint-disable-next-line prefer-const
					let timer: ReturnType<typeof setInterval> | undefined;
					const stop = () => {
						if (closed) return;
						closed = true;
						if (timer) clearInterval(timer);
						room.clients.delete(send);
						signal.removeEventListener('abort', stop);
						try {
							controller.close();
						} catch {
							/* Reader cancellation already closed the stream. */
						}
					};
					const send = (event: Event) => {
						if (closed) return;
						if ((controller.desiredSize ?? 0) <= 0) {
							stop();
							return;
						}
						controller.enqueue(
							encoder.encode(
								`${event.id ? `id: ${event.id}\n` : ''}event: ${event.name}\ndata: ${JSON.stringify(event.data)}\n\n`
							)
						);
					};
					cleanup = stop;
					// No awaits: registration, cursor and DB snapshot share one event-loop turn.
					room.clients.add(send);
					const sequence = lastId?.startsWith(`${room.epoch}:`)
						? Number(lastId.split(':')[1])
						: NaN;
					const oldest = room.events[0]?.sequence ?? room.sequence + 1;
					if (
						lastId &&
						room.events.length > 0 &&
						Number.isInteger(sequence) &&
						sequence >= oldest - 1 &&
						sequence <= room.sequence
					) {
						for (const event of room.events) if (event.sequence > sequence) send(event);
					} else
						send({
							id: `${room.epoch}:${room.sequence}`,
							sequence: room.sequence,
							name: lastId ? 'resync' : 'snapshot',
							data: snapshot()
						});
					if (closed) return;
					signal.addEventListener('abort', stop, { once: true });
					if (signal.aborted) {
						stop();
						return;
					}
					timer = setInterval(() => {
						if (!valid()) {
							stop();
							return;
						}
						send({ id: '', sequence: 0, name: 'heartbeat', data: { ts: Date.now() } });
					}, 20000);
				},
				cancel: () => cleanup()
			},
			{ highWaterMark: 32 }
		);
	}
}
export const events = new SseHub();
