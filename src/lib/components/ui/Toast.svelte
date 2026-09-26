<script lang="ts">
	type Tone = 'info' | 'success' | 'warning' | 'danger';
	type Props = {
		tone?: Tone;
		message: string;
		visible?: boolean;
	};
	let { tone = 'info', message, visible = $bindable(true) }: Props = $props();

	const tones: Record<Tone, string> = {
		info: 'bg-indigo-600 text-white',
		success: 'bg-emerald-600 text-white',
		warning: 'bg-amber-600 text-white',
		danger: 'bg-rose-600 text-white'
	};
</script>

{#if visible}
	<div
		class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-3 text-sm font-semibold shadow-lift {tones[
			tone
		]}"
		role="status"
		aria-live="polite"
	>
		{message}
	</div>
{/if}
