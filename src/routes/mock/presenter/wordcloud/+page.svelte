<script lang="ts">
	import { Container, Badge, QRCode } from '$components/ui';

	// Kata (fallback flex layout dengan bobot font-size)
	const words = [
		{ w: 'interaktif', c: 42 },
		{ w: 'seru', c: 38 },
		{ w: 'ringan', c: 31 },
		{ w: 'kolaboratif', c: 24 },
		{ w: 'mobile', c: 22 },
		{ w: 'cepat', c: 18 },
		{ w: 'students', c: 15 },
		{ w: 'realtime', c: 13 },
		{ w: 'produktif', c: 10 },
		{ w: 'menarik', c: 8 },
		{ w: 'praktis', c: 6 },
		{ w: 'terbuka', c: 5 },
		{ w: 'modular', c: 4 },
		{ w: 'aman', c: 3 }
	];
	const max = Math.max(...words.map((x) => x.c));
	const min = Math.min(...words.map((x) => x.c));
	function fontFor(c: number): string {
		const norm = (c - min) / (max - min || 1); // 0..1
		const size = 24 + norm * 72; // 24..96 px
		return `font-size: ${size.toFixed(1)}px;`;
	}
	const palette = [
		'text-indigo-400',
		'text-teal-400',
		'text-amber-400',
		'text-rose-400',
		'text-sky-400',
		'text-emerald-400'
	];
</script>

<svelte:head>
	<title>Presenter — Word Cloud</title>
</svelte:head>

<main class="min-h-dvh bg-slate-950 p-8 text-white">
	<Container>
		<header class="mb-6 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<span class="text-xl font-black">Edu Nara</span>
				<span class="text-slate-400">·</span>
				<span class="font-mono text-lg">Room: A B 7 X K</span>
			</div>
			<Badge tone="success" dot>102 participants</Badge>
		</header>

		<h1 class="mb-8 text-3xl font-black leading-tight">
			Share 1–3 words that describe this class.
		</h1>

		<div class="min-h-[400px] rounded-3xl bg-slate-900 p-8" role="list" aria-label="Word cloud">
			<div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
				{#each words as w, i}
					<span
						role="listitem"
						class="font-black leading-none {palette[i % palette.length]}"
						style={fontFor(w.c)}
						title={`${w.w}: ${w.c} kali`}
					>
						{w.w}
					</span>
				{/each}
			</div>
		</div>

		<!-- Alternatif untuk screen reader / accessibility -->
		<details class="mt-4 rounded-lg bg-slate-900 p-4 text-sm">
			<summary class="cursor-pointer font-semibold">Word list (for screen readers)</summary>
			<ol class="mt-2 space-y-1">
				{#each words as w}
					<li><span class="font-mono">{w.c}×</span> {w.w}</li>
				{/each}
			</ol>
		</details>

		<div class="fixed bottom-8 right-8">
			<QRCode value="ABC7XK" size={160} label="QR code to join room ABC7XK" />
		</div>
	</Container>
</main>
