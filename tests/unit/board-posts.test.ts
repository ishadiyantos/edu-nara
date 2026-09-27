import { describe, expect, it } from 'vitest';
import {
	MAX_POST_BODY,
	isSafeHttpUrl,
	linkifyBody,
	movePost,
	validatePostBody
} from '../../src/lib/board/posts';

describe('board post validation', () => {
	it('accepts non-empty body up to 500 characters including unicode', () => {
		expect(validatePostBody('Halo dunia')).toMatchObject({ ok: true });
		expect(validatePostBody('🙂'.repeat(MAX_POST_BODY))).toMatchObject({ ok: true });
	});

	it('rejects empty, whitespace-only, and over-limit bodies', () => {
		expect(validatePostBody('').ok).toBe(false);
		expect(validatePostBody('   \n\t ').ok).toBe(false);
		expect(validatePostBody('🙂'.repeat(MAX_POST_BODY + 1)).ok).toBe(false);
	});

	it('returns trimmed value on success', () => {
		expect(validatePostBody('  aman  ')).toMatchObject({ ok: true, value: 'aman' });
	});
});

describe('safe http url detection', () => {
	it('accepts only http and https protocols', () => {
		expect(isSafeHttpUrl('https://contoh.ac.id')).toBe(true);
		expect(isSafeHttpUrl('http://contoh.ac.id')).toBe(true);
	});

	it('rejects javascript, data, and malformed urls', () => {
		expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
		expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
		expect(isSafeHttpUrl('HTTPS:/\u200b/evil.test')).toBe(false);
		expect(isSafeHttpUrl('not-a-url')).toBe(false);
	});
});

describe('linkifyBody', () => {
	it('splits text into text and safe link segments', () => {
		expect(linkifyBody('Buka https://contoh.ac.id sekarang')).toEqual([
			{ type: 'text', value: 'Buka ' },
			{ type: 'link', value: 'https://contoh.ac.id', href: 'https://contoh.ac.id' },
			{ type: 'text', value: ' sekarang' }
		]);
	});

	it('never linkifies non-http protocols', () => {
		const segments = linkifyBody('javascript:alert(1) dan data:text/html,x');
		expect(segments.every((segment) => segment.type === 'text')).toBe(true);
	});

	it('leaves trailing punctuation out of the link', () => {
		const segments = linkifyBody('lihat https://contoh.ac.id/a,b.');
		const link = segments.find((segment) => segment.type === 'link');
		expect(link?.href).toBe('https://contoh.ac.id/a,b');
	});
});

describe('movePost reorder helper', () => {
	const posts = [
		{ id: 'a', position: 0 },
		{ id: 'b', position: 1 },
		{ id: 'c', position: 2 }
	];

	it('moves a post up and recomputes positions', () => {
		expect(movePost(posts, 'c', -1).map((post) => post.id)).toEqual(['a', 'c', 'b']);
	});

	it('moves a post down and recomputes positions', () => {
		expect(movePost(posts, 'a', 1).map((post) => post.id)).toEqual(['b', 'a', 'c']);
	});

	it('is a no-op at boundaries and for unknown ids', () => {
		expect(movePost(posts, 'a', -1)).toEqual(posts);
		expect(movePost(posts, 'c', 1)).toEqual(posts);
		expect(movePost(posts, 'zz', 1)).toEqual(posts);
	});
});
