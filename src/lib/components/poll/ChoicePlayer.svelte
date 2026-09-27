<script lang="ts">
	import { Button } from '$components/ui';
	import { onMount } from 'svelte';

	type Question = {
		id: string;
		prompt: string;
		options: { id: string; label: string }[];
		showResults: boolean;
		position: number;
		timeLimit: number;
	};

	type Response = {
		questionId: string;
		optionIds: string[];
		isCorrect?: boolean | null;
		points?: number;
		correctOptionIds?: string[];
	};

	let {
		sessionCode,
		sessionId,
		questions,
		responses = [],
		initialScore = 0
	}: {
		sessionCode: string;
		sessionId: string;
		questions: Question[];
		responses?: Response[];
		initialScore?: number;
	} = $props();

	const answerIndex = (items: Question[], saved: Response[]) => {
		const done = new Set(saved.map((response) => response.questionId));
		const index = items.findIndex((question) => !done.has(question.id));
		return index === -1 ? Math.max(0, items.length - 1) : index;
	};
	const answered = $derived(
		new Map(responses.map((response) => [response.questionId, response.optionIds]))
	);
	let current = $state(0);

	// Draft key for unsubmitted selections
	const draftKey = (questionId: string) => `edu_mc_${sessionCode}_${questionId}`;
	let selected = $state<string[]>([]);
	let correctOptionIds = $state<string[]>([]);
	let submitted = $state(false);
	let savedSubmission = $state(false);
	let feedbackAvailable = $state(false);
	let loading = $state(false);
	let error = $state('');
	let isCorrect = $state<boolean | null>(null);
	let points = $state(0);
	let score = $state(0);
	let displayedScore = $derived(score);
	let finished = $state(false);
	let tally = $state<Record<string, number> | null>(null);

	// Gamification states
	let showFloatingPoints = $state(false);
	let shakeButtonId = $state<string | null>(null);
	let timerSeconds = $state(20);
	let timerMax = $state(20);
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let streak = $state(0);

	const optionStyles = [
		{
			gradient: 'from-[#ff416c] to-[#ff4b2b]',
			shadow: 'shadow-[0_6px_0_#b31b37]',
			border: 'border-[#ff416c]',
			badgeBg: 'bg-[#b31b37]/40',
			icon: '▲',
			letter: 'A'
		},
		{
			gradient: 'from-[#00b4db] to-[#0083b0]',
			shadow: 'shadow-[0_6px_0_#005675]',
			border: 'border-[#00b4db]',
			badgeBg: 'bg-[#005675]/40',
			icon: '◆',
			letter: 'B'
		},
		{
			gradient: 'from-[#f7971e] to-[#ffd200]',
			shadow: 'shadow-[0_6px_0_#b36b00]',
			border: 'border-[#f7971e]',
			badgeBg: 'bg-[#b36b00]/40',
			icon: '●',
			letter: 'C'
		},
		{
			gradient: 'from-[#8e2de2] to-[#4a00e0]',
			shadow: 'shadow-[0_6px_0_#310099]',
			border: 'border-[#8e2de2]',
			badgeBg: 'bg-[#310099]/40',
			icon: '■',
			letter: 'D'
		}
	];

	const question = $derived(questions[current]);
	const progress = $derived(((current + (submitted ? 1 : 0)) / questions.length) * 100);
	const timerColor = $derived(
		timerSeconds > 10 ? '#10b981' : timerSeconds > 5 ? '#f59e0b' : '#ef4444'
	);

	function startTimer() {
		stopTimer();
		timerMax = question?.timeLimit ?? 20;
		timerSeconds = timerMax;
		timerInterval = setInterval(() => {
			if (timerSeconds > 0) {
				timerSeconds -= 1;
				if (timerSeconds === 0) onTimeUp();
			} else {
				stopTimer();
			}
		}, 1000);
	}

	function onTimeUp() {
		stopTimer();
		if (submitted || loading) return;
		if (selected.length > 0) {
			void submit();
		} else {
			submitted = true;
			isCorrect = null;
			points = 0;
			error = '';
		}
	}

	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	function applyReleasedResult(result: {
		counts?: Record<string, number>;
		correctOptionIds?: string[];
	}) {
		const wasFeedbackAvailable = feedbackAvailable;
		tally = result.counts ?? null;
		correctOptionIds = result.correctOptionIds ?? [];
		if (!submitted || !question) return;
		const correct = [...correctOptionIds].sort();
		const chosen = [...selected].sort();
		isCorrect =
			correct.length === chosen.length && correct.every((id, index) => id === chosen[index]);
		points = isCorrect ? 1000 : 0;
		feedbackAvailable = true;
		if (!wasFeedbackAvailable) score += points;
	}

	onMount(() => {
		const initialIndex = answerIndex(questions, responses);
		current = initialIndex;
		const initialQuestion = questions[initialIndex];
		score = initialScore;
		try {
			const draft = sessionStorage.getItem(draftKey(initialQuestion?.id ?? ''));
			if (draft) selected = JSON.parse(draft);
		} catch {
			/* sessionStorage may be unavailable in private browsing. */
		}
		const saved = answered.get(initialQuestion?.id);
		const savedResponse = responses.find((response) => response.questionId === initialQuestion?.id);
		if (saved) {
			selected = [...saved];
			submitted = true;
			savedSubmission = true;
			feedbackAvailable = savedResponse?.isCorrect != null;
			isCorrect = feedbackAvailable ? !!savedResponse?.isCorrect : null;
			points = feedbackAvailable ? (savedResponse?.points ?? 0) : 0;
			correctOptionIds = feedbackAvailable ? (savedResponse?.correctOptionIds ?? []) : [];
		}
		if (!submitted) startTimer();
		const source = new EventSource(`/api/sessions/${encodeURIComponent(sessionId)}/events`);
		const refresh = async () => {
			if (!question) return;
			try {
				const response = await fetch(
					`/api/polls/${encodeURIComponent(sessionCode)}/results?questionId=${encodeURIComponent(question.id)}`
				);
				if (response.ok) applyReleasedResult(await response.json());
				else if (response.status === 403) tally = null;
			} catch {
				/* reconnect keeps the game state intact */
			}
		};
		source.addEventListener('session.state', refresh);
		source.addEventListener('poll.tally', refresh);
		return () => {
			stopTimer();
			source.close();
		};
	});

	function optionState(optionId: string) {
		if (!submitted || isCorrect === null) return selected.includes(optionId) ? 'selected' : '';
		if (correctOptionIds.includes(optionId)) return 'correct';
		if (selected.includes(optionId)) return 'wrong';
		return '';
	}

	function toggleOption(optionId: string) {
		if (submitted || loading) return;
		selected = selected.includes(optionId)
			? selected.filter((id) => id !== optionId)
			: [...selected, optionId];
		try {
			sessionStorage.setItem(draftKey(question?.id ?? ''), JSON.stringify(selected));
		} catch {
			/* Ignore draft cleanup failure. */
		}
	}

	async function submit() {
		if (!question || selected.length === 0 || loading || submitted) return;
		loading = true;
		error = '';
		stopTimer();
		try {
			const response = await fetch(`/api/polls/${encodeURIComponent(sessionCode)}/responses`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ questionId: question.id, optionIds: selected })
			});
			const result = await response.json();
			if (!response.ok || !result.ok) throw new Error(result.message ?? 'Answer failed to send.');
			submitted = true;
			savedSubmission = true;
			feedbackAvailable = result.showResults === true;
			correctOptionIds = result.correctOptionIds ?? [];
			isCorrect = feedbackAvailable ? !!result.isCorrect : null;
			points = feedbackAvailable ? (result.points ?? 0) : 0;
			score += feedbackAvailable ? (result.points ?? 0) : 0;
			if (feedbackAvailable && result.isCorrect) {
				streak += 1;
				showFloatingPoints = true;
			} else {
				streak = 0;
				shakeButtonId = selected[0] ?? null;
				setTimeout(() => {
					shakeButtonId = null;
				}, 600);
			}
			if (result.showResults) tally = result.tally;
			try {
				sessionStorage.removeItem(draftKey(question.id));
			} catch {
				/* Ignore storage cleanup failure. */
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Answer failed to send.';
		} finally {
			loading = false;
		}
	}

	function next() {
		if (current >= questions.length - 1) {
			finished = true;
			stopTimer();
			return;
		}
		current += 1;
		selected = [];
		submitted = false;
		savedSubmission = false;
		feedbackAvailable = false;
		isCorrect = null;
		points = 0;
		error = '';
		showFloatingPoints = false;
		startTimer();
	}
