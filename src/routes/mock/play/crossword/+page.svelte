<script lang="ts">
	import { Container, Card, Button, Badge } from '$components/ui';

	// Grid 5x5 mock — 1=cell aktif, 0=blocked
	const grid = [
		[1, 1, 1, 1, 0],
		[0, 0, 1, 0, 0],
		[1, 1, 1, 1, 1],
		[1, 0, 1, 0, 1],
		[1, 1, 1, 0, 0]
	];
	const numbers: Record<string, number> = { '0,0': 1, '2,0': 2, '0,2': 3, '3,4': 4 };
	const clues = {
		across: [
			{ n: 1, clue: 'Framework compiler oleh Rich Harris' },
			{ n: 2, clue: 'Basis data lokal populer' }
		],
		down: [
			{ n: 3, clue: 'Bahasa dengan tipe statis' },
			{ n: 4, clue: 'Protokol web utama' }
		]
	};

	let filled: Record<string, string> = $state({});
	let active = $state<[number, number] | null>(null);

	function key(r: number, c: number) {
		return `${r},${c}`;
	}
	function setCell(r: number, c: number, v: string) {
		filled[key(r, c)] = v.toUpperCase().slice(0, 1);
	}
</script>

<svelte:head>
	<title>Crossword — Edu Nara</title>
</svelte:head>

<main class="min-h-dvh bg-bg pb-24 pt-6">
	<Container size="narrow">
		<div class="mb-4 flex items-center justify-between">
			<Badge tone="success" dot>Connected</Badge>
			<span class="text-xs text-muted">Waktu: 02:14</span>
		</div>
		<Card>
			<h1 class="mb-4 text-xl font-bold">Crossword: Web Dev</h1>
			<div
				role="grid"
				aria-label="Crossword grid"
				class="mx-auto grid w-fit gap-0.5"
				style="grid-template-columns: repeat({grid[0].length}, 44px);"
			>
				{#each grid as row, r}
					{#each row as cell, c}
						{#if cell === 1}
							<div class="relative" role="gridcell">
								{#if numbers[key(r, c)]}
									<span class="absolute left-0.5 top-0 text-[10px] font-bold text-muted">
										{numbers[key(r, c)]}
									</span>
								{/if}
								<input
									type="text"
									inputmode="text"
									maxlength="1"
									aria-label="row {r + 1} column {c + 1}"
									value={filled[key(r, c)] ?? ''}
									oninput={(e) => setCell(r, c, (e.target as HTMLInputElement).value)}
									onfocus={() => (active = [r, c])}
									class="h-11 w-11 border-2 text-center font-mono text-lg font-bold uppercase
										{active?.[0] === r && active?.[1] === c
										? 'border-primary bg-primary-soft'
										: 'border-border bg-surface'}
										focus:border-primary focus:outline-none"
								/>
							</div>
						{:else}
							<div class="h-11 w-11 bg-slate-900" role="gridcell" aria-hidden="true"></div>
						{/if}
					{/each}
				{/each}
			</div>

			<div class="mt-6 grid gap-6 sm:grid-cols-2">
				<div>
					<h2 class="mb-2 text-sm font-bold uppercase tracking-wider text-muted">Mendatar</h2>
					<ol class="space-y-1 text-sm">
						{#each clues.across as { n, clue }}
							<li><span class="font-bold">{n}.</span> {clue}</li>
						{/each}
					</ol>
				</div>
				<div>
					<h2 class="mb-2 text-sm font-bold uppercase tracking-wider text-muted">Menurun</h2>
					<ol class="space-y-1 text-sm">
						{#each clues.down as { n, clue }}
							<li><span class="font-bold">{n}.</span> {clue}</li>
						{/each}
					</ol>
				</div>
			</div>

			<div class="mt-6 flex gap-2">
				<Button size="md">Check answers</Button>
				<Button size="md" variant="ghost">Letter hint</Button>
			</div>
		</Card>
	</Container>
</main>
