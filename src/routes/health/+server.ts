import { json } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
export const GET = () => {
	try {
		database().sqlite.prepare('SELECT 1').get();
		return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
	} catch {
		return json({ ok: false }, { status: 503 });
	}
};
