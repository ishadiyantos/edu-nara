import { z } from 'zod';

export const codeSchema = z
	.string()
	.trim()
	.toUpperCase()
	.regex(/^[A-HJ-NP-Z2-9]{6}$/, 'Kode sesi harus 6 karakter tanpa 0/O/1/I.');

export const joinSchema = z
	.object({
		code: codeSchema,
		displayName: z
			.string()
			.trim()
			.min(2, 'Nama minimal 2 karakter.')
			.max(24, 'Nama maksimal 24 karakter.')
			.refine(
				(v) => [...v].every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127),
				'Nama tidak valid.'
			)
	})
	.strict();

export const activitySchema = z
	.object({
		type: z.enum(['choice', 'wordcloud', 'board', 'crossword']).default('choice'),
		title: z.string().trim().min(1, 'Judul wajib diisi.').max(120)
	})
	.strict();

export const stateSchema = z.enum(['open', 'closed', 'ended']);
const boardText = z
	.string()
	.trim()
	.min(1, 'Teks wajib diisi.')
	.refine((value) => [...value].length <= 500, 'Teks maksimal 500 karakter.')
	.refine(
		(value) => [...value].every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127),
		'Teks tidak valid.'
	);

export const boardPostSchema = z
	.object({
		columnId: z.string().trim().min(1).max(100),
		body: boardText
	})
	.strict();
export const boardColumnSchema = z.object({ title: z.string().trim().min(1).max(120) }).strict();
export const boardStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export const boardOrderSchema = z
	.object({ ids: z.array(z.string().trim().min(1).max(100)).max(500) })
	.strict();
