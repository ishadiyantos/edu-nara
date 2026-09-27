<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Card } from '$components/ui';
	import SessionStatus from '$lib/components/SessionStatus.svelte';
	import QuizLeaderboard from '$lib/components/poll/QuizLeaderboard.svelte';

	let { data, form } = $props();

	let activeIndex = $state(0);
	let timerSeconds = $state(0);
	let timerRunning = $state(false);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	const questions = $derived(data.questions);
	const active = $derived(questions[activeIndex]);
	const timerMax = $derived(active?.timeLimit ?? 20);
	const timerColor = $derived(
		timerSeconds > timerMax * 0.5
			? '#10b981'
			: timerSeconds > timerMax * 0.25
				? '#f59e0b'
				: '#ef4444'
	);

	// Live tally per question via SSE
	let tally = $state<Record<string, number>>({});
	let connected = $state(false);

	$effect(() => {
		const sessionId = data.snapshot.id;
		const questionId = active?.id;
		const source = new EventSource(`/api/sessions/${encodeURIComponent(sessionId)}/events`);
		const refresh = async () => {
			try {
				const response = await fetch(
					`/api/polls/${encodeURIComponent(data.snapshot.code)}/results?questionId=${encodeURIComponent(questionId ?? '')}`
				);
				if (response.ok && active?.id === questionId) {
					const result = await response.json();
					tally = result.counts ?? {};
				}
			} catch {
				/* reconnect keeps state */
			}
		};
		void refresh();
		source.addEventListener('snapshot', refresh);
		source.addEventListener('resync', refresh);
		source.addEventListener('poll.tally', refresh);
		source.addEventListener('session.state', refresh);
		source.onopen = () => (connected = true);
		source.onerror = () => (connected = false);
		return () => source.close();
	});

	function selectQuestion(index: number) {
		if (index < 0 || index >= questions.length) return;
		activeIndex = index;
		timerSeconds = questions[index].timeLimit;
		stopTimer();
	}

	function startTimer() {
		stopTimer();
		timerSeconds = timerMax;
		timerRunning = true;
		timerInterval = setInterval(() => {
			if (timerSeconds > 0) {
				timerSeconds -= 1;
				if (timerSeconds === 0) timerRunning = false;
			} else {
				timerRunning = false;
				stopTimer();
			}
		}, 1000);
	}

	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
		timerRunning = false;
	}

	const totalResponses = $derived(Object.values(tally).reduce((sum, n) => sum + n, 0));
</script>

<svelte:head><title>Sesi {data.snapshot.code} — Edu Nara</title></svelte:head>

