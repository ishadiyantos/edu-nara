<script lang="ts">
	import { Button } from '$components/ui';
	import { MAX_POST_BODY, postLength, validatePostBody } from '$lib/board/posts';

	type SendState = 'idle' | 'sending' | 'sent' | 'error';
	type Props = {
		columnId: string;
		initialBody?: string;
		onsubmit?: (payload: { columnId: string; body: string }) => void | Promise<void>;
		oncancel?: () => void;
		disabled?: boolean;
		placeholder?: string;
	};

	let {
		columnId,
		initialBody = '',
		onsubmit,
		oncancel,
		disabled = false,
		placeholder = 'Tulis kartu (maks 500 karakter)...'
	}: Props = $props();

	let body = $state(initialBody);
	let sendState = $state<SendState>('idle');
	let errorMessage = $state('');

	let length = $derived(postLength(body));
	let isOverLimit = $derived(length > MAX_POST_BODY);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		const result = validatePostBody(body);
		if (!result.ok) {
			sendState = 'error';
			errorMessage = result.message;
			return;
		}

		sendState = 'sending';
		errorMessage = '';
		try {
			if (onsubmit) {
				await onsubmit({ columnId, body: result.value });
			}
			sendState = 'sent';
			body = '';
		} catch (err) {
			sendState = 'error';
			errorMessage = err instanceof Error ? err.message : 'Gagal mengirim kartu.';
		}
	}

	function handleCancel() {
		body = '';
		errorMessage = '';
		sendState = 'idle';
		oncancel?.();
	}
</script>

<!-- ponytail: local sample submit callback; full backend and SSE wiring in t_77b96303 -->
<div
	data-testid="post-composer"
	class="w-full rounded-2xl border border-border bg-surface p-4 shadow-card"
>
	<form onsubmit={handleSubmit} class="flex flex-col gap-3">
		<div class="flex items-center justify-between">
			<label
				for={`post-body-${columnId}`}
				class="text-xs font-bold uppercase tracking-wider text-text-muted"
			>
				Tulis Kartu Baru
			</label>
			<span
				data-testid="char-counter"
				class={`text-xs font-mono font-bold ${isOverLimit ? 'text-danger' : 'text-text-muted'}`}
				aria-live="polite"
			>
				{length} / {MAX_POST_BODY}
			</span>
		</div>

		<textarea
			id={`post-body-${columnId}`}
			bind:value={body}
			{placeholder}
			maxlength={MAX_POST_BODY + 10}
			disabled={disabled || sendState === 'sending'}
			rows={3}
			class="w-full resize-none rounded-xl border border-border bg-bg/50 p-3 text-sm text-text placeholder-text-muted/60 transition focus:border-primary focus:bg-surface focus:outline-none"
			aria-invalid={isOverLimit || sendState === 'error' ? 'true' : 'false'}
			aria-describedby={`post-status-${columnId}`}
		></textarea>

		{#if sendState === 'error' && errorMessage}
			<p
				id={`post-status-${columnId}`}
				role="alert"
				class="rounded-lg bg-danger/10 p-2 text-xs font-bold text-danger"
			>
				{errorMessage}
			</p>
		{:else if sendState === 'sent'}
			<p
				id={`post-status-${columnId}`}
				role="status"
				class="rounded-lg bg-emerald-500/10 p-2 text-xs font-bold text-emerald-700"
			>
				Kartu berhasil dikirim. Menunggu moderasi dosen.
			</p>
		{:else if sendState === 'sending'}
			<p id={`post-status-${columnId}`} role="status" class="text-xs font-semibold text-text-muted">
				Mengirim kartu...
			</p>
		{/if}

		<div class="flex items-center justify-end gap-2 pt-1">
			{#if oncancel}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onclick={handleCancel}
					disabled={sendState === 'sending'}
				>
					Batal
				</Button>
			{/if}
			<Button
				type="submit"
				variant="primary"
				size="sm"
				loading={sendState === 'sending'}
				disabled={disabled || !body.trim() || isOverLimit}
			>
				Kirim
			</Button>
		</div>
	</form>
</div>
