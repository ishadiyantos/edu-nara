<script lang="ts">
	type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
	type Props = {
		tone?: Tone;
		dot?: boolean;
		children: import('svelte').Snippet;
	};
	let { tone = 'neutral', dot = false, children }: Props = $props();

	const tones: Record<Tone, string> = {
		neutral: 'bg-slate-100 text-slate-800',
		success: 'bg-emerald-100 text-emerald-800',
		warning: 'bg-amber-100 text-amber-900',
		danger: 'bg-rose-100 text-rose-800',
		info: 'bg-indigo-100 text-indigo-800'
	};
	const dotColors: Record<Tone, string> = {
		neutral: 'bg-slate-500',
		success: 'bg-emerald-500',
		warning: 'bg-amber-500',
		danger: 'bg-rose-500',
		info: 'bg-indigo-500'
	};
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold {tones[
		tone
	]}"
>
	{#if dot}
		<span class="h-1.5 w-1.5 rounded-full {dotColors[tone]}" aria-hidden="true"></span>
	{/if}
	{@render children()}
</span>
