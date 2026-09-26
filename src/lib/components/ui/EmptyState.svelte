<script lang="ts">
	type Props = {
		title: string;
		description?: string;
		icon?: 'inbox' | 'sparkles' | 'question';
		children?: import('svelte').Snippet;
	};
	let { title, description, icon = 'inbox', children }: Props = $props();
</script>

<div class="flex flex-col items-center gap-4 py-12 text-center">
	<div
		class="grid h-20 w-20 place-items-center rounded-full bg-primary-soft text-primary"
		aria-hidden="true"
	>
		{#if icon === 'inbox'}
			<svg width="36" height="36" viewBox="0 0 24 24" fill="none">
				<path
					d="M4 13l3-7h10l3 7M4 13v6a1 1 0 001 1h14a1 1 0 001-1v-6M4 13h4l1 2h6l1-2h4"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		{:else if icon === 'sparkles'}
			<svg width="36" height="36" viewBox="0 0 24 24" fill="none">
				<path
					d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				/>
			</svg>
		{:else}
			<svg width="36" height="36" viewBox="0 0 24 24" fill="none">
				<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
				<path
					d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5M12 17h.01"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				/>
			</svg>
		{/if}
	</div>
	<div class="max-w-md">
		<h3 class="text-lg font-bold text-text">{title}</h3>
		{#if description}
			<p class="mt-1 text-muted">{description}</p>
		{/if}
	</div>
	{#if children}
		<div class="mt-2">{@render children()}</div>
	{/if}
</div>
