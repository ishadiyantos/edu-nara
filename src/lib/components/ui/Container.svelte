<script lang="ts">
	type Props = {
		size?: 'narrow' | 'app';
		class?: string;
		children: import('svelte').Snippet;
	};
	let { size = 'app', class: klass = '', children }: Props = $props();
	let cls = $derived([size === 'narrow' ? 'container-narrow' : 'container-app', klass].join(' '));
</script>

<div class={cls}>
	{@render children()}
</div>
