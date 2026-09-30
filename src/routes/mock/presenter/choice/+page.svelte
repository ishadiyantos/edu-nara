<script lang="ts">
	import { Container, Badge, QRCode } from '$components/ui';

	const question = 'Framework mana yang paling ringan untuk platform ini?';
	const options = [
		{ id: 'a', label: 'SvelteKit', count: 62 },
		{ id: 'b', label: 'Next.js', count: 28 },
		{ id: 'c', label: 'Astro', count: 7 },
		{ id: 'd', label: 'Laravel', count: 3 }
	];
	const total = options.reduce((s, o) => s + o.count, 0);
</script>

<svelte:head>
	<title>Presenter — Quiz</title>
</svelte:head>

<main class="min-h-dvh bg-slate-950 p-8 text-white">
	<Container>
		<header class="mb-6 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<span class="text-xl font-black">Edu Nara</span>
				<span class="text-slate-400">·</span>
				<span class="font-mono text-lg">Ruang: A B 7 X K</span>
			</div>
			<Badge tone="success" dot>87 participants</Badge>
		</header>

		<h1 class="mb-8 text-4xl font-black leading-tight sm:text-5xl">{question}</h1>

		<div class="space-y-4">
			{#each options as opt}
				{@const pct = Math.round((opt.count / total) * 100)}
				<div>
					<div class="mb-1 flex items-baseline justify-between">
						<span class="text-2xl font-bold">{opt.label}</span>
						<span class="font-mono text-xl font-bold text-primary">{pct}%</span>
					</div>
					<div class="h-8 overflow-hidden rounded-lg bg-slate-800">
						<div
							class="h-full rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500 ease-out"
							style="width: {pct}%"
						></div>
					</div>
					<div class="mt-1 text-sm text-slate-400">{opt.count} suara</div>
				</div>
			{/each}
		</div>

		<div class="fixed bottom-8 right-8">
			<QRCode value="ABC7XK" size={160} label="QR code to join room ABC7XK" />
		</div>
	</Container>
</main>
