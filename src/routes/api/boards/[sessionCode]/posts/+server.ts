import { json } from '@sveltejs/kit';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { database } from '$lib/server/db/client';
import { body, message } from '$lib/server/http';
import { boardSession, listBoard, submitBoardPost } from '$lib/server/board';
import { sessionByCode } from '$lib/server/sessions';
import { boardPostSchema } from '$lib/validation';
import { MAX_IMAGE_BYTES, validateImageUpload } from '$lib/server/media';
import { saveImageUpload, uploadDirectory } from '$lib/server/media-storage';
import { UserError } from '$lib/server/errors';
import { buildLinkPreview } from '$lib/server/link-preview';
import { linkifyBody } from '$lib/board/posts';
import { limits } from '$lib/server/security';

export const GET: import('./$types').RequestHandler = (event) => {
	const store = database();
	const session = sessionByCode(store, event.params.sessionCode);
	if (!session) return json({ ok: false, message: 'Sesi tidak tersedia.' }, { status: 404 });
	try {
		const token = event.cookies.get(`edu_p_${session.id}`);
		if (!boardSession(store, session.id, token, event.locals.admin?.id))
			return json({ ok: false, message: 'Akses papan ditolak.' }, { status: 401 });
		return json(
			{ ok: true, ...listBoard(store, session.id, event.locals.admin?.id, token) },
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	} catch (err) {
		return json({ ok: false, message: message(err) }, { status: 400 });
	}
};

export const POST: import('./$types').RequestHandler = async (event) => {
	const store = database();
	const session = sessionByCode(store, event.params.sessionCode);
	if (!session) return json({ ok: false, message: 'Sesi tidak tersedia.' }, { status: 404 });
	const token = event.cookies.get(`edu_p_${session.id}`);
	let imageId: string | undefined;
	let previewImageId: string | undefined;
	const directory = uploadDirectory();
	try {
		if (!token || !boardSession(store, session.id, token))
			return json({ ok: false, message: 'Peserta belum terautentikasi.' }, { status: 401 });
		const retry = limits.take(`board:${session.id}:${token}`, 20, 60000);
		if (retry)
			return json(
				{ ok: false, message: 'Terlalu banyak kiriman. Coba lagi nanti.' },
				{ status: 429, headers: { 'Retry-After': String(retry) } }
			);
		let input: unknown;
		let image: Uint8Array | undefined;
		if (event.request.headers.get('content-type')?.includes('multipart/form-data')) {
			// Bound the stream before multipart parsing, including requests without Content-Length.
			const reader = event.request.body?.getReader();
			const chunks: Uint8Array[] = [];
			let size = 0;
			if (reader)
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						size += value.byteLength;
						if (size > MAX_IMAGE_BYTES + 65536) {
							await reader.cancel();
							throw new UserError('Ukuran file terlalu besar.');
						}
						chunks.push(value);
					}
				} finally {
					reader.releaseLock();
				}
			const form = await new Response(Buffer.concat(chunks), {
				headers: { 'Content-Type': event.request.headers.get('content-type')! }
			}).formData();
			const allowed = new Set([
				'columnId',
				'body',
				'title',
				'linkUrl',
				'requestId',
				'image',
				'cardColor'
			]);
			for (const key of form.keys())
				if (!allowed.has(key) || form.getAll(key).length !== 1)
					throw new UserError('Form tidak valid.');
			const file = form.get('image');
			if (file && typeof file !== 'string' && file.size) {
				if (file.size > MAX_IMAGE_BYTES) throw new UserError('Ukuran file terlalu besar.');
				image = new Uint8Array(await file.arrayBuffer());
				const validation = validateImageUpload(image);
				if (!validation.ok) throw new UserError(validation.error);
			} else if (typeof file === 'string' && file) throw new UserError('Gambar tidak valid.');
			form.delete('image');
			input = Object.fromEntries(form);
		} else input = await body(event);
		const data = boardPostSchema.parse(input);
		if (session.state !== 'open') throw new UserError('Sesi tidak menerima post.');
		const snapshot = listBoard(store, session.id, undefined, token);
		if (!snapshot.columns.some((column) => column.id === data.columnId))
			throw new UserError('Kolom tidak tersedia.');
		const bodyLink = linkifyBody(data.body).find((segment) => segment.type === 'link');
		data.linkUrl ||= bodyLink?.type === 'link' ? bodyLink.href : '';
		const preview = data.linkUrl ? await buildLinkPreview(data.linkUrl) : null;
		if (preview?.image && validateImageUpload(preview.image).ok) {
			try {
				previewImageId = saveImageUpload(preview.image, directory).id;
			} catch {
				/* Preview optional; card still saves. */
			}
		}
		if (image) imageId = saveImageUpload(image, directory).id;
		const post = submitBoardPost(store, session.id, token, data.columnId, data.body, {
			title: data.title,
			linkUrl: data.linkUrl,
			requestId: data.requestId,
			cardColor: data.cardColor,
			previewTitle: preview?.title,
			previewImageId,
			imageId
		});
		if (imageId && post.imageId !== imageId) rmSync(join(directory, imageId), { force: true });
		if (previewImageId && post.previewImageId !== previewImageId)
			rmSync(join(directory, previewImageId), { force: true });
		previewImageId = undefined;
		imageId = undefined;
		return json({
			ok: true,
			postId: post.id,
			status: post.status,
			position: post.position,
			lastEventId: post.lastEventId
		});
	} catch (err) {
		if (previewImageId) rmSync(join(directory, previewImageId), { force: true });
		if (imageId) rmSync(join(directory, imageId), { force: true });
		return json({ ok: false, message: message(err) }, { status: 400 });
	}
};
