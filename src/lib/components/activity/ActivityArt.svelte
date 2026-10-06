<script lang="ts">
	let { type }: { type: string } = $props();
</script>

<svg viewBox="0 0 120 100" fill="none" aria-hidden="true" class="art">
	{#if type === 'choice'}
		<rect x="19" y="10" width="82" height="80" rx="12" fill="#c4b5fd" />
		<rect x="29" y="21" width="44" height="5" rx="2.5" fill="#4c1d95" />
		{#each [0, 1, 2] as i}<rect
				x="29"
				y={35 + i * 15}
				width="62"
				height="11"
				rx="4"
				fill={i === 1 ? '#6d28d9' : '#ede9fe'}
			/><circle cx="36" cy={40.5 + i * 15} r="2.5" fill={i === 1 ? '#ede9fe' : '#8b5cf6'} />{/each}
		<path d="m79 53 4 4 8-9" stroke="white" stroke-width="3" stroke-linecap="round" />
	{:else if type === 'wordcloud'}
		<path
			d="M28 77C5 77 4 48 22 44c-3-26 31-35 44-17 23-12 43 7 37 24 21 17 6 31-11 31H28Z"
			fill="#a5f3fc"
		/>
		<text x="34" y="51" fill="#155e75" font-size="15" font-weight="800">ideas</text>
		<text x="24" y="68" fill="#0e7490" font-size="10" font-weight="700">share</text>
		<text x="62" y="68" fill="#155e75" font-size="13" font-weight="800">learn</text>
	{:else if type === 'crossword'}
		<rect x="17" y="13" width="86" height="74" rx="8" fill="#fde68a" />
		{#each [0, 1, 2, 3] as row}{#each [0, 1, 2, 3] as col}<rect
					x={24 + col * 18}
					y={20 + row * 16}
					width="14"
					height="12"
					rx="2"
					fill={(row + col) % 3 === 0 ? '#1e3a5f' : '#fff7ed'}
				/>{/each}{/each}
	{:else}
		<rect x="12" y="17" width="96" height="70" rx="10" fill="#99f6e4" />
		{#each [0, 1, 2] as i}<rect
				x={20 + i * 28}
				y="25"
				width="23"
				height="53"
				rx="4"
				fill="#134e4a"
			/><rect
				x={24 + i * 28}
				y={33 + i * 3}
				width="15"
				height="17"
				rx="2"
				fill={['#fef3c7', '#fecdd3', '#ddd6fe'][i]}
			/><rect x={24 + i * 28} y={54 + i * 3} width="15" height="10" rx="2" fill="#ccfbf1" />{/each}
	{/if}
</svg>

<style>
	.art {
		width: 100%;
		height: 100%;
		max-height: 125px;
	}
</style>
