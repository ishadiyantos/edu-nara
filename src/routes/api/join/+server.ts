import { json } from '@sveltejs/kit';
import { body, join, message } from '$lib/server/http';
export const POST: import('./$types').RequestHandler = async (event) => {
	try {
		return json(join(event, await body(event)));
	} catch (err) {
		return json({ ok: false, message: message(err) }, { status: 400 });
	}
};
