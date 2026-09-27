import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { validateImageUpload } from './media';

export function uploadDirectory(): string {
	return process.env.UPLOAD_DIR || join(homedir(), '.local/share/edu-nara/uploads');
}

export type StoredImage = {
	id: string;
	/** server-generated filename without extension or client-derived parts */
	contentType: `image/${'jpeg' | 'png' | 'webp'}`;
};

export type ReadStoredImage = { bytes: Buffer; contentType: `image/${'jpeg' | 'png' | 'webp'}` };

/**
 * Persist a validated image into `directory` under a cryptographically random,
 * server-generated filename. The client filename is never trusted or stored.
 */
export function saveImageUpload(input: Uint8Array | ArrayBuffer, directory: string): StoredImage {
	const result = validateImageUpload(input);
	if (!result.ok) throw new Error(result.error);
	const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
	const id = randomUUID();
	mkdirSync(directory, { recursive: true, mode: 0o700 });
	writeFileSync(join(directory, id), bytes, { mode: 0o600, flag: 'wx' });
	return { id, contentType: result.contentType };
}

/** Read only safe-id files whose current bytes still pass image validation. */
export function readStoredImage(directory: string, id: string): ReadStoredImage | null {
	if (!/^[0-9a-f-]{36}$/.test(id)) return null;
	try {
		const bytes = readFileSync(join(directory, id));
		const result = validateImageUpload(bytes);
		return result.ok ? { bytes, contentType: result.contentType } : null;
	} catch {
		return null;
	}
}
