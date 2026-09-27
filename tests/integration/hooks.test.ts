import { expect, test } from 'vitest';
import { handle } from '../../src/hooks.server';
import type { RequestEvent } from '@sveltejs/kit';
import { database } from '../../src/lib/server/db/client';

function eventFor(request: Request): RequestEvent {
	return {
		request,
		url: new URL(request.url),
		locals: {},
		cookies: {
			get: () => undefined,
			set: () => {},
			delete: () => {},
			serialize: () => ''
		}
	} as unknown as RequestEvent;
}

test('JSON and form mutations reject absent, null and hostile origins before resolution', async () => {
	for (const origin of [undefined, 'null', 'https://evil.invalid']) {
		const request = new Request('https://edu.test/api/join', {
			method: 'POST',
			headers: origin ? { origin } : {},
			body: '{}'
		});
		const result = await handle({
			event: eventFor(request),
			resolve: async () => new Response('unsafe')
		});
		expect(result.status).toBe(403);
	}
});

test('every response carries CSP, nosniff and X-Frame-Options DENY', async () => {
	database();
	const request = new Request('https://edu.test/health', { method: 'GET' });
	const response = await handle({
		event: eventFor(request),
		resolve: async () => new Response('ok')
	});
	expect(response.status).toBe(200);
	expect(response.headers.get('x-content-type-options')).toBe('nosniff');
	expect(response.headers.get('x-frame-options')).toBe('DENY');
	expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
});

test('mutation schemas reject unknown keys so payloads stay strict', async () => {
	const { joinSchema, boardPostSchema } = await import('../../src/lib/validation');
	expect(
		joinSchema.safeParse({ code: 'ABC234', displayName: 'Peserta', unexpected: true }).error!.issues[0]
	).toMatchObject({ code: 'unrecognized_keys', keys: ['unexpected'] });
	expect(boardPostSchema.safeParse({ columnId: 'col', body: 'halo', extra: 1 }).error!.issues[0]).toMatchObject({
		code: 'unrecognized_keys',
		keys: ['extra']
	});
});
