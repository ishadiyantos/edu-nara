export const MAX_POST_BODY = 500;

export type PostStatus = 'pending' | 'approved' | 'rejected';

export type BoardColumn = {
	id: string;
	title: string;
	position: number;
};

export type BoardPost = {
	id: string;
	columnId: string;
	author: string;
	body: string;
	status: PostStatus;
	position: number;
	createdAt?: string;
};

export type TextSegment =
	{ type: 'text'; value: string } | { type: 'link'; value: string; href: string };

export const SAMPLE_COLUMNS: BoardColumn[] = [
	{ id: 'pro', title: '👍 Pro', position: 0 },
	{ id: 'kontra', title: '👎 Kontra', position: 1 },
	{ id: 'tanya', title: '❓ Pertanyaan', position: 2 }
];

export const SAMPLE_POSTS: BoardPost[] = [
	{
		id: 'post-1',
		columnId: 'pro',
		author: 'Ari',
		body: 'Cepat dan ringan untuk dipelajari.',
		status: 'approved',
		position: 0
	},
	{
		id: 'post-2',
		columnId: 'pro',
		author: 'Bella',
		body: 'Dokumentasi tersedia di https://developer.mozilla.org.',
		status: 'approved',
		position: 1
	},
	{
		id: 'post-3',
		columnId: 'kontra',
		author: 'Cici',
		body: 'Ekosistem masih tumbuh.',
		status: 'approved',
		position: 0
	},
	{
		id: 'post-4',
		columnId: 'tanya',
		author: 'Dedi',
		body: 'Cocok untuk SSR?',
		status: 'pending',
		position: 0
	}
];

export function postLength(value: string): number {
	return Array.from(value).length;
}

export function validatePostBody(
	value: string
): { ok: true; value: string; length: number } | { ok: false; message: string; length: number } {
	const trimmed = value.trim();
	const length = postLength(trimmed);
	if (!trimmed) return { ok: false, message: 'Tulis isi kartu terlebih dahulu.', length: 0 };
	if (length > MAX_POST_BODY) {
		return { ok: false, message: `Isi kartu maksimal ${MAX_POST_BODY} karakter.`, length };
	}
	return { ok: true, value: trimmed, length };
}

export function isSafeHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
	} catch {
		return false;
	}
}

const urlPattern = /https?:\/\/[^\s<>"']+/gi;
const trailingUrlPunctuation = /[.,!?;:)\]}]+$/;

export function linkifyBody(value: string): TextSegment[] {
	const segments: TextSegment[] = [];
	let cursor = 0;
	for (const match of value.matchAll(urlPattern)) {
		const raw = match[0];
		const start = match.index ?? cursor;
		if (start > cursor) segments.push({ type: 'text', value: value.slice(cursor, start) });
		const punctuation = raw.match(trailingUrlPunctuation)?.[0] ?? '';
		const href = raw.slice(0, raw.length - punctuation.length);
		if (start > cursor && !isSafeHttpUrl(href)) {
			segments.push({ type: 'text', value: raw });
		} else if (!isSafeHttpUrl(href)) {
			segments.push({ type: 'text', value: raw });
		} else {
			segments.push({ type: 'link', value: href, href });
			if (punctuation) segments.push({ type: 'text', value: punctuation });
		}
		cursor = start + raw.length;
	}
	if (cursor < value.length) segments.push({ type: 'text', value: value.slice(cursor) });
	return segments.length ? segments : [{ type: 'text', value }];
}

export function movePost<T extends { id: string; position: number }>(
	posts: T[],
	id: string,
	delta: -1 | 1
): T[] {
	const index = posts.findIndex((post) => post.id === id);
	const target = index + delta;
	if (index < 0 || target < 0 || target >= posts.length) return posts;
	const result = [...posts];
	[result[index], result[target]] = [result[target], result[index]];
	return result.map((post, position) => ({ ...post, position }));
}

export function sortPosts(posts: BoardPost[]): BoardPost[] {
	return [...posts].sort((a, b) => a.position - b.position);
}

export function statusLabel(status: PostStatus): string {
	return { pending: 'Menunggu moderasi', approved: 'Tampil', rejected: 'Ditolak' }[status];
}

export function statusTone(status: PostStatus): string {
	return {
		pending: 'border-amber-300/50 bg-amber-50 text-amber-900',
		approved: 'border-emerald-300/50 bg-emerald-50 text-emerald-900',
		rejected: 'border-rose-300/50 bg-rose-50 text-rose-900'
	}[status];
}

export function postStatus(value: string): PostStatus {
	return value === 'approved' || value === 'rejected' ? value : 'pending';
}
