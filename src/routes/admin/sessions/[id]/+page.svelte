<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import QuizLeaderboard from '$lib/components/poll/QuizLeaderboard.svelte';
	import WordcloudResults from '$lib/components/poll/WordcloudResults.svelte';
	let { data, form } = $props();
	let activeIndex = $state(0);
	const questions = $derived(data.questions);
	const active = $derived(questions[activeIndex]);
	const choiceOptions = $derived(active && 'options' in active ? active.options : []);
	let tally = $state<Record<string, number>>({});
	let words = $state<{ word: string; weight: number }[]>([]);
	let moderation = $state<{ id: string; word: string; status: string }[]>([]);
	let connected = $state(false);
	let count = $state(0);
	let errorMessage = $state('');
	let presenting = $state(false);
	let controls = $state(false);
	let stage: HTMLElement;
	let hideTimer: ReturnType<typeof setTimeout>;
	let timerSeconds = $state(0);
	let timerRunning = $state(false);
	let timer: ReturnType<typeof setInterval> | undefined;
	const total = $derived(Object.values(tally).reduce((sum, n) => sum + n, 0));
	function reveal() {
		controls = true;
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => (controls = false), 2500);
	}
	function present() {
		presenting = true;
		controls = false;
		// The element already exists: invoke native API synchronously in the click gesture.
		try {
			void stage.requestFullscreen?.().catch(() => {});
		} catch {
			/* CSS fallback remains usable. */
		}
		stage.focus();
	}
	function exit() {
		presenting = false;
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
	}
	function select(index: number) {
		if (index < 0 || index >= questions.length) return;
		activeIndex = index;
		stopTimer();
	}
	function stopTimer() {
		clearInterval(timer);
		timerRunning = false;
	}
	function startTimer() {
		stopTimer();
		timerSeconds = 'timeLimit' in active ? active.timeLimit : 20;
		timerRunning = true;
		timer = setInterval(() => {
			timerSeconds--;
			if (timerSeconds <= 0) stopTimer();
		}, 1000);
	}
	function key(event: KeyboardEvent) {
		if (!presenting) return;
		if (event.key === 'Escape') exit();
		if (event.key === 'Tab') reveal();
		if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,button'))
			return;
		if (event.key === 'ArrowRight') select(activeIndex + 1);
		if (event.key === 'ArrowLeft') select(activeIndex - 1);
	}
	onMount(() => {
		count = data.snapshot.count;
		words = data.words;
		const onChange = () => {
			if (!document.fullscreenElement) presenting = false;
		};
		document.addEventListener('fullscreenchange', onChange);
		return () => {
			stopTimer();
			clearTimeout(hideTimer);
			document.removeEventListener('fullscreenchange', onChange);
		};
	});
	$effect(() => {
		const id = active?.id;
		const sessionId = data.snapshot.id;
		const isCloud = data.activityType === 'wordcloud';
		let disposed = false;
		const refresh = async () => {
			if (!id) return;
			try {
				const url = isCloud
					? `/api/wordcloud/${data.snapshot.code}/responses?questionId=${id}`
					: `/api/polls/${data.snapshot.code}/results?questionId=${id}`;
				const response = await fetch(url);
				if (response.ok && !disposed) {
					const result = await response.json();
					if (isCloud) words = result.words;
					else tally = result.counts;
				}
			} catch {
				/* EventSource reconnects. */
			}
		};
		const source = new EventSource(`/api/sessions/${sessionId}/events`);
		source.onopen = () => {
			connected = true;
			void refresh();
		};
		source.onerror = () => (connected = false);
		for (const name of ['snapshot', 'resync', 'participant.count'])
			source.addEventListener(name, (event) => {
				const state = JSON.parse((event as MessageEvent).data);
				if (state.count != null) count = state.count;
			});
		for (const name of ['snapshot', 'resync', 'poll.tally', 'session.state', 'wordcloud.snapshot'])
			source.addEventListener(name, refresh);
		void refresh();
		return () => {
			disposed = true;
			source.close();
		};
	});
	$effect(() => {
		if (presenting || data.activityType !== 'wordcloud' || !active) return;
		const id = active.id;
		let disposed = false;
		const refresh = async () => {
			try {
				const response = await fetch(
					`/api/wordcloud/sessions/${data.snapshot.id}/moderation/${id}`
				);
				if (response.ok && !disposed) moderation = (await response.json()).responses;
			} catch {
				/* Next poll retries owner-only queue. */
			}
		};
		void refresh();
		const interval = setInterval(refresh, 2000);
		return () => {
			disposed = true;
			clearInterval(interval);
		};
	});
	async function moderate(id: string, status: 'approved' | 'rejected') {
		errorMessage = '';
		try {
			const response = await fetch(`/api/wordcloud/responses/${id}/moderate`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ status })
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.message ?? 'Moderasi gagal.');
			moderation = moderation.map((item) => (item.id === id ? { ...item, status } : item));
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Moderasi gagal. Coba lagi.';
		}
	}
