<script lang="ts">
	import { Container, Card, Button, Input, Badge } from '$components/ui';

	const question = 'Share 1–3 words that describe this class.';
	const maxWords = 3;
	let current = $state('');
	let words: string[] = $state([]);
	let error = $state('');

	function add(e?: SubmitEvent) {
		e?.preventDefault();
		const w = current.trim();
		if (!w) return;
		if (w.length > 30) {
			error = 'Word is too long (30 characters maximum).';
			return;
		}
		if (words.length >= maxWords) {
			error = `Limit: ${maxWords} words per person.`;
			return;
		}
		words = [...words, w];
		current = '';
		error = '';
	}
	function remove(i: number) {
		words = words.filter((_, idx) => idx !== i);
	}
</script>

<svelte:head>
	<title>Word Cloud — Edu Nara</title>
</svelte:head>

<main class="min-h-dvh bg-bg pb-24 pt-6">
	<Container size="narrow">
		<div class="mb-4 flex items-center justify-between">
			<Badge tone="success" dot>Connected</Badge>
			<span class="text-xs text-muted">{words.length}/{maxWords} kata</span>
		</div>
		<Card>
			<h1 class="mb-4 text-xl font-bold leading-snug">{question}</h1>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					add(e);
				}}
				class="flex items-end gap-2"
			>
				<div class="flex-1">
					<Input
						label="Word / short phrase"
						bind:value={current}
						placeholder="mis. seru"
						maxlength={30}
						{error}
					/>
				</div>
				<Button type="submit" size="lg" disabled={words.length >= maxWords || !current.trim()}
					>+</Button
				>
			</form>

			<div class="mt-6" aria-live="polite">
				<h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
					Your submissions
				</h2>
				{#if words.length === 0}
					<p class="text-sm text-muted">No words yet. Type a word, then press +.</p>
				{:else}
					<ul class="flex flex-wrap gap-2">
						{#each words as w, i}
							<li>
								<button
									type="button"
									onclick={() => remove(i)}
									class="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10"
								>
									{w}
									<span aria-label="Remove">✕</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</Card>
	</Container>
</main>
