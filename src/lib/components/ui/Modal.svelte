<script lang="ts">
	import { onMount } from 'svelte';

	type Props = {
		open: boolean;
		title: string;
		onclose?: () => void;
		children: import('svelte').Snippet;
	};
	let { open = $bindable(false), title, onclose, children }: Props = $props();

	let dialog: HTMLDivElement | null = $state(null);
	let previouslyFocused: HTMLElement | null = null;

	$effect(() => {
		if (open) {
			previouslyFocused = document.activeElement as HTMLElement | null;
			setTimeout(() => dialog?.focus(), 10);
		} else {
			previouslyFocused?.focus();
		}
	});

	function close() {
		open = false;
		onclose?.();
	}

	function onKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') close();
	}

	onMount(() => {
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});
</script>

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
		onclick={close}
		role="presentation"
	></div>
	<!-- Dialog -->
	<div
		bind:this={dialog}
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		tabindex="-1"
		class="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
	>
		<div class="surface w-full max-w-lg p-6">
			<div class="mb-4 flex items-start justify-between gap-4">
				<h2 id="modal-title" class="text-xl font-bold text-text">{title}</h2>
				<button
					type="button"
					aria-label="Tutup"
					onclick={close}
					class="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-slate-100"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path
							d="M6 6L18 18M6 18L18 6"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
						/>
					</svg>
				</button>
			</div>
			{@render children()}
		</div>
	</div>
{/if}