<main class="min-h-dvh bg-[#0b1120] py-4 text-white sm:py-6">
	<div class="mx-auto max-w-6xl px-4 sm:px-6">
		<!-- Top bar -->
		<header
			class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-[#1e1b4b] to-[#0f172a] px-5 py-4 shadow-xl"
		>
			<div>
				<p class="text-xs font-black uppercase tracking-[0.25em] text-[#38bdf8]">
					Game Room · {data.snapshot.title}
				</p>
				<p class="mt-1 font-mono text-3xl font-black tracking-widest" data-testid="session-code">
					{data.snapshot.code}
				</p>
			</div>
			<div class="flex items-center gap-3">
				<span
					class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black"
					data-testid="participant-count"
				>
					<span
						class="inline-block h-2.5 w-2.5 rounded-full {connected
							? 'bg-emerald-400 animate-pulse'
							: 'bg-rose-400'}"
					></span>
					{data.snapshot.count} peserta
				</span>
				<span
					class="rounded-full bg-amber-400/15 border border-amber-400/40 px-4 py-2 text-sm font-black text-amber-300 uppercase tracking-wider"
				>
					{data.snapshot.state}
				</span>
			</div>
		</header>

		{#if form?.message}
			<p
				role="status"
				class="mt-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 px-4 py-3 text-sm font-bold text-emerald-300"
			>
				{form.message}
			</p>
		{/if}

		<!-- Session controls -->
		<div class="mt-4 flex flex-wrap gap-2">
			{#each [{ state: 'open', label: 'Buka sesi' }, { state: 'closed', label: 'Tutup sesi' }, { state: 'ended', label: 'Akhiri sesi' }] as control}
				<form method="POST" use:enhance>
					<input type="hidden" name="state" value={control.state} />
					<Button
						type="submit"
						class="font-black"
						variant={control.state === 'ended' ? 'ghost' : undefined}
						disabled={data.snapshot.state === 'ended' ||
							data.snapshot.state === control.state ||
							(data.snapshot.state === 'draft' && control.state === 'closed')}
						>{control.label}</Button
					>
				</form>
			{/each}
			<a
				class="ml-auto inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white/80 hover:bg-white/20"
				href={data.joinUrl}>{data.joinUrl}</a
			>
		</div>

		{#if data.snapshot.state === 'ended' && data.leaderboard.length}
			<!-- FINAL LEADERBOARD — gamified -->
			<QuizLeaderboard entries={data.leaderboard} />
		{:else if questions.length}
			<!-- Game stage -->
			<div class="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
				<!-- Active question stage -->
				<section
					class="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-[#111827] to-[#0b1120] p-6 shadow-2xl sm:p-8"
					data-testid="presenter-stage"
					aria-live="polite"
				>
					<div
						class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-indigo-600/20 blur-3xl"
						aria-hidden="true"
					></div>
					<div
						class="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-cyan-600/10 blur-3xl"
						aria-hidden="true"
					></div>

					<div class="relative flex items-start justify-between gap-4">
						<div>
							<p class="text-xs font-black uppercase tracking-[0.22em] text-[#38bdf8]">
								Soal {activeIndex + 1} / {questions.length}
							</p>
							<h2
								class="mt-3 max-w-2xl text-2xl font-black leading-tight tracking-tight sm:text-4xl"
							>
								{active.prompt}
							</h2>
						</div>
						<!-- Big timer -->
						<div class="relative flex shrink-0 flex-col items-center">
							<svg class="h-24 w-24 -rotate-90 transform sm:h-28 sm:w-28" viewBox="0 0 44 44">
								<circle
									cx="22"
									cy="22"
									r="18"
									fill="none"
									stroke="currentColor"
									stroke-width="3"
									class="text-white/10"
								/>
								<circle
									cx="22"
									cy="22"
									r="18"
									fill="none"
									stroke={timerColor}
									stroke-width="3"
									stroke-dasharray={113.1}
									stroke-dashoffset={113.1 * (1 - timerSeconds / timerMax)}
									stroke-linecap="round"
									class="transition-all duration-1000 ease-linear"
								/>
							</svg>
							<span class="absolute text-2xl font-black sm:text-3xl" style={`color:${timerColor}`}>
								{timerSeconds}s
							</span>
							<button
								class="mt-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition
								{timerRunning ? 'bg-rose-500/80 hover:bg-rose-500' : 'bg-emerald-500/80 hover:bg-emerald-500'}"
								onclick={() => (timerRunning ? stopTimer() : startTimer())}
							>
								{timerRunning ? '⏸ Jeda' : '▶ Mulai'}
							</button>
						</div>
					</div>

					<!-- Tally bars -->
					<div class="relative mt-8 space-y-3" data-testid="presenter-tally">
						<p class="text-sm font-bold text-white/60">
							{totalResponses} jawaban masuk · {connected ? 'live' : 'menghubungkan…'}
						</p>
						{#each active.options as option, i}
							{@const value = tally[option.id] ?? 0}
							{@const width = totalResponses ? (value / totalResponses) * 100 : 0}
							<div class="flex items-center gap-3">
								<span
									class="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-black text-white {[
										'bg-[#ff416c]',
										'bg-[#00b4db]',
										'bg-[#f7971e]',
										'bg-[#8e2de2]'
									][i % 4]}"
								>
									{String.fromCharCode(65 + i)}
								</span>
								<div class="min-w-0 flex-1">
									<div class="flex justify-between text-sm font-bold">
										<span class="truncate">{option.label}</span>
										<span class="ml-3 shrink-0 text-white/70">{value}</span>
									</div>
									<div class="mt-1 h-4 overflow-hidden rounded-full bg-white/10">
										<div
											class="h-full rounded-full transition-all duration-500 {[
												'bg-[#ff416c]',
												'bg-[#00b4db]',
												'bg-[#f7971e]',
												'bg-[#8e2de2]'
											][i % 4]}"
											style={`width:${width}%`}
										></div>
									</div>
								</div>
							</div>
						{/each}
					</div>

					<!-- Show/hide results -->
					<form method="POST" use:enhance class="relative mt-6">
						<input type="hidden" name="action" value="results" />
						<input type="hidden" name="questionId" value={active.id} />
						<input type="hidden" name="showResults" value={String(!active.showResults)} />
						<Button type="submit" variant="ghost" class="font-black">
							{active.showResults ? '🙈 Sembunyikan hasil' : '👁 Tampilkan hasil ke mahasiswa'}
						</Button>
					</form>
				</section>

				<!-- Question selector -->
				<aside class="space-y-2" aria-label="Daftar soal">
					<p class="px-1 text-xs font-black uppercase tracking-[0.2em] text-white/50">
						Soal · klik untuk tayang
					</p>
					{#each questions as question, i}
						<button
							class="w-full rounded-2xl border px-4 py-3 text-left transition
							{i === activeIndex
								? 'border-[#38bdf8] bg-[#38bdf8]/15 shadow-[0_0_20px_rgba(56,189,248,0.25)]'
								: 'border-white/10 bg-white/5 hover:bg-white/10'}"
							onclick={() => selectQuestion(i)}
							aria-current={i === activeIndex ? 'true' : undefined}
						>
							<div class="flex items-center justify-between gap-2">
								<span class="text-xs font-black text-white/60">SOAL {i + 1}</span>
								<span class="text-xs font-black text-amber-300">⏱ {question.timeLimit}s</span>
							</div>
							<p class="mt-1 truncate text-sm font-bold">{question.prompt}</p>
						</button>
					{/each}
				</aside>
			</div>
		{:else}
			<Card class="mt-6 p-6 text-primary">
				<SessionStatus snapshot={data.snapshot} />
				{#if !questions.length}
					<p class="mt-4 text-sm text-muted">Belum ada soal. Buka editor kuis untuk menambahkan.</p>
				{/if}
			</Card>
		{/if}
	</div>
</main>
