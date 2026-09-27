import { describe, expect, it } from 'vitest';
import { choiceQuestionSchema, choiceResponseSchema } from '../../src/lib/poll/validation';
describe('quiz validation', () => {
	it('requires unique options and accepts multiple correct answers', () => {
		expect(
			choiceQuestionSchema.parse({
				prompt: 'Pilih semua',
				options: ['A', 'B', 'C'],
				correctOptions: [0, 2]
			})
		).toMatchObject({ correctOptions: [0, 2] });
		expect(() =>
			choiceQuestionSchema.parse({ prompt: 'Pilih', options: ['A', 'B'], correctOptions: [] })
		).toThrow();
		expect(() =>
			choiceQuestionSchema.parse({ prompt: 'Pilih', options: ['A', 'A'], correctOptions: [0] })
		).toThrow();
	});
	it('accepts multiple selected option ids without duplicates', () => {
		expect(choiceResponseSchema.parse({ questionId: 'q-1', optionIds: ['a', 'c'] })).toEqual({
			questionId: 'q-1',
			optionIds: ['a', 'c']
		});
		expect(() =>
			choiceResponseSchema.parse({ questionId: 'q-1', optionIds: ['a', 'a'] })
		).toThrow();
	});
});
