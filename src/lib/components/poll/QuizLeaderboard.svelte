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
	const celebrationStars = Array.from({ length: 28 }, (_, index) => ({
		left: (index * 41) % 100,
		delay: ((index * 13) % 24) / 10,
		duration: 4.8 + ((index * 7) % 22) / 10,
		drift: ((index * 23) % 80) - 40,
		icon: ['✦', '✧', '★', '✹'][index % 4]
	}));
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
	class="leaderboard mt-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#050816] via-[#172554] to-[#581c87] p-5 text-white shadow-2xl sm:p-8"
	data-testid="quiz-leaderboard"
>
	<div class="leaderboard-glow" aria-hidden="true"></div>
	<div class="starfall" data-testid="leaderboard-starfall" aria-hidden="true">
		{#each celebrationStars as star}
			<span
				style={`--left:${star.left}%;--delay:${star.delay}s;--duration:${star.duration}s;--drift:${star.drift}px`}
				>{star.icon}</span
			>
		{/each}
	</div>
	<div class="text-center">
		<p class="text-xs font-black uppercase tracking-[0.25em] text-amber-300">Quiz final</p>
		<h2 class="mt-2 text-3xl font-black sm:text-5xl">Juara kelas</h2>
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
							class="podium-player flex min-w-0 flex-col items-center text-center"
							class:order-first={podiumIndex === 1}
							data-rank={entry.rank}
						>
							<span class="podium-medal text-3xl sm:text-6xl" aria-hidden="true"
								>{medals[podiumIndex]}</span
							>
							<p class="mt-2 w-full truncate text-sm font-black sm:text-lg">{entry.displayName}</p>
							<p class="text-xs font-bold text-amber-200 sm:text-sm">
								{entry.score.toLocaleString('id-ID')} poin
							</p>
							<div
								class="podium-block mt-3 grid w-full place-items-center rounded-t-2xl border border-white/10 bg-white/10 font-black backdrop-blur {podiumIndex ===
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
		margin-bottom: 5rem;
		max-height: none;
	}
	.quiz-leaderboard-scroll {
		position: relative;
		min-height: 0;
		width: 100%;
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		overscroll-behavior: contain;
		padding-bottom: 0.5rem;
	}
	.leaderboard {
		position: relative;
		isolation: isolate;
		border: 1px solid rgb(168 85 247 / 0.28);
		box-shadow:
			0 24px 90px rgb(2 6 23 / 0.55),
			inset 0 1px 0 rgb(255 255 255 / 0.12);
	}
	.leaderboard-glow {
		position: absolute;
		inset: -20% 15% auto;
		height: 20rem;
		z-index: -1;
		border-radius: 999px;
		background: radial-gradient(circle, rgb(168 85 247 / 0.25), transparent 68%);
		filter: blur(12px);
		animation: leaderboardGlow 3s ease-in-out infinite alternate;
	}
	.starfall {
		position: absolute;
		inset: 0;
		z-index: 1;
		overflow: hidden;
		pointer-events: none;
	}
	.leaderboard > :not(.leaderboard-glow):not(.starfall) {
		position: relative;
		z-index: 2;
	}
	.starfall span {
		position: absolute;
		left: var(--left);
		top: -2rem;
		color: #fde68a;
		font-size: clamp(1rem, 2vw, 1.65rem);
		text-shadow: 0 0 18px rgb(251 191 36 / 0.85);
		animation: starDrop var(--duration) linear infinite;
		animation-delay: var(--delay);
	}
	.podium-player[data-rank='1'] .podium-medal {
		filter: drop-shadow(0 0 18px rgb(251 191 36 / 0.85));
		animation: championFloat 1.6s ease-in-out infinite alternate;
	}
	.podium-player[data-rank='2'] .podium-block {
		background: linear-gradient(rgb(148 163 184 / 0.25), rgb(255 255 255 / 0.06));
	}
	.podium-player[data-rank='1'] .podium-block {
		border-color: rgb(251 191 36 / 0.55);
		background: linear-gradient(rgb(251 191 36 / 0.35), rgb(168 85 247 / 0.16));
		box-shadow: 0 0 28px rgb(251 191 36 / 0.2);
	}
	.podium-player[data-rank='3'] .podium-block {
		background: linear-gradient(rgb(180 83 9 / 0.3), rgb(255 255 255 / 0.06));
	}
	@keyframes leaderboardGlow {
		from {
			transform: scale(0.92);
			opacity: 0.6;
		}
		to {
			transform: scale(1.08);
			opacity: 1;
		}
	}
	@keyframes championFloat {
		to {
			transform: translateY(-6px) scale(1.06);
		}
	}
	@keyframes starDrop {
		from {
			opacity: 0;
			transform: translate3d(0, -2rem, 0) rotate(0deg) scale(0.75);
		}
		10% {
			opacity: 1;
		}
		to {
			opacity: 0;
			transform: translate3d(var(--drift), 110dvh, 0) rotate(260deg) scale(1.15);
		}
	}
	@media (max-width: 640px) {
		.leaderboard {
			margin-top: 1rem;
			border-radius: 1.35rem;
			padding: 1rem;
		}
		.quiz-leaderboard-scroll {
			max-height: 58dvh;
		}
		.leaderboard table {
			font-size: 0.78rem;
		}
		.leaderboard th,
		.leaderboard td {
			padding: 0.65rem 0.55rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.leaderboard-glow,
		.podium-player[data-rank='1'] .podium-medal,
		.starfall span {
			animation: none;
		}
		.starfall {
			display: none;
		}
	}
</style>
