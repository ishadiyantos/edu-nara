import { UserError } from './errors';
import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ZodError } from 'zod';
import { database } from './db/client';
import { sessionByCode, joinSession } from './sessions';
import { joinSchema } from '../validation';
import { cookieOptions } from './security';
import { events } from './events';
import { snapshot } from './sessions';
export function requireAdmin(event: RequestEvent) {
	if (!event.locals.admin) error(401, 'Silakan masuk.');
	return event.locals.admin.id;
}
export function message(err: unknown) {
	return err instanceof ZodError
		? err.issues[0].message
		: err instanceof UserError
			? err.message
			: 'Permintaan gagal.';
}
export async function body(event: RequestEvent) {
	const content = event.request.headers.get('content-type') ?? '';
	const reader = event.request.body?.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	if (reader) {
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				size += value.byteLength;
				if (size > 4096) {
					await reader.cancel();
					error(413, 'Permintaan terlalu besar.');
				}
				chunks.push(value);
			}
		} finally {
			reader.releaseLock();
		}
	}
	const text = Buffer.concat(chunks).toString('utf8');
	if (content.includes('application/json')) {
		try {
			return JSON.parse(text);
		} catch {
			error(400, 'JSON tidak valid.');
		}
	}
	if (!content.includes('application/x-www-form-urlencoded')) error(415, 'Format tidak didukung.');
	return Object.fromEntries(new URLSearchParams(text));
}
export function join(event: RequestEvent, input: unknown) {
	const data = joinSchema.parse(input);
	const store = database();
	const session = sessionByCode(store, data.code);
	const result = joinSession(
		store,
		data,
		session ? event.cookies.get(`edu_p_${session.id}`) : undefined
	);
	event.cookies.set(`edu_p_${result.sessionId}`, result.token, {
		...cookieOptions(event.url),
		maxAge: 86400
	});
	const lastEventId = result.created
		? events.publish(result.sessionId, 'participant.count', {
				count: snapshot(store, result.sessionId).count
			})
		: null;
	return { ok: true, code: result.code, sessionId: result.sessionId, lastEventId };
}
