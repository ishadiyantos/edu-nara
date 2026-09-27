import { expect, test } from 'vitest';
import { csv } from '../../src/lib/server/csv';

test('CSV quotes cells and neutralizes spreadsheet formulas', () => {
	expect(csv([['Nama', 'Jawaban'], ['Ayu', '=1+1'], ['B,ayu', '+cmd'], ['"quoted"', '@sum']])).toBe(
		'\uFEFFNama,Jawaban\r\nAyu,"\'=1+1"\r\n"B,ayu","\'+cmd"\r\n"""quoted""","\'@sum"\r\n'
	);
});
