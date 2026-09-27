import { fail, redirect } from '@sveltejs/kit';
import { body, join, message } from '$lib/server/http';
export const load: import('./$types').PageServerLoad = ({ url }) => ({
	code: url.searchParams.get('code') ?? ''
});
export const actions = {
	default: async (event) => {
		let code;
		try {
			code = join(event, await body(event)).code;
		} catch (err) {
			return fail(400, { message: message(err) });
		}
		redirect(303, `/play/${code}`);
	}
} satisfies import('./$types').Actions;
