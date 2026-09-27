import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readStoredImage, saveImageUpload } from '../../src/lib/server/media-storage';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function uploadDir() {
	const dir = mkdtempSync(join(tmpdir(), 'edu-media-'));
	dirs.push(dir);
	return dir;
}

describe('saveImageUpload', () => {
	it('stores valid image under random server id, never client filename', () => {
		const directory = uploadDir();
		const upload = saveImageUpload(png, directory);

		expect(upload).toMatchObject({ contentType: 'image/png' });
		expect(upload.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(upload.id).not.toContain('evil');
		expect(readdirSync(directory)).toEqual([upload.id]);
		expect(existsSync(join(directory, upload.id))).toBe(true);
	});

	it('rejects invalid bytes before creating upload directory or file', () => {
		const directory = join(uploadDir(), 'uploads');
		expect(() => saveImageUpload(new Uint8Array([0x7f, 0x45, 0x4c, 0x46]), directory)).toThrow(
			'Format gambar tidak didukung.'
		);
		expect(existsSync(directory)).toBe(false);
	});

	it('reads only validated stored images and rejects traversal', () => {
		const directory = uploadDir();
		const upload = saveImageUpload(png, directory);
		const read = readStoredImage(directory, upload.id);
		expect(read?.contentType).toBe('image/png');
		expect(read ? Array.from(read.bytes) : null).toEqual(Array.from(png));
		expect(readStoredImage(directory, '../outside')).toBeNull();
		const invalid = join(directory, 'tampered');
		writeFileSync(invalid, Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
		expect(readStoredImage(directory, 'tampered')).toBeNull();
	});
});
