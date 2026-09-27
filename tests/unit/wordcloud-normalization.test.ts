import { expect, test } from 'vitest';
import { normalizeWordcloudText } from '../../src/lib/server/poll/wordcloud';

test('normalizes NFC, case, whitespace and rejects controls or invalid word counts', () => {
	expect(normalizeWordcloudText('  CAFE\u0301   Belajar  ')).toBe('café belajar');
	expect(() => normalizeWordcloudText('a'.repeat(81))).toThrow();
	expect(() => normalizeWordcloudText('aman\u0000')).toThrow();
});
