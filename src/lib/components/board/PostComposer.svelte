<script module lang="ts">
	export const CARD_COLORS = [
		['cream', 'Krem'],
		['rose', 'Merah muda'],
		['amber', 'Kuning'],
		['mint', 'Hijau mint'],
		['sky', 'Biru langit'],
		['lavender', 'Ungu muda']
	] as const;
	export type PostDraft = {
		columnId: string;
		body: string;
		title: string;
		linkUrl: string;
		requestId: string;
		cardColor: (typeof CARD_COLORS)[number][0];
		image?: File;
	};
</script>

<script lang="ts">
	import { MAX_POST_BODY, postLength, isSafeHttpUrl } from '$lib/board/posts';
	let {
		columnId = $bindable(''),
		columns = [],
		initialBody = '',
		onsubmit,
		oncancel,
		disabled = false,
		placeholder = 'Tulis ide Anda…'
	}: {
		columnId?: string;
		columns?: { id: string; title: string }[];
		initialBody?: string;
		onsubmit?: (payload: PostDraft) => void | Promise<void>;
		oncancel?: () => void;
		disabled?: boolean;
		placeholder?: string;
	} = $props();
	const initial = () => initialBody;
	let body = $state(initial());
	let title = $state('');
	let cardColor = $state<(typeof CARD_COLORS)[number][0]>('cream');
	let linkUrl = $state('');
	let image = $state<File | undefined>();
	let fileInput: HTMLInputElement;
	let sending = $state(false);
	let errorMessage = $state('');
	let sent = $state(false);
	let requestId = '';
	let priorPayload = '';
	const length = $derived(postLength(body.trim()));
	async function send(event: SubmitEvent) {
		event.preventDefault();
		if (sending || disabled) return;
		errorMessage = '';
		sent = false;
		if (length > MAX_POST_BODY) {
			errorMessage = 'Isi kartu maksimal 500 karakter.';
			return;
		}
		if (!body.trim() && !title.trim() && !linkUrl.trim() && !image) {
			errorMessage = 'Isi teks, judul, tautan, atau gambar terlebih dahulu.';
			return;
		}
		if (linkUrl.trim() && !isSafeHttpUrl(linkUrl.trim())) {
			errorMessage = 'Tautan harus http/https.';
			return;
		}
		if (image && image.size > 5 * 1024 * 1024) {
			errorMessage = 'Gambar maksimal 5 MB.';
			return;
		}
		const signature = JSON.stringify([
			columnId,
			body,
			title,
			linkUrl,
			image?.name,
			image?.size,
			image?.lastModified,
			cardColor
		]);
		if (!requestId || priorPayload !== signature) {
			requestId = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
				byte.toString(16).padStart(2, '0')
			).join('');
			priorPayload = signature;
		}
		sending = true;
		try {
			if (!onsubmit) throw new Error('Pengiriman belum tersedia.');
			await onsubmit({
				columnId,
				body: body.trim(),
				title: title.trim(),
				linkUrl: linkUrl.trim(),
				image,
				requestId,
				cardColor
			});
			body = '';
			title = '';
			linkUrl = '';
			cardColor = 'cream';
			image = undefined;
			requestId = '';
			sent = true;
			if (fileInput) fileInput.value = '';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Gagal mengirim kartu. Coba lagi.';
		} finally {
			sending = false;
		}
	}
</script>

