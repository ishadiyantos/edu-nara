import { readFile } from 'node:fs/promises';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/http';

const files = {
	'edu-nara-activity-builder.SKILL.md': 'skills/edu-nara-activity-builder/SKILL.md',
	'EDU-NARA-AI-API.md': 'docs/EDU-NARA-AI-API.md'
} as const;

export const GET: RequestHandler = async (event) => {
	requireAdmin(event);
	const filename = event.params.file as keyof typeof files;
	const source = files[filename];
	if (!source) error(404, 'File not found.');
	const content = await readFile(source, 'utf8');
	return new Response(content, {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Cache-Control': 'no-store, private',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
