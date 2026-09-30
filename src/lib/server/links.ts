import { z } from 'zod';

/**
 * Validasi tautan untuk lampiran kartu (Fase 4b).
 *
 * Hanya menerima URL absolut dengan skema http atau https.
 * Menolak javascript:, data:, file:, skema lain, URL rusak/relatif,
 * dan nilai kosong bila tautan dipilih.
 *
 * Validasi murni di sisi aplikasi (parse URL + cek skema) —
 * TIDAK melakukan request preview, fetch metadata, atau akses URL
 * server-side agar tidak membuka celah SSRF.
 *
 * File ini dibuat khusus untuk task t_b253921b agar tidak menyentuh
 * src/lib/validation.ts milik worker lain (hotspot bersama).
 */

const message = 'Link must be a valid http or https URL.';

export const linkUrlSchema = z
	.string()
	.trim()
	.min(1, 'Link is required.')
	.transform((value, ctx) => {
		try {
			if (!/^https?:\/\/[^/\s\\]+(\/[^\s\\]*)?$/i.test(value) || /%(?![0-9a-f]{2})/i.test(value))
				throw new Error();
			const url = new URL(value);
			if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname)
				throw new Error();
			return url.href;
		} catch {
			ctx.addIssue({ code: 'custom', message });
			return z.NEVER;
		}
	});

export type LinkUrlResult =
	{ readonly ok: true; readonly url: string } | { readonly ok: false; readonly error: string };

export const validateLinkUrl = (value: unknown): LinkUrlResult => {
	const result = linkUrlSchema.safeParse(value);
	return result.success
		? ({ ok: true, url: result.data } as const)
		: ({ ok: false, error: result.error.issues[0]?.message ?? 'Invalid link.' } as const);
};
