<script lang="ts">
	let {
		words = [],
		presentation = false
	}: { words?: { word: string; weight: number }[]; presentation?: boolean } = $props();
	const max = $derived(Math.max(1, ...words.map((item) => item.weight)));
	const palette = [
		'text-cyan-300',
		'text-amber-300',
		'text-emerald-300',
		'text-pink-300',
		'text-indigo-300'
	];
	const font = (weight: number) =>
		`font-size:${Math.round((presentation ? 28 : 20) + (weight / max) * (presentation ? 84 : 58))}px`;
</script>

<div
	class="rounded-[2rem] border border-white/10 bg-slate-950/40 p-5 sm:p-8"
	data-testid="wordcloud-results"
	aria-live="polite"
>
	<p class="mb-4 text-sm font-bold text-white/65">
		{words.reduce((sum, item) => sum + item.weight, 0)} kata disetujui · live
	</p>
	<div
		class="flex min-h-[320px] flex-wrap items-center justify-center gap-x-6 gap-y-4"
		role="list"
		aria-label="Word cloud"
	>
		{#each words as item, i}<span
				role="listitem"
				class="max-w-full break-words font-black leading-tight {palette[i % palette.length]}"
				style={font(item.weight)}
				title={`${item.word}: ${item.weight}`}>{item.word}</span
			>{:else}<p class="text-center text-white/55">Belum ada kata disetujui.</p>{/each}
	</div>
	{#if !presentation}<details class="mt-5 rounded-xl bg-white/5 p-4 text-sm">
			<summary class="cursor-pointer font-black">Daftar frekuensi</summary>
			<ol class="mt-3 space-y-1">
				{#each words as item}<li>
						<span class="font-mono">{item.weight}×</span>
						{item.word}
					</li>{/each}
			</ol>
		</details>{/if}
</div>
