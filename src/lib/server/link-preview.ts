import { lookup } from 'node:dns/promises';
import { isIP, BlockList } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

export type LinkPreview = { title: string; imageUrl?: string };
type Resolver = (hostname: string) => Promise<string[]>;
const blocked = new BlockList();
for (const [ip, prefix] of [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['100.64.0.0', 10],
	['127.0.0.0', 8],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.0.0.0', 24],
	['192.0.2.0', 24],
	['192.88.99.0', 24],
	['192.168.0.0', 16],
	['198.18.0.0', 15],
	['198.51.100.0', 24],
	['203.0.113.0', 24],
	['224.0.0.0', 4],
	['240.0.0.0', 4]
] as const)
	blocked.addSubnet(ip, prefix, 'ipv4');

function publicIp(address: string) {
	// ponytail: IPv4-only outbound previews; add vetted IPv6 ranges before enabling IPv6.
	return isIP(address) === 4 && !blocked.check(address, 'ipv4');
}
export function isPublicHttpUrl(value: string): boolean {
	try {
		if (value.length > 2048 || /[\s\\]/u.test(value)) return false;
		const u = new URL(value);
		const host = u.hostname
			.replace(/^\[|\]$/g, '')
			.replace(/\.$/, '')
			.toLowerCase();
		return (
			['http:', 'https:'].includes(u.protocol) &&
			!u.username &&
			!u.password &&
			!u.port &&
			!!host &&
			(isIP(host)
				? publicIp(host)
				: host.includes('.') && !/(^|\.)(localhost|local|internal)$/.test(host))
		);
	} catch {
		return false;
	}
}
const defaultResolver: Resolver = async (host) =>
	(await lookup(host, { all: true, family: 4 })).map((row) => row.address);

/** No cookies, auth, proxy environment, or second DNS resolution. Bound every redirect and byte. */
async function download(value: string, image: boolean, resolver: Resolver) {
	const signal = AbortSignal.timeout(4000);
	let url = new URL(value);
	for (let hop = 0; hop <= 3; hop++) {
		if (!isPublicHttpUrl(url.href)) throw new Error('Non-public URL');
		signal.throwIfAborted();
		const addresses = isIP(url.hostname)
			? [url.hostname]
			: await new Promise<string[]>((resolve, reject) => {
					const abort = () => reject(new Error('DNS timeout'));
					signal.addEventListener('abort', abort, { once: true });
					resolver(url.hostname)
						.then(resolve, reject)
						.finally(() => signal.removeEventListener('abort', abort));
				});
		if (!addresses.length || !addresses.every(publicIp)) throw new Error('Non-public DNS');
		signal.throwIfAborted();
		const result = await new Promise<{ bytes?: Buffer; location?: string }>((resolve, reject) => {
			const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
			const req = request(
				url,
				{
					agent: false,
					signal,
					lookup: (_host, options, callback) => {
						if (options.all) callback(null, [{ address: addresses[0], family: 4 }]);
						else callback(null, addresses[0], 4);
					},
					headers: {
						'User-Agent': 'EduNara-LinkPreview/1.0',
						Accept: image
							? 'image/jpeg,image/png,image/webp'
							: 'text/html,application/xhtml+xml,application/json',
						'Accept-Encoding': 'identity'
					}
				},
				(res) => {
					res.on('error', reject);
					if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0)) {
						resolve({ location: res.headers.location });
						res.destroy();
						return;
					}
					const type = res.headers['content-type'] ?? '';
					const cap = image ? 5 * 1024 * 1024 : 256 * 1024;
					if (
						res.statusCode !== 200 ||
						(image
							? !/^image\/(jpeg|png|webp)/i.test(type)
							: !/(text\/html|application\/(xhtml\+xml|json))/i.test(type)) ||
						(res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') ||
						Number(res.headers['content-length'] ?? 0) > cap
					) {
						res.destroy();
						reject(new Error('Unsupported response'));
						return;
					}
					let size = 0;
					const chunks: Buffer[] = [];
					res.on('data', (chunk: Buffer) => {
						size += chunk.length;
						if (size > cap) {
							res.destroy();
							reject(new Error('Response too large'));
						} else chunks.push(chunk);
					});
					res.on('end', () => resolve({ bytes: Buffer.concat(chunks) }));
				}
			);
			req.on('error', reject);
			req.end();
		});
		if (result.bytes) return { bytes: result.bytes, url: url.href };
		if (!result.location) throw new Error('Missing redirect');
		url = new URL(result.location, url);
	}
	throw new Error('Too many redirects');
}
function decodeHtml(value: string): string {
	const named: Record<string, string> = {
		amp: '&',
		quot: '"',
		apos: "'",
		lt: '<',
		gt: '>',
		nbsp: ' '
	};
	return value
		.replace(/&#(x[\da-f]+|\d+);?/gi, (_, raw: string) => {
			const code = raw[0].toLowerCase() === 'x' ? parseInt(raw.slice(1), 16) : parseInt(raw, 10);
			return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
		})
		.replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match)
		.replace(/[\u0000-\u001f\u007f]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}