<form data-testid="post-composer" onsubmit={send} class="composer">
	<fieldset disabled={sending || disabled}>
		<legend>Tulis kartu baru</legend>
		<label for="post-column">Letakkan di kolom</label>
		<select id="post-column" bind:value={columnId} required>
			{#each columns as column}<option value={column.id}>{column.title}</option>{/each}
		</select>
		<label for={`post-title-${columnId}`}>Judul (opsional)</label>
		<input
			id={`post-title-${columnId}`}
			bind:value={title}
			maxlength="120"
			placeholder="Judul ide"
		/>
		<label for={`post-body-${columnId}`}>Isi kartu</label>
		<textarea
			id={`post-body-${columnId}`}
			bind:value={body}
			{placeholder}
			rows="4"
			aria-invalid={length > MAX_POST_BODY}
		></textarea>
		<span data-testid="char-counter" class:over={length > MAX_POST_BODY}
			>{length} / {MAX_POST_BODY}</span
		>
		<fieldset class="color-picker">
			<legend>Warna kartu</legend>
			<div role="group" aria-label="Warna kartu">
				{#each CARD_COLORS as [value, label]}<button
						type="button"
						class={`color-swatch ${value}`}
						class:selected={cardColor === value}
						aria-label={label}
						aria-pressed={cardColor === value}
						onclick={() => (cardColor = value)}
					></button>{/each}
			</div>
		</fieldset>
		<label for={`post-link-${columnId}`}>Tautan http/https (opsional)</label>
		<input
			id={`post-link-${columnId}`}
			type="url"
			bind:value={linkUrl}
			maxlength="2048"
			placeholder="https://…"
		/>
		<label for={`post-image-${columnId}`}>Gambar (opsional, maksimal 5 MB)</label>
		<input
			id={`post-image-${columnId}`}
			bind:this={fileInput}
			type="file"
			accept="image/jpeg,image/png,image/webp"
			onchange={(e) => {
				image = e.currentTarget.files?.[0];
			}}
		/>
		<small
			>JPEG, PNG, atau WebP. Tautan akan mencoba menampilkan pratinjau aman bila situs mengizinkan.</small
		>
		{#if image}<button
				type="button"
				onclick={() => {
					image = undefined;
					fileInput.value = '';
				}}>Hapus gambar terpilih</button
			>{/if}
		<div class="actions">
			{#if oncancel}<button type="button" onclick={oncancel}>Batal</button>{/if}
			<button type="submit" class="send" disabled={length > MAX_POST_BODY}
				>{sending ? 'Mengirim…' : 'Kirim'}</button
			>
		</div>
	</fieldset>
	{#if errorMessage}<p role="alert">{errorMessage}</p>{/if}
	{#if sent}<p role="status">Kartu berhasil dikirim.</p>{/if}
</form>

<style>
	.composer {
		border: 1px solid #c7d2fe;
		border-radius: 1rem;
		background: white;
		color: #0f172a;
		padding: 1rem;
	}
	fieldset {
		display: grid;
		gap: 0.5rem;
		min-width: 0;
	}
	legend {
		font-weight: 800;
		margin-bottom: 0.7rem;
	}
	label {
		font-size: 0.8rem;
		font-weight: 700;
	}
	input,
	textarea,
	select {
		width: 100%;
		min-width: 0;
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
		padding: 0.65rem;
		background: #f8fafc;
		color: #0f172a;
	}
	input[type='file'] {
		font-size: 0.75rem;
		padding: 0.5rem;
	}
	textarea {
		resize: vertical;
	}
	small,
	span {
		font-size: 0.75rem;
		color: #475569;
	}
	.color-picker {
		border: 0;
		padding: 0;
	}
	.color-picker legend {
		font-size: 0.8rem;
		margin-bottom: 0.35rem;
	}
	.color-picker div {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}
	.color-swatch {
		width: 44px;
		min-width: 44px;
		min-height: 44px;
		height: 44px;
		padding: 0;
		border-radius: 50%;
		border: 2px solid #fff;
		box-shadow: 0 0 0 1px #94a3b8;
	}
	.color-swatch.selected {
		box-shadow: 0 0 0 3px #0f766e;
		transform: scale(1.08);
	}
	.color-swatch.cream {
		background: #fff7df;
	}
	.color-swatch.rose {
		background: #ffdce1;
	}
	.color-swatch.amber {
		background: #fff0b8;
	}
	.color-swatch.mint {
		background: #d8f4e7;
	}
	.color-swatch.sky {
		background: #d8efff;
	}
	.color-swatch.lavender {
		background: #e9ddff;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: end;
		margin-top: 0.5rem;
	}
	button {
		min-height: 44px;
		border-radius: 0.6rem;
		padding: 0.6rem 1rem;
		background: #e2e8f0;
		font-weight: 700;
	}
	button.send {
		color: white;
		background: #4f46e5;
	}
	.over,
	[role='alert'] {
		color: #b91c1c;
	}
	[role='status'] {
		color: #047857;
	}
</style>
