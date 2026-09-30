import { requireAdmin } from '$lib/server/http';
export const load: import('./$types').PageServerLoad = (event) => {
	requireAdmin(event);
};
