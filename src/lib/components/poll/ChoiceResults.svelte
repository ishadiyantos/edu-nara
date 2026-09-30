<script lang="ts">
	import { onMount } from 'svelte';
	let { sessionId, sessionCode, initialTally, options } = $props<{
		sessionId: string;
		sessionCode: string;
		initialTally: Record<string, number>;
		options: { id: string; label: string }[];
	}>();
	let tally = $state<Record<string, number>>({});
	let connected = $state(false);
	const total = $derived(Object.values(tally).reduce((sum: number, n: number) => sum + n, 0));
	onMount(() => {
		tally = { ...initialTally };
		const source = new EventSource(`/api/sessions/${encodeURIComponent(sessionId)}/events`);
		const handle = (event: MessageEvent) => {
			try {
				const parsed = JSON.parse(event.data);
				if (parsed.tally) tally = parsed.tally;
				else if (parsed.counts) tally = parsed.counts;
				else
					void fetch(`/api/polls/${encodeURIComponent(sessionCode)}/results`)
						.then((r) => (r.ok ? r.json() : null))
						.then((r) => {
							if (r?.counts) tally = r.counts;
						});
				connected = true;
			} catch {
				/* Ignore malformed event; EventSource reconnects. */
			}
		};
		source.addEventListener('snapshot', handle);
		source.addEventListener('resync', handle);
		source.addEventListener('poll.tally', handle);
		source.onopen = () => (connected = true);
		source.onerror = () => (connected = false);
		return () => source.close();
	});
</script>

<div class="mt-4" aria-live="polite" data-testid="choice-results-live">
	<p class="mb-3 text-sm text-muted">{total} answers · {connected ? 'Live' : 'Connecting…'}</p>
	{#each options as option, i}
		{@const value = tally[option.id] ?? 0}
		{@const width = total ? (value / total) * 100 : 0}
		<div class="mt-3">
			<div class="flex justify-between text-sm">
				<span>{String.fromCharCode(65 + i)}. {option.label}</span><strong>{value}</strong>
			</div>
			<div class="mt-1 h-3 overflow-hidden rounded-full bg-border">
				<div
					class="h-full rounded-full bg-choice transition-all duration-300"
					style={`width:${width}%`}
				></div>
			</div>
		</div>
	{/each}
</div>
