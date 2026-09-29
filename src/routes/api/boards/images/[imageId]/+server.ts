import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { database } from '$lib/server/db/client';
import { boardPosts } from '$lib/server/db/schema';
import { boardImageAccess } from '$lib/server/board';
import { readStoredImage, uploadDirectory } from '$lib/server/media-storage';
export const GET: import('./$types').RequestHandler = (event) => {
	const id = event.params.imageId;
	if (!/^[0-9a-f-]{36}$/.test(id)) error(404, 'Gambar tidak ditemukan.');
	const store = database();
	const row = store.db
		.select({ sessionId: boardPosts.sessionId })
		.from(boardPosts)
		.where(eq(boardPosts.imageId, id))
		.get();
	if (
		!row ||
		!boardImageAccess(
			store,
			id,
			event.locals.admin?.id,
			event.cookies.get(`edu_p_${row.sessionId}`)
		)
	)
		error(404, 'Gambar tidak ditemukan.');
	const image = readStoredImage(uploadDirectory(), id);
	if (!image) error(404, 'Gambar tidak ditemukan.');
	return new Response(new Uint8Array(image.bytes), {
		headers: {
			'Content-Type': image.contentType,
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff',
			'Content-Disposition': 'inline',
			'Content-Security-Policy': "default-src 'none'; sandbox",
			'Cross-Origin-Resource-Policy': 'same-origin'
		}
	});
};
