import { isHttpError, json } from '@sveltejs/kit';
import { database } from '$lib/server/db/client';
import { body, message } from '$lib/server/http';
import { limits } from '$lib/server/security';
import { authenticateAiApiKey, bearerToken, createAiBoardDraft } from '$lib/server/ai-api-keys';

export const POST: import('./$types').RequestHandler = async (event) => {
	const key = authenticateAiApiKey(
		database(),
		bearerToken(event.request.headers.get('authorization'))
	);
	if (!key) return json({ ok: false, message: 'Invalid or expired API key.' }, { status: 401 });
	const retry = limits.take(`ai-authoring:${key.id}`, 20, 60000);
	if (retry)
		return json(
			{ ok: false, message: 'Too many requests.' },
			{ status: 429, headers: { 'Retry-After': String(retry) } }
		);
	try {
		const idempotencyKey = event.request.headers.get('idempotency-key');
		if (!idempotencyKey)
			return json({ ok: false, message: 'Idempotency-Key header required.' }, { status: 400 });
		const activity = createAiBoardDraft(
			database(),
			key.adminId,
			key.id,
			idempotencyKey,
			await body(event)
		);
		return json(
			{
				ok: true,
				activity: { id: activity.id, type: activity.type, title: activity.title },
				launched: false,
				editUrl: `/admin/activities/${activity.id}/board`
			},
			{ status: 201, headers: { 'Cache-Control': 'no-store' } }
		);
	} catch (err) {
		if (isHttpError(err)) throw err;
		return json({ ok: false, message: message(err) }, { status: 400 });
	}
};
