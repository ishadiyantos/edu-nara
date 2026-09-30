import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
	fetchLinkPreview,
	isPublicHttpUrl,
	parseLinkMetadata
} from '../../src/lib/server/link-preview';

describe('public url allowlist', () => {
	it('accepts public http(s) urls', () => {
		expect(isPublicHttpUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
		expect(isPublicHttpUrl('http://contoh.ac.id/a')).toBe(true);
	});

	it('rejects private, loopback, credential, and non-http urls', () => {
		for (const url of [
			'http://localhost/x',
			'http://127.0.0.1/x',
			'http://10.0.0.5/x',
			'http://172.16.1.1/x',
			'http://192.168.1.1/x',
			'http://169.254.169.254/latest/meta-data',
			'http://100.64.0.1/x',
			'http://[::1]/x',
			'http://0.0.0.0/x',
			'http://user:pass@contoh.ac.id/x',
			'http://contoh.ac.id:8080/x',
			'http://intranet/x',
			'file:///etc/passwd',
			'ftp://contoh.ac.id',
			'javascript:alert(1)'
		])
			expect(isPublicHttpUrl(url), url).toBe(false);
	});

	it('rejects oversized or whitespace-bearing urls', () => {
		expect(isPublicHttpUrl(`https://contoh.ac.id/${'a'.repeat(2100)}`)).toBe(false);
		expect(isPublicHttpUrl('https://contoh.ac.id/a b')).toBe(false);
	});
});

describe('parseLinkMetadata', () => {
	it('prefers og metadata and resolves the image', () => {
		const html = `<html><head><title>Halaman contoh</title>
			<meta property="og:title" content="Judul video belajar">
			<meta property="og:image" content="https://cdn.example.com/thumb.jpg"></head></html>`;
		expect(parseLinkMetadata(html, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
			title: 'Judul video belajar',
			imageUrl: 'https://cdn.example.com/thumb.jpg'
		});
	});

	it('falls back to a cleaned title tag and relative image', () => {
		const html = `<html><head><title>Artikel &amp;   kampus</title><meta property="og:image" content="/img/teaser.png"></head></html>`;
		expect(parseLinkMetadata(html, 'https://kampus.ac.id/artikel')).toEqual({
			title: 'Artikel & kampus',
			imageUrl: 'https://kampus.ac.id/img/teaser.png'
		});
	});

	it('drops private image urls and ignores tags inside scripts', () => {
		const html = `<title>Nyata</title><script><meta property="og:title" content="Palsu"></script><meta property="og:image" content="http://192.168.0.9/secret.png">`;
		expect(parseLinkMetadata(html, 'https://a.test/')).toEqual({ title: 'Nyata' });
	});

	it('returns null when nothing usable is present', () => {
		expect(parseLinkMetadata('<html><body>halo</body></html>', 'https://a.test/')).toBeNull();
	});

	it('truncates overlong titles', () => {
		expect(
			parseLinkMetadata(`<title>${'A'.repeat(500)}</title>`, 'https://a.test/')!.title.length
		).toBeLessThanOrEqual(200);
	});

	it('ignores oversized malformed meta tags without blocking the event loop', () => {
		const started = performance.now();
		expect(
			parseLinkMetadata(`<meta property="${'x'.repeat(40_000)}>`, 'https://a.test/')
		).toBeNull();
		expect(performance.now() - started).toBeLessThan(250);
	});
});

describe('fetchLinkPreview against local servers', () => {
	const servers: ReturnType<typeof createServer>[] = [];
	const listen = async (handler: Parameters<typeof createServer>[1]) => {
		const server = createServer(handler);
		servers.push(server);
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		return (server.address() as AddressInfo).port;
	};
	afterEach(async () => {
		await Promise.all(
			servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve)))
		);
	});

	it('never reaches a loopback server, so private networks stay unreachable', async () => {
		let hits = 0;
		const port = await listen((_req, res) => {
			hits += 1;
			res.end('<title>rahasia</title>');
		});
		await expect(fetchLinkPreview(`http://127.0.0.1:${port}/x`)).resolves.toBeNull();
		await expect(fetchLinkPreview(`http://localhost:${port}/x`)).resolves.toBeNull();
		expect(hits).toBe(0);
	});

	it('returns null instead of throwing for unreachable hosts', async () => {
		await expect(
			fetchLinkPreview('https://this-host-does-not-exist.invalid/a')
		).resolves.toBeNull();
	});
});
