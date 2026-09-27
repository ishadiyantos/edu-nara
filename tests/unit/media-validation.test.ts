import { describe, expect, it } from 'vitest';
import { validateImageUpload, MAX_IMAGE_BYTES } from '../../src/lib/server/media';

const withBytes = (...bytes: number[]) => new Uint8Array(bytes);

describe('validateImageUpload', () => {
	it('accepts JPEG by magic bytes, not filename', () => {
		const jpeg = withBytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46);
		expect(validateImageUpload(jpeg)).toMatchObject({ ok: true, format: 'jpeg' });
	});

	it('accepts PNG by magic bytes', () => {
		const png = withBytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d);
		expect(validateImageUpload(png)).toMatchObject({ ok: true, format: 'png' });
	});

	it('accepts WebP by magic bytes', () => {
		const webp = withBytes(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50);
		expect(validateImageUpload(webp)).toMatchObject({ ok: true, format: 'webp' });
	});

	it('rejects executable (ELF) even with jpeg-like name', () => {
		const elf = withBytes(0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00);
		expect(validateImageUpload(elf).ok).toBe(false);
	});

	it('rejects a file over the 5 MB limit', () => {
		const tooBig = new Uint8Array(MAX_IMAGE_BYTES + 1);
		tooBig.set([0xff, 0xd8, 0xff], 0);
		expect(validateImageUpload(tooBig).ok).toBe(false);
	});

	it('rejects unknown binary with no matching magic bytes', () => {
		expect(validateImageUpload(withBytes(0x00, 0x01, 0x02, 0x03)).ok).toBe(false);
	});
});
