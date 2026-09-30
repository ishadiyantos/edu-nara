import { z } from 'zod';
import { isSafeHttpUrl } from './board/posts';

export const codeSchema = z
	.string()
	.trim()
	.toUpperCase()
	.regex(/^[A-HJ-NP-Z2-9]{6}$/, 'Session code must have 6 characters without 0/O/1/I.');

export const joinSchema = z
	.object({
		code: codeSchema,
		displayName: z
			.string()
			.trim()
			.min(2, 'Name must have at least 2 characters.')
			.max(24, 'Name must have at most 24 characters.')
			.refine(
				(v) => [...v].every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127),
				'Invalid name.'
			),
		columnId: z.uuid().optional()
	})
	.strict();

export const activitySchema = z
	.object({
		type: z.enum(['choice', 'wordcloud', 'board', 'crossword']).default('choice'),
		title: z.string().trim().min(1, 'Title is required.').max(120)
	})
	.strict();

export const stateSchema = z.enum(['open', 'closed', 'ended']);
const boardText = z
	.string()
	.trim()

	.refine((value) => [...value].length <= 1000, 'Text must have at most 1000 characters.')
	.refine(
		(value) =>
			[...value].every(
				(char) =>
					['\n', '\r', '	'].includes(char) ||
					(char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
			),
		'Invalid text.'
	);

export const boardCardColors = ['cream', 'rose', 'amber', 'mint', 'sky', 'lavender'] as const;
export const boardPostSchema = z
	.object({
		columnId: z.string().trim().min(1).max(100),
		body: boardText,
		title: z.string().trim().max(120).default(''),
		linkUrl: z
			.string()
			.trim()
			.max(2048)
			.refine((v) => !v || isSafeHttpUrl(v), 'Link must use http/https.')
			.default(''),
		cardColor: z.enum(boardCardColors).default('cream'),
		requestId: z.string().min(1).max(100).optional()
	})
	.strict();
export const boardColumnSchema = z
	.object({
		title: z
			.string()
			.trim()
			.min(1)
			.max(120)
			.refine(
				(v) => [...v].every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127),
				'Invalid column title.'
			)
	})
	.strict();
export const boardStatusSchema = z.enum(['pending', 'approved', 'rejected', 'hidden']);
export const boardCommentSchema = z.string().trim().min(1).max(500);
export const boardReactionSchema = z.enum(['👍', '❤️', '💡', '❓']);
export const boardOrderSchema = z
	.object({ ids: z.array(z.string().trim().min(1).max(100)).max(500) })
	.strict();
