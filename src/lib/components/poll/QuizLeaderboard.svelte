<script lang="ts">
	import { onMount } from 'svelte';
	let {
		entries,
		presentation = false,
		autoScroll = false
	} = $props<{
		presentation?: boolean;
		autoScroll?: boolean;
		entries: {
			rank: number;
			participantId: string;
			displayName: string;
			score: number;
			answered: number;
		}[];
	}>();
	const medals = ['🥇', '🥈', '🥉'];
	const podiumOrder = [1, 0, 2];
	let sheet = $state<HTMLElement>();
	let paused = $state(false);

	onMount(() => {
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		paused = motion.matches;
		const preferenceChanged = () => {
			paused = motion.matches;
		};
		motion.addEventListener('change', preferenceChanged);
		let resumeAt = Date.now() + 1500;
		// ponytail: fixed 40px/s for classroom projection; add speed control only if needed.
		const timer = setInterval(() => {
			if (!sheet || paused || !autoScroll || document.hidden || Date.now() < resumeAt) return;
			const bottom = sheet.scrollHeight - sheet.clientHeight;
			if (bottom <= 0) return;
			if (sheet.scrollTop >= bottom - 1) {
				sheet.scrollTop = 0;
				resumeAt = Date.now() + 1500;
			} else {
				sheet.scrollTop += 2;
				if (sheet.scrollTop >= bottom - 1) resumeAt = Date.now() + 1500;
			}
		}, 50);
		return () => {
			clearInterval(timer);
			motion.removeEventListener('change', preferenceChanged);
		};
	});
</script>

<section
	class:presentation
	class="leaderboard mt-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#111827] via-[#172554] to-[#312e81] p-5 text-white shadow-2xl sm:p-8"
	data-testid="quiz-leaderboard"
>
	<div class="text-center">
		<p class="text-xs font-black uppercase tracking-[0.25em] text-amber-300">Quiz final</p>
		<h2 class="mt-2 text-3xl font-black sm:text-4xl">Juara kelas</h2>
		<p class="mt-2 text-sm text-white/60">Papan peringkat lengkap sesi ini</p>
	</div>
	{#if entries.length}
		<div
			class="quiz-leaderboard-scroll mx-auto mt-8 max-w-3xl"
			data-testid="quiz-leaderboard-scroll"
			bind:this={sheet}
			aria-label="Daftar peringkat peserta"
		>
			<div
				class="mx-auto grid max-w-3xl grid-cols-3 items-end gap-2 sm:gap-5"
				aria-label="Podium tiga peserta teratas"
			>
				{#each podiumOrder as podiumIndex}
					{@const entry = entries[podiumIndex]}
					{#if entry}
						<div
							class="flex min-w-0 flex-col items-center text-center"
							class:order-first={podiumIndex === 1}
						>
							<span class="text-3xl sm:text-5xl" aria-hidden="true">{medals[podiumIndex]}</span>
							<p class="mt-2 w-full truncate text-sm font-black sm:text-lg">{entry.displayName}</p>
							<p class="text-xs font-bold text-amber-200 sm:text-sm">
								{entry.score.toLocaleString('id-ID')} poin
							</p>
							<div
								class="mt-3 grid w-full place-items-center rounded-t-2xl border border-white/10 bg-white/10 font-black backdrop-blur {podiumIndex ===
								0
									? 'h-24 sm:h-32 text-3xl'
									: podiumIndex === 1
										? 'h-32 sm:h-40 text-4xl'
										: 'h-20 sm:h-28 text-2xl'}"
							>
								{entry.rank}
							</div>
						</div>
					{/if}
				{/each}
			</div>
			<div class="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-black/15">
				<table class="w-full min-w-[420px] text-left text-sm">
					<caption class="sr-only">Peringkat dan hasil seluruh peserta Quiz</caption><thead
						class="bg-white/10 text-xs uppercase tracking-wider text-white/60"
						><tr
							><th class="px-4 py-3">#</th><th class="px-4 py-3">Peserta</th><th
								class="px-4 py-3 text-right">Dijawab</th
							><th class="px-4 py-3 text-right">Skor</th></tr
						></thead
					><tbody
						>{#each entries as entry}<tr
								class="border-t border-white/10 {entry.rank <= 3 ? 'bg-white/[0.06]' : ''}"
								><td class="px-4 py-3 font-black text-amber-200"
									>{entry.rank <= 3 ? medals[entry.rank - 1] : entry.rank}</td
								><td class="px-4 py-3 font-bold">{entry.displayName}</td><td
									class="px-4 py-3 text-right text-white/70">{entry.answered}</td
								><td class="px-4 py-3 text-right font-black"
									>{entry.score.toLocaleString('id-ID')}</td
								></tr
							>{/each}</tbody
					>
				</table>
			</div>
		</div>
		{#if autoScroll}<button
				type="button"
				class="mx-auto mt-4 block min-h-11 shrink-0 rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white/80"
				aria-pressed={paused}
				onclick={() => (paused = !paused)}
			>
				{paused ? 'Lanjutkan gulir' : 'Jeda gulir'}
			</button>{/if}
	{:else}
		<p class="mt-8 rounded-2xl bg-white/10 p-6 text-center font-semibold text-white/70">
			Belum ada peserta yang mengikuti Quiz ini.
		</p>
	{/if}
</section>

<style>
	.leaderboard {
		display: flex;
		flex-direction: column;
		max-height: 70dvh;
		min-height: 0;
	}
	.leaderboard.presentation {
		flex: 1;
		margin-top: 0;
		max-height: none;
	}
	.quiz-leaderboard-scroll {
		min-height: 0;
		width: 100%;
		flex: 1;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-bottom: 0.5rem;
	}
</style>
