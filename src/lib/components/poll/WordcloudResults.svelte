<script lang="ts">
	import { layoutWordcloud } from '$lib/poll/wordcloud-layout';
	let {
		words = [],
		presentation = false
	}: { words?: { word: string; weight: number }[]; presentation?: boolean } = $props();
	const layout = $derived(layoutWordcloud(words, { width: 960, height: presentation ? 520 : 400 }));
	const palette = ['#67e8f9', '#fcd34d', '#6ee7b7', '#f9a8d4', '#a5b4fc', '#fdba74'];
	const color = (index: number) => palette[index % palette.length];
	const total = $derived(words.reduce((sum, item) => sum + item.weight, 0));
</script>

<div
	class="rounded-[2rem] border border-white/10 bg-slate-950/40 p-5 sm:p-8"
	data-testid="wordcloud-results"
	aria-live="polite"
>
	<p class="mb-4 text-sm font-bold text-white/65">{total} kata disetujui · live</p>
	{#if words.length}
		<div class="cloud-frame" role="list" aria-label="Word cloud">
			<svg
				viewBox={`0 0 ${layout.width} ${layout.height}`}
				role="img"
				aria-label="Awan kata berdasarkan frekuensi"
				preserveAspectRatio="xMidYMid meet"
			>
				{#each layout.items as item, index}
					<text
						x={item.x + item.width / 2}
						y={item.y + item.height / 2}
						text-anchor="middle"
						dominant-baseline="middle"
						fill={color(index)}
						font-size={item.fontSize}
						font-weight="900"
						class="cloud-word"
						transform={item.rotated
							? `rotate(90 ${item.x + item.width / 2} ${item.y + item.height / 2})`
							: undefined}
						role="listitem"
						aria-label={`${item.word}: ${item.weight}`}>{item.word}</text
					>
				{/each}
			</svg>
		</div>
	{:else}<p class="cloud-empty">Belum ada kata disetujui.</p>{/if}
	{#if layout.omitted}
		<p class="mt-3 text-center text-sm text-amber-200">
			{layout.omitted} kata terlalu banyak untuk area tayang; buka daftar frekuensi untuk melihat semua.
		</p>
	{/if}
	{#if !presentation}
		<details class="mt-5 rounded-xl bg-white/5 p-4 text-sm">
			<summary class="cursor-pointer font-black">Daftar frekuensi</summary>
			<ol class="mt-3 space-y-1">
				{#each words as item}
					<li><span class="font-mono">{item.weight}×</span> {item.word}</li>
				{/each}
			</ol>
		</details>
	{/if}
</div>

<style>
	.cloud-frame {
		min-height: 320px;
		container-type: inline-size;
	}
	.cloud-frame svg {
		display: block;
		width: 100%;
		height: auto;
		min-height: 320px;
	}
	.cloud-word {
		paint-order: stroke;
		stroke: #0f172a;
		stroke-width: 1.5px;
		stroke-linejoin: round;
	}
	.cloud-empty {
		display: grid;
		min-height: 320px;
		place-items: center;
		color: rgb(255 255 255 / 55%);
	}
</style>
