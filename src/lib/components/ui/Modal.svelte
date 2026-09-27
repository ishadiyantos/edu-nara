<script lang="ts">
	type Props = {
		open: boolean;
		title: string;
		onclose?: () => void;
		children: import('svelte').Snippet;
	};
	let { open = $bindable(false), title, onclose, children }: Props = $props();

	const id = $props.id();
	let dialog: HTMLDialogElement | null = $state(null);

	$effect(() => {
		if (open) dialog?.showModal();
		else dialog?.close();
	});

	function handleClose() {
		open = false;
		onclose?.();
	}
</script>

<dialog
	bind:this={dialog}
	aria-labelledby={`${id}-title`}
	onclose={handleClose}
	class="surface m-auto max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-auto p-6"
>
	<div class="mb-4 flex items-start justify-between gap-4">
		<h2 id={`${id}-title`} class="text-xl font-bold text-text">{title}</h2>
		<button
			type="button"
			aria-label="Tutup"
			onclick={() => dialog?.close()}
			class="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-slate-100"
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
</dialog>

<style>
	dialog::backdrop {
		background: rgb(15 23 42 / 50%);
		backdrop-filter: blur(4px);
	}
</style>
