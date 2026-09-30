<script lang="ts">
	type Props = {
		current: number;
		total: number;
		label?: string;
	};
	let { current, total, label = 'Question' }: Props = $props();
	let pct = $derived(Math.min(100, Math.round((current / total) * 100)));
</script>

<div class="flex flex-col gap-1.5" role="group" aria-label="{label} progress">
	<div class="flex justify-between text-xs font-medium text-muted">
		<span>{label} {current} of {total}</span>
		<span>{pct}%</span>
	</div>
	<div
		class="h-2 w-full overflow-hidden rounded-full bg-slate-200"
		role="progressbar"
		aria-valuenow={current}
		aria-valuemin="0"
		aria-valuemax={total}
	>
		<div
			class="h-full rounded-full bg-primary transition-all duration-300"
			style="width: {pct}%"
		></div>
	</div>
</div>
