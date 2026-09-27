import { expect, test } from 'vitest';
import { RateLimiter, sameOrigin, cookieOptions } from '../../src/lib/server/security';
test('rate windows bounded; overflow fails closed with retry, expiry frees memory', () => {
	const limiter = new RateLimiter(2);
	expect(limiter.take('a', 2, 1000, 0)).toBe(0);
	expect(limiter.take('a', 2, 1000, 1)).toBe(0);
	expect(limiter.take('a', 2, 1000, 2)).toBe(1);
	expect(limiter.take('b', 2, 1000, 2)).toBe(0);
	expect(limiter.take('c', 2, 1000, 2)).toBe(1);
	expect(limiter.take('c', 2, 1000, 1001)).toBe(0);
});
test('origin exact match required for mutations, HTTPS cookies secure even with LAN override', () => {
	expect(sameOrigin('https://example.test', 'https://example.test')).toBe(true);
	for (const origin of [null, 'null', 'https://evil.test', 'https://example.test.evil'])
		expect(sameOrigin(origin, 'https://example.test')).toBe(false);
	expect(cookieOptions(new URL('https://example.test'), 'false')).toMatchObject({
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		path: '/'
	});
	expect(cookieOptions(new URL('http://localhost'), 'false').secure).toBe(false);
	expect(cookieOptions(new URL('http://localhost'), undefined).secure).toBe(true);
});
