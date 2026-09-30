import { fail, redirect } from '@sveltejs/kit';
import { login } from '$lib/server/auth';
import { database } from '$lib/server/db/client';
import { cookieOptions } from '$lib/server/security';
import { body } from '$lib/server/http';
export const actions = {
	default: async (event) => {
		try {
			const session = await login(database(), await body(event), event.cookies.get('edu_admin'));
			event.cookies.set('edu_admin', session.token, {
				...cookieOptions(event.url),
				expires: new Date(session.expiresAt)
			});
		} catch {
			return fail(400, { message: 'Incorrect email or password.' });
		}
		redirect(303, '/admin');
	}
} satisfies import('./$types').Actions;
