import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { database } from './lib/server/db/client';
import { authenticate } from './lib/server/auth';
import { limits, sameOrigin } from './lib/server/security';
export const handle: Handle = async ({ event, resolve }) => {
	const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(event.request.method);
	if (mutation && !sameOrigin(event.request.headers.get('origin'), event.url.origin))
		return new Response('Origin not allowed.', { status: 403 });
	const path = event.url.pathname;
	const adminRoute = path === '/admin' || path.startsWith('/admin/');
	if (mutation || path.endsWith('/events')) {
		const kind =
			path === '/admin/login'
				? 'login'
				: path === '/api/join' || path === '/join'
					? 'join'
					: path.endsWith('/events')
						? 'sse'
						: 'action';
		const retry = limits.take(
			`${kind}:${event.getClientAddress()}`,
			kind === 'login' ? 10 : kind === 'join' ? 60 : 120,
			60000
		);
		if (retry)
			return new Response('Terlalu banyak permintaan. Coba lagi nanti.', {
				status: 429,
				headers: { 'Retry-After': String(retry) }
			});
	}
	event.locals.admin = authenticate(database(), event.cookies.get('edu_admin'));
	if (adminRoute && path !== '/admin/login' && !event.locals.admin) {
		if (mutation) return new Response('Please log in.', { status: 401 });
		redirect(303, '/admin/login');
	}
	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'same-origin');
	if (!response.headers.has('Content-Security-Policy'))
		response.headers.set(
			'Content-Security-Policy',
			"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
		);
	if (adminRoute || path.startsWith('/play/') || path.startsWith('/api/'))
		response.headers.set('Cache-Control', 'no-store');
	return response;
};
