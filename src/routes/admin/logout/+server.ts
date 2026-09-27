import { redirect } from '@sveltejs/kit';
import { logout } from '$lib/server/auth';
import { database } from '$lib/server/db/client';
export const POST: import('./$types').RequestHandler = ({ cookies }) => {
	logout(database(), cookies.get('edu_admin'));
	cookies.delete('edu_admin', { path: '/' });
	redirect(303, '/admin/login');
};
