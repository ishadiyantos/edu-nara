<script lang="ts">
	import { Container, Card, Button, Badge, Stepper, Toast } from '$components/ui';

	const question = 'Framework mana yang paling ringan untuk platform ini?';
	const options = [
		{ id: 'a', label: 'A. SvelteKit' },
		{ id: 'b', label: 'B. Next.js' },
		{ id: 'c', label: 'C. Astro' },
		{ id: 'd', label: 'D. Laravel' }
	];

	let selected = $state<string | null>(null);
	let submitted = $state(false);

	function pick(id: string) {
		if (submitted) return;
		selected = id;
	}
	function submit() {
		if (!selected) return;
		submitted = true;
	}
</script>

<svelte:head>
	<title>Question — Edu Nara</title>
</svelte:head>

<main class="min-h-dvh bg-bg pb-24 pt-6">
	<Container size="narrow">
		<div class="mb-4 flex items-center justify-between">
			<Badge tone="success" dot>Connected</Badge>
			<span class="font-mono text-xs text-muted">ABC7XK</span>
		</div>
		<div class="mb-4">
			<Stepper current={1} total={1} />
		</div>
		<Card>
			<h1 class="mb-6 text-xl font-bold leading-snug">{question}</h1>
			<div class="flex flex-col gap-3">
				{#each options as opt}
					<button
						type="button"
						onclick={() => pick(opt.id)}
						aria-pressed={selected === opt.id}
						class="rounded-xl border-2 px-5 py-4 text-left text-base font-semibold transition-all
							{selected === opt.id
							? 'border-primary bg-primary-soft text-primary shadow-lift'
							: 'border-border bg-surface hover:border-primary/50'}
							{submitted && selected !== opt.id ? 'opacity-40' : ''}"
						disabled={submitted && selected !== opt.id}
					>
						{opt.label}
					</button>
				{/each}
			</div>
			<div class="mt-6">
				<Button block size="lg" onclick={submit} disabled={!selected || submitted}>
					{submitted ? '✓ Terkirim' : 'Submit answer'}
				</Button>
			</div>
		</Card>
	</Container>
	{#if submitted}
		<Toast tone="success" message="Answer submitted — thank you!" />
	{/if}
</main>