function meta(html: string, property: string): string {
	for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
		const attrs = Object.fromEntries(
			[...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map((m) => [
				m[1].toLowerCase(),
				m[2] ?? m[3] ?? m[4] ?? ''
			])
		);
		if ((attrs.property ?? attrs.name)?.toLowerCase() === property)
			return decodeHtml(attrs.content ?? '');
	}
	return '';
}
export function parseLinkMetadata(html: string, pageUrl: string): LinkPreview | null {
	// Ignore apparent tags inside scripts/comments; metadata remains plain text, never HTML.
	html = html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
	const title = (
		meta(html, 'og:title') ||
		meta(html, 'twitter:title') ||
		decodeHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
	).slice(0, 200);
	let imageUrl: string | undefined;
	const raw = meta(html, 'og:image') || meta(html, 'twitter:image');
	try {
		const candidate = new URL(raw, pageUrl).href;
		if (raw && isPublicHttpUrl(candidate)) imageUrl = candidate;
	} catch {
		/* Invalid image omitted. */
	}
	return title || imageUrl ? { title: title || new URL(pageUrl).hostname, imageUrl } : null;
}
export async function fetchLinkPreview(
	value: string,
	resolver: Resolver = defaultResolver
): Promise<LinkPreview | null> {
	try {
		if (!isPublicHttpUrl(value)) return null;
		const url = new URL(value);
		const host = url.hostname.toLowerCase();
		if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) {
			const id =
				host === 'youtu.be'
					? url.pathname.slice(1).split('/')[0]
					: (url.searchParams.get('v') ??
						url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1]);
			if (id && /^[\w-]{11}$/.test(id)) {
				const result = await download(
					`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`,
					false,
					resolver
				);
				const data = JSON.parse(result.bytes.toString('utf8'));
				if (typeof data.title === 'string')
					return {
						title: decodeHtml(data.title).slice(0, 200),
						imageUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
					};
			}
		}
		const result = await download(value, false, resolver);
		return parseLinkMetadata(result.bytes.toString('utf8'), result.url);
	} catch {
		return null;
	}
}
export async function fetchPreviewImage(
	value: string,
	resolver: Resolver = defaultResolver
): Promise<Uint8Array | null> {
	try {
		return (await download(value, true, resolver)).bytes;
	} catch {
		return null;
	}
}
// Bound expensive outbound work across simultaneous posts; overload falls back to plain links.
let inFlight = 0;
export async function buildLinkPreview(value: string) {
	if (inFlight >= 4) return null;
	inFlight++;
	try {
		const metadata = await fetchLinkPreview(value);
		if (!metadata) return null;
		return {
			title: metadata.title,
			image: metadata.imageUrl ? await fetchPreviewImage(metadata.imageUrl) : null
		};
	} finally {
		inFlight--;
	}
}
