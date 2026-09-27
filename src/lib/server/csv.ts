function cell(value: string | number | null | undefined) {
	const text = String(value ?? '');
	const formula = /^[=+\-@]/.test(text);
	const safe = formula ? `'${text}` : text;
	return formula || /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function csv(rows: (string | number | null | undefined)[][]) {
	return `\uFEFF${rows.map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`;
}
