<script lang="ts">
	type Variant = 'primary' | 'ghost' | 'danger' | 'accent';
	type Size = 'sm' | 'md' | 'lg';

	type Props = {
		variant?: Variant;
		size?: Size;
		type?: 'button' | 'submit' | 'reset';
		href?: string;
		disabled?: boolean;
		loading?: boolean;
		block?: boolean;
		ariaLabel?: string;
		onclick?: (e: MouseEvent) => void;
		children: import('svelte').Snippet;
	};

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		href,
		disabled = false,
		loading = false,
		block = false,
		ariaLabel,
		onclick,
		children
	}: Props = $props();

	const base =
		'inline-flex items-center justify-center gap-2 rounded-xl font-semibold ' +
		'transition-[background-color,box-shadow,transform] duration-200 ' +
		'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ' +
		'disabled:cursor-not-allowed disabled:opacity-60 select-none';

	const variants: Record<Variant, string> = {
		primary: 'bg-primary text-white hover:shadow-lift active:scale-[0.98]',
		accent: 'bg-accent text-white hover:brightness-110 active:scale-[0.98]',
		ghost: 'bg-transparent text-text hover:bg-primary-soft border border-border',
		danger: 'bg-danger text-white hover:brightness-110 active:scale-[0.98]'
	};

	const sizes: Record<Size, string> = {
		sm: 'text-sm px-3 py-2',
		md: 'text-base px-4 py-2.5',
		lg: 'text-lg px-6 py-3'
	};

	let cls = $derived(
		[base, variants[variant], sizes[size], block ? 'w-full' : ''].filter(Boolean).join(' ')
	);
</script>

{#if href}
	<a
		{href}
		class={cls}
		aria-label={ariaLabel}
		aria-disabled={disabled ? 'true' : undefined}
		role="button"
	>
		{@render children()}
	</a>
{:else}
	<button
		{type}
		class={cls}
		disabled={disabled || loading}
		aria-label={ariaLabel}
		aria-busy={loading ? 'true' : undefined}
		{onclick}
	>
		{#if loading}
			<span
				class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
				aria-hidden="true"
			></span>
		{/if}
		{@render children()}
	</button>
{/if}
