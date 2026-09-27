export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageFormat = 'jpeg' | 'png' | 'webp';
export type ImageValidation =
	| { ok: true; format: ImageFormat; contentType: `image/${'jpeg' | 'png' | 'webp'}` }
	| { ok: false; error: 'Ukuran file terlalu besar.' | 'Format gambar tidak didukung.' };

const startsWith = (bytes: Uint8Array, signature: readonly number[]) =>
	signature.every((byte, index) => bytes[index] === byte);

/** Validate untrusted image bytes before storage or serving. */
export function validateImageUpload(input: Uint8Array | ArrayBuffer): ImageValidation {
	if (input.byteLength > MAX_IMAGE_BYTES) return { ok: false, error: 'Ukuran file terlalu besar.' };
	const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

	if (startsWith(bytes, [0xff, 0xd8, 0xff]))
		return { ok: true, format: 'jpeg', contentType: 'image/jpeg' };
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
		return { ok: true, format: 'png', contentType: 'image/png' };
	if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50]))
		return { ok: true, format: 'webp', contentType: 'image/webp' };

	return { ok: false, error: 'Format gambar tidak didukung.' };
}