</script>

<svelte:head><title>Sesi {data.snapshot.code} — Edu Nara</title></svelte:head>
<svelte:window
	onkeydown={key}
	onpointermove={() => {
		if (presenting) reveal();
	}}
	onpointerdown={() => {
		if (presenting) reveal();
	}}
/>
<main
	bind:this={stage}
	tabindex="-1"
	class:presentation={presenting}
	class="session-screen"
	data-testid="session-screen"
>
	<header class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<p class="text-sm font-bold text-cyan-300">Edu Nara · {data.snapshot.title}</p>
			<p class="font-mono text-3xl font-black tracking-widest" data-testid="session-code">
				{data.snapshot.code}
			</p>
		</div>
		<p class="text-sm">
			<span data-testid="participant-count">{count}</span> peserta · {connected
				? 'Live'
				: 'Menghubungkan…'} ·
			{data.snapshot.state}
		</p>
	</header>
	{#if !presenting}
		<div class="my-5 flex flex-wrap gap-3" data-testid="session-controls">
			<a class="control" href="/admin">← Workspace</a>
			{#each [{ state: 'open', label: 'Buka sesi' }, { state: 'closed', label: 'Tutup sesi' }, { state: 'ended', label: 'Akhiri sesi' }] as control}
				<form
					method="POST"
					use:enhance={({ formData }) => {
						if (formData.get('state') === 'open') present();
						return async ({ result, update }) => {
							await update();
							if (result.type === 'failure' || result.type === 'error') exit();
						};
					}}
				>
					<input type="hidden" name="state" value={control.state} />
					<button
						class="control"
						disabled={data.snapshot.state === 'ended' ||
							data.snapshot.state === control.state ||
							(data.snapshot.state === 'draft' && control.state === 'closed')}
						>{control.label}</button
					>
				</form>
			{/each}
			<button class="control" onclick={present} data-testid="fullscreen-button"
				>Mode layar penuh</button
			>
			<a class="control" href={data.joinUrl}>Tautan bergabung</a>
		</div>
		<p class="text-sm text-slate-300">
			Buka sesi memulai tayangan. Gerakkan pointer, sentuh layar, atau tekan Tab untuk kontrol.
			Escape keluar; panah berpindah soal.
		</p>
	{/if}
	{#if form?.message}<p role="status">{form.message}</p>{/if}
	{#if errorMessage}<p role="alert">{errorMessage}</p>{/if}
	{#if data.snapshot.state === 'ended' && data.leaderboard.length}
		<QuizLeaderboard entries={data.leaderboard} />
	{:else if active}
		<section class="slide" data-testid="presenter-stage">
			<p class="text-sm text-cyan-300">
				{data.activityType === 'wordcloud'
					? 'Word Cloud'
					: `Soal ${activeIndex + 1} / ${questions.length}`}
			</p>
			<h1 class="my-5 text-3xl font-black leading-tight sm:text-5xl">{active.prompt}</h1>
			{#if data.activityType === 'wordcloud'}
				<WordcloudResults {words} presentation={presenting} />
			{:else}
				<div class="space-y-5" data-testid="presenter-tally">
					<p class="text-slate-300">
						{total} pilihan masuk {timerRunning ? `· ${timerSeconds}s` : ''}
					</p>
					{#each choiceOptions as option, i}
						{@const value = tally[option.id] ?? 0}
						<div>
							<div class="flex justify-between gap-3 text-lg font-bold">
								<span>{String.fromCharCode(65 + i)}. {option.label}</span><span>{value}</span>
							</div>
							<div class="mt-2 h-5 rounded-full bg-white/10">
								<div
									class="h-full rounded-full bg-cyan-400 transition-[width] duration-500 motion-reduce:transition-none"
									style:width={`${total ? (value / total) * 100 : 0}%`}
								></div>
							</div>
						</div>
					{/each}
				</div>
				{#if !presenting}
					<div class="mt-6 flex flex-wrap gap-3">
						<button class="control" onclick={() => (timerRunning ? stopTimer() : startTimer())}
							>{timerRunning ? 'Jeda' : 'Mulai timer'}</button
						>
						<form method="POST" use:enhance>
							<input type="hidden" name="action" value="results" /><input
								type="hidden"
								name="questionId"
								value={active.id}
							/><input
								type="hidden"
								name="showResults"
								value={String(!active.showResults)}
							/><button class="control"
								>{active.showResults ? 'Sembunyikan hasil' : 'Tampilkan hasil ke mahasiswa'}</button
							>
						</form>
					</div>
				{/if}
			{/if}
		</section>
	{:else}<p class="my-10">Belum ada pertanyaan. Kembali ke workspace dan buka editor.</p>{/if}
	{#if !presenting && data.activityType === 'wordcloud'}
		<aside class="mt-8 rounded-2xl border border-white/20 p-5" aria-label="Antrean moderasi">
			<h2 class="text-xl font-bold">
				Moderasi · {moderation.filter((item) => item.status === 'pending').length} menunggu
			</h2>
			<p class="text-sm text-slate-300">Panel privat dosen. Hanya kata disetujui masuk tayangan.</p>
			{#each moderation as item}<div
					class="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3"
					data-testid="moderation-item"
				>
					<span class="min-w-0 flex-1 break-words">{item.word} · {item.status}</span
					>{#if item.status !== 'approved'}<button
							class="control"
							onclick={() => moderate(item.id, 'approved')}>Setujui</button
						>{/if}{#if item.status !== 'rejected'}<button
							class="control"
							onclick={() => moderate(item.id, 'rejected')}>Tolak</button
						>{/if}
				</div>{:else}<p class="mt-4">Belum ada kiriman.</p>{/each}
		</aside>
	{/if}
	{#if !presenting && questions.length > 1}<nav
			class="mt-6 flex flex-wrap gap-2"
			aria-label="Daftar soal"
		>
			{#each questions as question, i}<button
					class="control"
					aria-current={i === activeIndex ? 'true' : undefined}
					onclick={() => select(i)}>Soal {i + 1}: {question.prompt}</button
				>{/each}
		</nav>{/if}
	{#if presenting}
		<nav class:visible={controls} class="presenter-controls" aria-label="Kontrol presentasi">
			<button class="control" disabled={activeIndex === 0} onclick={() => select(activeIndex - 1)}
				>Sebelumnya</button
			>
			<button
				class="control"
				disabled={activeIndex >= questions.length - 1}
				onclick={() => select(activeIndex + 1)}>Berikutnya</button
			>
			<button class="control" onclick={exit} data-testid="exit-fullscreen"
				>Keluar presentasi (Esc)</button
			>
		</nav>
	{/if}
</main>

<style>
	.session-screen {
		min-height: 100dvh;
		padding: clamp(1rem, 3vw, 3rem);
		background: #0b1120;
		color: white;
		outline: none;
	}
	.session-screen:not(.presentation) {
		max-width: 1440px;
		margin: auto;
	}
	.presentation {
		position: fixed;
		inset: 0;
		z-index: 100;
		width: 100%;
		height: 100dvh;
		overflow: auto;
	}
	.slide {
		margin-top: 2rem;
		padding: clamp(1rem, 3vw, 3rem);
		border-radius: 2rem;
		background: #111827;
	}
	.presentation .slide {
		min-height: 75dvh;
	}
	.control {
		display: inline-flex;
		min-height: 44px;
		align-items: center;
		justify-content: center;
		border: 1px solid #64748b;
		border-radius: 0.75rem;
		padding: 0.5rem 1rem;
		font-weight: 700;
		color: white;
		background: #1e293b;
	}
	.control:disabled {
		opacity: 0.4;
	}
	.control:focus-visible {
		outline: 3px solid #67e8f9;
		outline-offset: 3px;
	}
	.presenter-controls {
		position: fixed;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 0.5rem;
		max-width: 95vw;
		opacity: 0;
		pointer-events: none;
	}
	.presenter-controls.visible,
	.presenter-controls:focus-within {
		opacity: 1;
		pointer-events: auto;
	}
</style>
