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
	class:compact={presentation}
	class="wordcloud-results rounded-[2rem] border border-white/10 bg-slate-950/40 p-5 sm:p-8"
	data-testid="wordcloud-results"
	aria-live="polite"
>
	<p class="mb-4 text-sm font-bold text-white/65">{total} approved words · live</p>
	{#if words.length}
		<div class="cloud-frame" role="list" aria-label="Word cloud">
			<svg
				viewBox={`0 0 ${layout.width} ${layout.height}`}
				role="img"
				aria-label="Word cloud by frequency"
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
	{:else}<p class="cloud-empty">No approved words yet.</p>{/if}
	{#if layout.omitted}
		<p class="mt-3 text-center text-sm text-amber-200">
			{layout.omitted} words could not fit in this view; open the frequency list to see all words.
		</p>
	{/if}
	{#if !presentation}
		<details class="mt-5 rounded-xl bg-white/5 p-4 text-sm">
			<summary class="cursor-pointer font-black">Frequency list</summary>
			<ol class="mt-3 space-y-1">
				{#each words as item}
					<li><span class="font-mono">{item.weight}×</span> {item.word}</li>
				{/each}
			</ol>
		</details>
	{/if}
</div>

<style>
	.wordcloud-results.compact {
		display: flex;
		min-height: 0;
		flex: 1;
		flex-direction: column;
		padding: clamp(0.75rem, 2vw, 1.5rem);
	}
	.cloud-frame {
		min-height: 320px;
	}
	.compact .cloud-frame {
		position: relative;
		min-height: 0;
		flex: 1;
	}
	.compact .cloud-frame svg {
		position: absolute;
		inset: 0;
		min-height: 0;
		height: 100%;
	}
	.compact .cloud-empty {
		min-height: 0;
		flex: 1;
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
