import { describe, expect, it } from 'vitest';
import { validateLinkUrl } from '../../src/lib/server/links';

describe('validateLinkUrl', () => {
	it('accepts valid https URL', () => {
		expect(validateLinkUrl('https://example.com/materials/doc.pdf')).toMatchObject({
			ok: true,
			url: 'https://example.com/materials/doc.pdf'
		});
	});

	it('accepts valid http URL', () => {
		expect(validateLinkUrl('http://example.com/page?id=123#ref')).toMatchObject({
			ok: true,
			url: 'http://example.com/page?id=123#ref'
		});
	});

	it('rejects javascript: scheme', () => {
		expect(validateLinkUrl('javascript:alert(1)').ok).toBe(false);
	});

	it('rejects data: scheme', () => {
		expect(validateLinkUrl('data:text/html,<script>alert(1)</script>').ok).toBe(false);
	});

	it('rejects file: scheme', () => {
		expect(validateLinkUrl('file:///etc/passwd').ok).toBe(false);
	});

	it('rejects other non-http/https schemes', () => {
		expect(validateLinkUrl('ftp://example.com').ok).toBe(false);
		expect(validateLinkUrl('mailto:user@example.com').ok).toBe(false);
	});

	it('rejects malformed or relative URLs', () => {
		expect(validateLinkUrl('/relative/path').ok).toBe(false);
		expect(validateLinkUrl('not-a-url').ok).toBe(false);
		expect(validateLinkUrl('http://').ok).toBe(false);
	});

	it('rejects URLs that the URL parser would silently repair', () => {
		for (const value of [
			'https:example.com',
			'https:/example.com',
			'https:///example.com',
			'https://example.com\\path',
			'https://exam\nple.com',
			'https://example.com/a b',
			'https://example.com/%zz',
			'https://example.com:99999',
			'//example.com'
		])
			expect(validateLinkUrl(value).ok, JSON.stringify(value)).toBe(false);
	});

	it('rejects empty or whitespace-only input', () => {
		expect(validateLinkUrl('').ok).toBe(false);
		expect(validateLinkUrl('   ').ok).toBe(false);
	});

	it('rejects non-string input', () => {
		expect(validateLinkUrl(null).ok).toBe(false);
		expect(validateLinkUrl(undefined).ok).toBe(false);
	});
});
