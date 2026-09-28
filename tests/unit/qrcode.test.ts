import { expect, test } from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

/** Render a QR matrix produced by the component's encoder into an RGBA bitmap jsQR can read. */
function renderModules(modules: { size: number; data: Uint8Array }, quiet = 4, scale = 6) {
	const px = (modules.size + quiet * 2) * scale;
	const data = new Uint8ClampedArray(px * px * 4).fill(255);
	for (let y = 0; y < modules.size; y++)
		for (let x = 0; x < modules.size; x++) {
			if (!modules.data[y * modules.size + x]) continue;
			for (let dy = 0; dy < scale; dy++)
				for (let dx = 0; dx < scale; dx++) {
					const px_ = (x + quiet) * scale + dx;
					const py = (y + quiet) * scale + dy;
					const offset = (py * px + px_) * 4;
					data[offset] = data[offset + 1] = data[offset + 2] = 0;
				}
		}
	return { data, width: px, height: px };
}

test('join URL QR decodes back to the exact session link', () => {
	const joinUrl = 'http://127.0.0.1:4173/join?code=VY32FD';
	const modules = QRCode.create(joinUrl, { errorCorrectionLevel: 'M' }).modules;
	const decoded = jsQR(
		renderModules({ size: modules.size, data: modules.data as unknown as Uint8Array }).data,
		(modules.size + 8) * 6,
		(modules.size + 8) * 6
	);
	expect(decoded?.data).toBe(joinUrl);
});

test('decodes at mobile-friendly sizes and with longer join hosts', () => {
	const longUrl = `https://edu-nara.example.sch.id/join?code=${'9'.repeat(6)}`;
	for (const quiet of [4]) {
		for (const scale of [2, 3, 8]) {
			const modules = QRCode.create(longUrl, { errorCorrectionLevel: 'M' }).modules;
			const rendered = renderModules(
				{ size: modules.size, data: modules.data as unknown as Uint8Array },
				quiet,
				scale
			);
			expect(jsQR(rendered.data, rendered.width, rendered.height)?.data).toBe(longUrl);
		}
	}
});
