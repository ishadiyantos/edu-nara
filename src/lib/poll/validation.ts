import { z } from 'zod';
const optionLabel = z.string().trim().min(1, 'Opsi tidak boleh kosong.').max(200);
export const choiceQuestionSchema = z
	.object({
		prompt: z.string().trim().min(1, 'Pertanyaan tidak boleh kosong.').max(1000),
		options: z.array(optionLabel).min(2, 'Minimal dua opsi diperlukan.').max(8),
		correctOptions: z
			.array(z.number().int().min(0))
			.min(1, 'Pilih minimal satu jawaban benar.')
			.max(8),
		timeLimit: z.coerce
			.number()
			.int()
			.min(5, 'Waktu minimal 5 detik.')
			.max(300, 'Waktu maksimal 300 detik.')
			.default(20)
	})
	.strict()
	.superRefine(({ options, correctOptions }, ctx) => {
		const normalized = options.map((option) => option.toLocaleLowerCase());
		if (new Set(normalized).size !== normalized.length)
			ctx.addIssue({ code: 'custom', path: ['options'], message: 'Opsi tidak boleh duplikat.' });
		if (
			new Set(correctOptions).size !== correctOptions.length ||
			correctOptions.some((index) => index >= options.length)
		)
			ctx.addIssue({
				code: 'custom',
				path: ['correctOptions'],
				message: 'Jawaban benar tidak valid.'
			});
	});
export const choiceResponseSchema = z
	.object({
		questionId: z.string().trim().min(1).max(100),
		optionIds: z.array(z.string().trim().min(1).max(100)).min(1).max(8)
	})
	.strict()
	.superRefine(({ optionIds }, ctx) => {
		if (new Set(optionIds).size !== optionIds.length)
			ctx.addIssue({ code: 'custom', path: ['optionIds'], message: 'Pilihan jawaban duplikat.' });
	});
export type ChoiceQuestionInput = z.infer<typeof choiceQuestionSchema>;
export type ChoiceResponseInput = z.infer<typeof choiceResponseSchema>;
