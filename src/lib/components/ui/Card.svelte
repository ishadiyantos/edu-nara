<script lang="ts">
	type Props = {
		as?: 'div' | 'article' | 'section';
		padded?: boolean;
		hoverable?: boolean;
		class?: string;
		children: import('svelte').Snippet;
	};
	let {
		as = 'div',
		padded = true,
		hoverable = false,
		class: klass = '',
		children
	}: Props = $props();
	let cls = $derived(
		['surface', padded ? 'p-6' : '', hoverable ? 'transition-shadow hover:shadow-lift' : '', klass]
			.filter(Boolean)
			.join(' ')
	);
</script>

<svelte:element this={as} class={cls}>
	{@render children()}
</svelte:element>
