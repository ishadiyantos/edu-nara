<script lang="ts">
	import { onMount, untrack } from 'svelte';
	type Entry = {
		id: string;
		clue: string;
		row: number;
		col: number;
		direction: 'across' | 'down';
		number: number;
		length: number;
	};
	type Puzzle = {
		gridShape: number[][];
		numbers: number[][];
		entries: Entry[];
		progress: { cells: Record<string, string> };
	};
	let {
		sessionCode,
		puzzle,
		readonly = false
	}: { sessionCode: string; puzzle: Puzzle; readonly?: boolean } = $props();
	let cells = $state<Record<string, string>>(untrack(() => ({ ...puzzle.progress.cells })));
	let message = $state('');
	let saving = $state(false);
	let checking = $state(false);
	let result = $state<{
		correctCells: Record<string, boolean>;
		complete: boolean;
		score: number;
		filledCount: number;
		totalCells: number;
	} | null>(null);
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	const key = (row: number, col: number) => `${row},${col}`;
	const cellKeys = $derived(
		puzzle.gridShape
			.flatMap((row, r) => row.map((open, c) => (open ? key(r, c) : null)))
			.filter((v): v is string => v !== null)
	);
	function scheduleSave() {
		if (readonly) return;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(save, 700);
	}
	async function save() {
		if (readonly) return;
		saving = true;
		try {
			const response = await fetch(`/api/crosswords/${encodeURIComponent(sessionCode)}/progress`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ cells })
			});
			if (!response.ok) throw new Error('Progress could not be saved.');
			message = 'Progress saved.';
		} catch (error) {
			message = error instanceof Error ? error.message : 'Progress could not be saved.';
		} finally {
			saving = false;
		}
	}
	async function check() {
		if (readonly) return;
		checking = true;
		message = '';
		try {
			const response = await fetch(`/api/crosswords/${encodeURIComponent(sessionCode)}/check`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ cells })
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.message ?? 'Check failed.');
			result = data;
			message = data.complete
				? 'Puzzle complete!'
				: `${data.score}/${data.totalCells} cells correct.`;
		} catch (error) {
			message = error instanceof Error ? error.message : 'Check failed.';
		} finally {
			checking = false;
		}
	}
	function editCell(cell: string, value: string) {
		if (readonly) return;
		cells = {
			...cells,
			[cell]: value
				.toUpperCase()
				.replace(/[^A-Z0-9]/g, '')
				.slice(-1)
		};
		result = null;
		scheduleSave();
	}
	function focusNext(event: KeyboardEvent, row: number, col: number) {
		if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
		event.preventDefault();
		const delta =
			event.key === 'ArrowRight'
				? [0, 1]
				: event.key === 'ArrowLeft'
					? [0, -1]
					: event.key === 'ArrowDown'
						? [1, 0]
						: [-1, 0];
		const target = document.querySelector<HTMLInputElement>(
			`[data-cell="${key(row + delta[0], col + delta[1])}"]`
		);
		target?.focus();
	}
	onMount(() => () => clearTimeout(saveTimer));
</script>

<section class="crossword-player" data-testid="crossword-player">
	<header>
		<div>
			<p class="eyebrow">Crossword · {cellKeys.length} cells</p>
			<h1>Fill the grid</h1>
			<p class="status" role="status">{saving ? 'Saving…' : message}</p>
		</div>
		<button class="check" type="button" onclick={check} disabled={checking}
			>{checking ? 'Checking…' : 'Check puzzle'}</button
		>
	</header>
	<div class="layout">
		<div class="grid-wrap">
			<table aria-label="Crossword grid">
				<tbody
					>{#each puzzle.gridShape as row, r}<tr
							>{#each row as open, c}<td class:blocked={!open}
									>{#if open}<span class="number">{puzzle.numbers[r][c] || ''}</span><input
											data-cell={key(r, c)}
											aria-label={`Row ${r + 1}, column ${c + 1}`}
											maxlength="1"
											value={cells[key(r, c)] ?? ''}
											class:wrong={result && result.correctCells[key(r, c)] === false}
											class:correct={result?.correctCells[key(r, c)]}
											oninput={(event) => editCell(key(r, c), event.currentTarget.value)}
											onkeydown={(event) => focusNext(event, r, c)}
										/>{/if}</td
								>{/each}</tr
						>{/each}</tbody
				>
			</table>
		</div>
		<aside>
			<h2>Clues</h2>
			<h3>Across</h3>
			<ol>
				{#each puzzle.entries.filter((e) => e.direction === 'across') as entry}<li>
						<b>{entry.number}.</b>
						{entry.clue}
					</li>{/each}
			</ol>
			<h3>Down</h3>
			<ol>
				{#each puzzle.entries.filter((e) => e.direction === 'down') as entry}<li>
						<b>{entry.number}.</b>
						{entry.clue}
					</li>{/each}
			</ol>
		</aside>
	</div>
</section>

<style>
	.crossword-player {
		color: #f8fafc;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}
	.eyebrow {
		color: #fde68a;
		font-size: 0.75rem;
		font-weight: 900;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0.35rem 0;
		font-size: clamp(1.7rem, 4vw, 3rem);
		font-weight: 950;
	}
	.status {
		min-height: 1.5rem;
		color: #a5f3fc;
		font-size: 0.9rem;
		font-weight: 700;
	}
	.check {
		min-height: 44px;
		border: 0;
		border-radius: 0.8rem;
		background: #fde68a;
		color: #172554;
		padding: 0.7rem 1rem;
		font-weight: 900;
	}
	.layout {
		display: grid;
		gap: 1.5rem;
		align-items: start;
		grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem);
	}
	.grid-wrap {
		overflow: auto;
		border-radius: 1rem;
		background: #0f2743;
		padding: clamp(0.5rem, 2vw, 1.25rem);
	}
	table {
		border-collapse: collapse;
		margin: auto;
	}
	td {
		position: relative;
		width: clamp(2.2rem, 8vw, 3.4rem);
		height: clamp(2.2rem, 8vw, 3.4rem);
		border: 1px solid #64748b;
		background: #fff7ed;
	}
	td.blocked {
		border-color: #0f2743;
		background: #0f2743;
	}
	.number {
		position: absolute;
		top: 0.12rem;
		left: 0.2rem;
		color: #334155;
		font-size: 0.55rem;
		font-weight: 800;
	}
	input {
		width: 100%;
		height: 100%;
		border: 0;
		background: transparent;
		color: #172554;
		text-align: center;
		font-size: clamp(1rem, 4vw, 1.6rem);
		font-weight: 950;
		text-transform: uppercase;
		outline: 0;
	}
	input:focus {
		box-shadow: inset 0 0 0 3px #06b6d4;
	}
	input.correct {
		background: #bbf7d0;
	}
	input.wrong {
		background: #fecaca;
	}
	aside {
		border: 1px solid #ffffff22;
		border-radius: 1rem;
		background: #0f2743;
		padding: 1rem;
	}
	aside h2 {
		font-size: 1.4rem;
		font-weight: 900;
	}
	aside h3 {
		margin-top: 1rem;
		color: #fde68a;
		font-weight: 900;
	}
	ol {
		display: grid;
		gap: 0.55rem;
		padding-left: 1.4rem;
	}
	li {
		color: #dbeafe;
		line-height: 1.4;
	}
	@media (max-width: 800px) {
		.layout {
			grid-template-columns: 1fr;
		}
		aside {
			order: -1;
		}
	}
</style>