</script>

<svelte:head><title>Live Quiz — Edu Nara</title></svelte:head>

{#if finished}
	<section
		class="game-shell grid min-h-[70dvh] place-items-center overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1e1b4b] via-[#0f172a] to-[#020617] p-6 text-white shadow-[0_25px_50px_rgba(0,0,0,0.6)] sm:p-10 border border-white/10 animate-pop-in"
		data-testid="quiz-finished"
	>
		<div class="max-w-md text-center">
			<div
				class="mx-auto grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-5xl shadow-[0_10px_0_#b8751a] animate-bounce"
			>
				🏆
			</div>
			<p class="mt-8 text-xs font-black uppercase tracking-[0.25em] text-amber-300">
				Round Complete! <span class="sr-only">Ronde selesai</span>
			</p>
			<h2 class="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
				Awesome, you finished! <span class="sr-only">Keren, kamu selesai!</span>
			</h2>
			<p class="mt-4 text-white/70 font-medium">
				Your answers are saved in the class session. <span class="sr-only"
					>Jawabanmu sudah tersimpan di sesi kelas.</span
				>
			</p>
			<div
				class="mt-8 rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-md shadow-inner"
			>
				<p class="text-xs font-black uppercase tracking-widest text-white/60">
					Your Total Score <span class="sr-only">Skor kamu</span>
				</p>
				<p class="mt-2 text-5xl font-black text-amber-300 drop-shadow-sm">
					{score.toLocaleString('id-ID')}
				</p>
			</div>
		</div>
	</section>
{:else if question}
	<section
		class="game-shell relative overflow-hidden rounded-[2.5rem] bg-[#111827] text-white shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-white/10 animate-pop-in"
		data-testid="choice-player"
	>
		<!-- Confetti explosion on correct answer -->
		{#if submitted && isCorrect}
			<div class="pointer-events-none absolute inset-0 z-50 overflow-hidden" aria-hidden="true">
				{#each [...Array(24).keys()] as idx}
					<div
						class="confetti-piece"
						style={`--delay:${(idx * 0.03).toFixed(2)}s; --x:${((idx % 8) * 14 - 45).toFixed(0)}vw; --y:${(50 + (idx % 5) * 10).toFixed(0)}vh; --rot:${idx * 45}deg; --bg:${['#ff416c', '#00b4db', '#f7971e', '#8e2de2', '#10b981', '#ffd200'][idx % 6]}`}
					></div>
				{/each}
			</div>
		{/if}

		<header
			class="relative overflow-hidden px-5 pb-5 pt-5 sm:px-8 sm:pt-7 bg-gradient-to-b from-[#1f2937] to-[#111827]"
		>
			<div
				class="absolute -right-12 -top-20 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl"
				aria-hidden="true"
			></div>
			<div class="relative flex items-center justify-between gap-4">
				<div>
					<div class="flex items-center gap-2">
						<p class="text-xs font-black uppercase tracking-[0.22em] text-[#38bdf8]">
							Edu Nara · LIVE QUIZ
						</p>
						{#if streak > 1}
							<span
								class="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-2.5 py-0.5 text-[10px] font-black text-white shadow-sm animate-pulse"
							>
								🔥 {streak} Streak
							</span>
						{/if}
					</div>
					<p class="mt-1 text-xs font-bold text-white/60">Fast answers, learn together!</p>
				</div>
				<div
					class="relative rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-right backdrop-blur-md shadow-inner"
				>
					<p class="text-[10px] font-black uppercase tracking-widest text-white/60">
						SCORE <span class="sr-only">Skor</span>
					</p>
					<p class="text-xl font-black text-amber-300" data-testid="quiz-score">
						{displayedScore.toLocaleString('id-ID')}
					</p>
					{#if showFloatingPoints}
						<span
							class="pointer-events-none absolute -top-5 right-2 font-black text-emerald-400 text-sm animate-float-points"
						>
							+{points} pts
						</span>
					{/if}
				</div>
			</div>
			<div class="relative mt-6 flex items-center justify-between text-xs font-bold text-white/70">
				<span
					>Round {current + 1} of {questions.length}
					<span class="sr-only">Ronde {current + 1} dari {questions.length}</span></span
				>
				<span>{Math.round(progress)}%</span>
			</div>
			<div class="relative mt-2 h-3.5 overflow-hidden rounded-full bg-white/10 p-0.5 shadow-inner">
				<div
					class="h-full rounded-full transition-all duration-500 shimmer-bar shadow-[0_0_12px_rgba(245,158,11,0.6)]"
					style={`width:${progress}%`}
				></div>
			</div>
		</header>

		<main class="bg-[#0b1120] px-4 pb-6 pt-5 text-white sm:px-8 sm:pb-8 sm:pt-6">
			<div
				class="relative overflow-hidden rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8 text-slate-900 border border-slate-100"
			>
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="relative text-xs font-black uppercase tracking-[0.2em] text-indigo-600">
							QUESTION {current + 1} <span class="sr-only">Pertanyaan {current + 1}</span>
						</p>
						<h2
							class="relative mt-2 text-2xl font-black leading-tight tracking-tight sm:text-3xl text-slate-900"
						>
							{question.prompt}
						</h2>
					</div>
					<!-- Animated circular timer -->
					<div class="relative flex shrink-0 items-center justify-center">
						<svg class="h-12 w-12 -rotate-90 transform" viewBox="0 0 44 44">
							<circle
								cx="22"
								cy="22"
								r="18"
								fill="none"
								stroke="currentColor"
								stroke-width="4"
								class="text-slate-100"
							/>
							<circle
								cx="22"
								cy="22"
								r="18"
								fill="none"
								stroke={timerColor}
								stroke-width="4"
								stroke-dasharray={113.1}
								stroke-dashoffset={113.1 * (1 - timerSeconds / timerMax)}
								stroke-linecap="round"
								class="transition-all duration-1000 ease-linear"
							/>
						</svg>
						<span
							class="absolute text-xs font-black {timerSeconds <= 5
								? 'text-red-500 animate-ping'
								: 'text-slate-700'}"
						>
							{timerSeconds}s
						</span>
					</div>
				</div>
			</div>

			<div
				class="mt-5 grid gap-3.5 sm:grid-cols-2"
				role="group"
				aria-label="Pilihan jawaban; pilih semua jawaban yang benar"
			>
				{#each question.options as option, i}
					{@const style = optionStyles[i % optionStyles.length]}
					<button
						type="button"
						disabled={submitted || loading}
						aria-pressed={selected.includes(option.id)}
						class="option-tile group relative flex min-h-[5rem] items-center gap-4 rounded-2xl px-4 py-3.5 text-left text-white transition-all duration-150 bg-gradient-to-r {style.gradient} {style.shadow} hover:-translate-y-1 hover:brightness-105 active:translate-y-1 active:scale-[0.98] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:brightness-100 {shakeButtonId ===
						option.id
							? 'animate-shake'
							: ''} {optionState(option.id) === 'selected'
							? 'ring-4 ring-white ring-offset-2 ring-offset-[#0b1120] scale-[1.01]'
							: ''} {optionState(option.id) === 'correct'
							? 'ring-4 ring-emerald-400'
							: ''} {optionState(option.id) === 'wrong' ? 'ring-4 ring-rose-400 opacity-80' : ''}"
						onclick={() => toggleOption(option.id)}
					>
						<span
							class="grid h-11 w-11 shrink-0 place-items-center rounded-xl {style.badgeBg} text-lg font-black backdrop-blur-sm shadow-inner group-hover:scale-105 transition-transform"
						>
							{style.letter}
						</span>
						<span class="text-base font-black leading-snug sm:text-lg flex-1 drop-shadow-sm"
							>{option.label}</span
						>
						<span class="text-xs opacity-60 font-black pr-1" aria-hidden="true">{style.icon}</span>
					</button>
				{/each}
			</div>

			{#if error}
				<p
					class="mt-4 rounded-2xl bg-rose-500/20 border border-rose-500/40 px-4 py-3 text-sm font-bold text-rose-300"
					role="alert"
				>
					{error}
				</p>
			{/if}

			{#if submitted}
				<div
					class="mt-6 flex flex-col gap-4 rounded-2xl border-2 p-5 sm:flex-row sm:items-center sm:justify-between shadow-xl backdrop-blur-md {isCorrect
						? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100'
						: 'border-rose-500/50 bg-rose-950/40 text-rose-100'}"
					role="status"
				>
					<div class="flex items-center gap-3">
						<div
							class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl font-black text-white shadow-md {isCorrect ===
							null
								? 'bg-slate-500 shadow-slate-700/50'
								: isCorrect
									? 'bg-emerald-500 shadow-emerald-700/50 animate-bounce'
									: 'bg-rose-500 shadow-rose-700/50'}"
						>
							{isCorrect === null ? '⏱' : isCorrect ? '✓' : '✗'}
						</div>
						<div>
							<p
								class="text-lg font-black {isCorrect === null
									? 'text-slate-300'
									: isCorrect
										? 'text-emerald-300'
										: 'text-rose-300'}"
							>
								{!feedbackAvailable
									? savedSubmission
										? 'Jawaban tersimpan!'
										: 'Waktu habis!'
									: isCorrect
										? 'Correct! Awesome job!'
										: 'Nice try! Keep going!'}
								<span class="sr-only"
									>{isCorrect === null ? 'Waktu habis' : isCorrect ? 'Benar' : 'Salah'}</span
								>
							</p>
							<p class="mt-0.5 text-sm font-semibold text-white/70">
								{!feedbackAvailable
									? savedSubmission
										? 'Jawabanmu sudah tercatat.'
										: 'Soal ini dilewati tanpa poin.'
									: isCorrect
										? `+${points} points earned!`
										: 'Your answer was recorded.'}
							</p>
						</div>
					</div>
					<Button
						size="lg"
						onclick={next}
						class="font-black bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-[0_4px_0_#3730a3] hover:brightness-110 active:translate-y-0.5"
					>
						{#if current === questions.length - 1}
							View Score <span class="sr-only">Lihat skor</span> →
						{:else}
							Next Question <span class="sr-only">Pertanyaan berikutnya</span> →
						{/if}
					</Button>
				</div>
			{:else}
				<Button
					class="mt-6 font-black bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 shadow-[0_6px_0_#b45309] hover:brightness-110 active:translate-y-1 text-lg py-4 transition-all"
					block
					size="lg"
					disabled={selected.length === 0}
					{loading}
					onclick={submit}
				>
					Lock Answer <span class="sr-only">Kunci jawaban</span> ⚡
				</Button>
			{/if}

			{#if tally}
				{@const totalVotes = Object.values(tally).reduce((sum, count) => sum + count, 0)}
				<div
					class="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md"
					aria-live="polite"
				>
					<div class="flex items-center justify-between">
						<p class="text-sm font-black uppercase tracking-wider text-white">
							Class Results <span class="sr-only">Hasil kelas</span>
						</p>
						<span class="text-xs font-bold text-white/70"
							>{totalVotes} answers <span class="sr-only">jawaban</span></span
						>
					</div>
					{#each question.options as option, i}
						<div class="mt-3">
							<div class="flex justify-between gap-3 text-xs font-bold text-white/80">
								<span>{optionStyles[i % optionStyles.length].letter}. {option.label}</span>
								<span>{tally[option.id] ?? 0}</span>
							</div>
							<div class="mt-1 h-2.5 overflow-hidden rounded-full bg-white/10">
								<div
									class="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
									style={`width:${totalVotes ? ((tally[option.id] ?? 0) / totalVotes) * 100 : 0}%`}
								></div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</main>
	</section>
{:else}
	<div
		class="rounded-3xl border border-white/15 bg-white/10 p-8 text-center text-white backdrop-blur-md"
	>
		<p class="text-xl font-black">
			Question not open yet. <span class="sr-only">Pertanyaan belum dibuka.</span>
		</p>
		<p class="mt-2 text-white/70">
			Waiting for the instructor to start the quiz. <span class="sr-only"
				>Tunggu dosen menyiapkan kuis.</span
			>
		</p>
	</div>
{/if}

<style>
	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		20% {
			transform: translateX(-8px) rotate(-1deg);
		}
		40% {
			transform: translateX(8px) rotate(1deg);
		}
		60% {
			transform: translateX(-6px);
		}
		80% {
			transform: translateX(6px);
		}
	}
	.animate-shake {
		animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
	}

	@keyframes pop-in {
		0% {
			opacity: 0;
			transform: translateY(16px) scale(0.97);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	.animate-pop-in {
		animation: pop-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes float-up {
		0% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
		50% {
			opacity: 1;
			transform: translateY(-24px) scale(1.15);
		}
		100% {
			opacity: 0;
			transform: translateY(-44px) scale(0.9);
		}
	}
	.animate-float-points {
		animation: float-up 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
	}

	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}
	.shimmer-bar {
		background: linear-gradient(90deg, #f59e0b 0%, #fde047 50%, #f59e0b 100%);
		background-size: 200% 100%;
		animation: shimmer 2s infinite linear;
	}

	@keyframes confetti-fall {
		0% {
			opacity: 1;
			transform: translate(0, 0) rotate(0deg) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(var(--x), var(--y)) rotate(var(--rot)) scale(0.4);
		}
	}
	.confetti-piece {
		position: absolute;
		top: 35%;
		left: 50%;
		width: 10px;
		height: 10px;
		border-radius: 2px;
		background-color: var(--bg);
		animation: confetti-fall 1.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
		animation-delay: var(--delay);
	}
</style>
