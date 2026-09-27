<script lang="ts">
	type Props = {
		label: string;
		id?: string;
		name?: string;
		value?: string;
		type?: 'text' | 'email' | 'password' | 'search' | 'url';
		placeholder?: string;
		hint?: string;
		error?: string;
		required?: boolean;
		autocomplete?: import('svelte/elements').HTMLInputAttributes['autocomplete'];
		maxlength?: number;
		oninput?: (e: Event) => void;
		class?: string;
	};

	const generatedId = $props.id();
	let {
		label,
		id = generatedId,
		name,
		value = $bindable(''),
		type = 'text',
		placeholder,
		hint,
		error,
		required = false,
		autocomplete,
		maxlength,
		oninput,
		class: className = ''
	}: Props = $props();

	const describedBy = $derived(
		[error ? `${id}-error` : null, hint && !error ? `${id}-hint` : null].filter(Boolean).join(' ')
	);
</script>

<div class="flex flex-col gap-1.5">
	<label for={id} class="text-sm font-medium text-text">
		{label}
		{#if required}<span class="text-danger" aria-hidden="true">*</span>{/if}
	</label>
	<input
		{id}
		{name}
		{type}
		{placeholder}
		{autocomplete}
		{maxlength}
		{required}
		bind:value
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={describedBy || undefined}
		class="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base
		       placeholder:text-muted/60
		       focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none
		       aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20 {className}"
		{oninput}
	/>
	{#if hint && !error}
		<p id="{id}-hint" class="text-sm text-muted">{hint}</p>
	{/if}
	{#if error}
		<p id="{id}-error" class="text-sm font-medium text-danger" role="alert">{error}</p>
	{/if}
</div>
