import { expect, test, vi } from 'vitest';
vi.mock('$lib/server/db/client', () => ({}));
import { body, message } from '../../src/lib/server/http';
import type { RequestEvent } from '@sveltejs/kit';
test('request reader bounds streamed bodies rather than trusting content length', async () => {
	let reads = 0;
	const request = new Request('https://edu.test/api/join', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: new ReadableStream({
			pull(c) {
				reads++;
				c.enqueue(new Uint8Array(5000));
				if (reads > 10) c.close();
			}
		}),
		duplex: 'half'
	} as RequestInit);
	await expect(body({ request } as RequestEvent)).rejects.toMatchObject({ status: 413 });
	expect(reads).toBeLessThan(5);
});
test('internal exception text never reflected to clients', () => {
	expect(message(new Error('SQL failed /private/db secret'))).toBe('Permintaan gagal.');
});
