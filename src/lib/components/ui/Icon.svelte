<script lang="ts">
	type Name =
		| 'arrow-left'
		| 'arrow-right'
		| 'close'
		| 'fullscreen'
		| 'link'
		| 'play'
		| 'stop'
		| 'qr'
		| 'eye-off'
		| 'eye'
		| 'home'
		| 'pause'
		| 'timer'
		| 'help';
	let { name, size = 20 }: { name: Name; size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	aria-hidden="true"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
>
	{#if name === 'arrow-left'}<path d="M19 12H5M12 19l-7-7 7-7" />
	{:else if name === 'arrow-right'}<path d="M5 12h14M12 5l7 7-7 7" />
	{:else if name === 'close'}<path d="M6 6l12 12M18 6L6 18" />
	{:else if name === 'fullscreen'}<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" />
	{:else if name === 'link'}<path
			d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"
		/>
	{:else if name === 'play'}<path d="M8 5l11 7-11 7V5z" />
	{:else if name === 'stop'}<rect x="6" y="6" width="12" height="12" rx="2" />
	{:else if name === 'qr'}<path
			d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h6v2h-6z"
		/>
	{:else if name === 'eye-off'}<path
			d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 8.5 4 9.5 6a11.8 11.8 0 0 1-3.1 3.7M6.6 6.6C4.5 8 3.1 9.8 2.5 10.9c1 2 4.5 6 9.5 6 1 0 1.9-.2 2.7-.5"
		/>
	{:else if name === 'eye'}<path
			d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
		/><circle cx="12" cy="12" r="3" />
	{:else if name === 'home'}<path d="M3 11.5 12 4l9 7.5" /><path d="M5 10.5V20h5v-5h4v5h5v-9.5" />
	{:else if name === 'pause'}<path d="M8 5v14M16 5v14" />
	{:else if name === 'timer'}<circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 3h6M12 3v2" />
	{:else if name === 'help'}<circle cx="12" cy="12" r="9" /><path
			d="M9.7 9a2.4 2.4 0 1 1 4.1 1.7c-1 .8-1.8 1.2-1.8 2.8M12 17h.01"
		/>
	{/if}
</svg>
