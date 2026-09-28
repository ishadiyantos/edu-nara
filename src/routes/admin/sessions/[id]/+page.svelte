<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount, untrack } from 'svelte';
	import QuizLeaderboard from '$lib/components/poll/QuizLeaderboard.svelte';
	import WordcloudResults from '$lib/components/poll/WordcloudResults.svelte';
	import { Icon, QRCode } from '$components/ui';
	let { data, form } = $props();
	let localIndex = $state(0);
	let syncedId = $state<string | null>(null);
	let switching = $state(false);
	const activeIndex = $derived(
		data.activityType === 'wordcloud'
			? Math.max(
					0,
					data.questions.findIndex((q) => q.id === (syncedId ?? data.snapshot.activeQuestionId))
				)
			: localIndex
	);
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
	let view = $state<'join' | 'activity'>(
		untrack(() => (data.snapshot.state === 'draft' ? 'join' : 'activity'))
	);
	let stage: HTMLElement;
	let hideTimer: ReturnType<typeof setTimeout>;
	let timerSeconds = $state(0);
	let timerRunning = $state(false);
	let timer: ReturnType<typeof setInterval> | undefined;
	const total = $derived(Object.values(tally).reduce((sum, n) => sum + n, 0));
	const showJoin = $derived(view === 'join');
	const statusControls = [
		{ state: 'open', label: 'Buka sesi', icon: 'play' },
		{ state: 'closed', label: 'Tutup sesi', icon: 'eye-off' },
		{ state: 'ended', label: 'Akhiri sesi', icon: 'stop' }
	] as const;
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
	async function select(index: number) {
		if (switching || index < 0 || index >= questions.length) return;
		stopTimer();
		view = 'activity';
		if (data.activityType !== 'wordcloud') {
			localIndex = index;
			return;
		}
		switching = true;
		errorMessage = '';
		try {
			const response = await fetch(window.location.pathname, {
				method: 'POST',
				headers: { 'x-sveltekit-action': 'true' },
				body: new URLSearchParams({ action: 'question', questionId: questions[index].id })
			});
			const result = deserialize(await response.text());
			if (result.type !== 'success') throw new Error('Perpindahan gagal. Coba lagi.');
			syncedId = questions[index].id;
			await invalidateAll();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Perpindahan gagal.';
		} finally {
			switching = false;
		}
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
		if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select'))
			return;
		if (event.key.toLowerCase() === 'i' && !event.ctrlKey && !event.metaKey && !event.altKey) {
			view = showJoin ? 'activity' : 'join';
			reveal();
		}
		if (!presenting) return;
		if (event.key === 'Escape') exit();
		if (event.key === 'Tab') reveal();
		if (!showJoin && event.key === 'ArrowRight') select(activeIndex + 1);
		if (!showJoin && event.key === 'ArrowLeft') select(activeIndex - 1);
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
		words = [];
		const refresh = async () => {
			if (!id) return;
			try {
				const url = isCloud
					? `/api/wordcloud/${data.snapshot.code}/responses?questionId=${id}`
					: `/api/polls/${data.snapshot.code}/results?questionId=${id}`;
				const response = await fetch(url);
				if (response.ok && !disposed) {
					const result = await response.json();
					if (disposed) return;
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
		for (const name of ['snapshot', 'resync', 'participant.count', 'session.question'])
			source.addEventListener(name, (event) => {
				const state = JSON.parse((event as MessageEvent).data);
				if (state.count != null) count = state.count;
				if (state.state === 'ended' || state.state === 'closed') view = 'activity';
				if (isCloud && (state.activeQuestionId || state.questionId))
					syncedId = state.activeQuestionId ?? state.questionId;
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
	<div
		class:visible={!presenting || controls}
		class="session-toolbar"
		data-testid="session-controls"
		role="group"
		aria-label="Kontrol sesi"
	>
		<a class="floating-control" href="/admin" aria-label="Workspace" title="Workspace"
			><Icon name="arrow-left" /> <span>Workspace</span></a
		>
		{#each statusControls as control}
			<form
				method="POST"
				use:enhance={({ formData }) => {
					return async ({ result, update }) => {
						await update();
						if (result.type === 'success' && formData.get('state') === 'open') view = 'activity';
					};
				}}
			>
				<input type="hidden" name="state" value={control.state} />
				<button
					class="floating-control"
					aria-label={control.label}
					title={control.label}
					disabled={data.snapshot.state === 'ended' ||
						data.snapshot.state === control.state ||
						(data.snapshot.state === 'draft' && control.state === 'closed')}
					><Icon name={control.icon} /> <span>{control.label}</span></button
				>
			</form>
		{/each}
		{#if !presenting}<button
				class="floating-control"
				onclick={present}
				data-testid="fullscreen-button"
				aria-label="Mode layar penuh"
				title="Mode layar penuh"><Icon name="fullscreen" /> <span>Mode layar penuh</span></button
			>{/if}
		<button
			class="floating-control"
			onclick={() => (view = showJoin ? 'activity' : 'join')}
			aria-label={showJoin ? 'Sembunyikan petunjuk bergabung' : 'Tampilkan petunjuk bergabung'}
			aria-pressed={showJoin}
			title={showJoin ? 'Sembunyikan petunjuk (I)' : 'Petunjuk bergabung (I)'}
			><Icon name="qr" /><span>QR & kode</span></button
		>
		<a
			class="floating-control"
			href={data.joinUrl}
			target="_blank"
			rel="noopener"
			aria-label="Tautan bergabung"
			title="Tautan bergabung"><Icon name="link" /> <span>Tautan bergabung</span></a
		>
	</div>
	{#if form?.message}<p role="status">{form.message}</p>{/if}
	{#if errorMessage}<p role="alert">{errorMessage}</p>{/if}
	{#if showJoin}
		<section class="joining-panel" data-testid="joining-instructions">
			<div>
				<p class="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Cara bergabung</p>
				<h1 class="mt-3 text-3xl font-black leading-tight sm:text-5xl">
					Pindai QR atau buka tautan, lalu masukkan kode sesi.
				</h1>
				<p class="mt-4 text-lg text-slate-300">
					Kode sesi
					<span class="ml-2 font-mono text-2xl font-black tracking-[0.3em] text-white"
						>{data.snapshot.code}</span
					>
				</p>
				<p class="mt-2 text-sm text-slate-400">
					{data.snapshot.title} · {count} peserta sudah bergabung
				</p>
				<div class="mt-6 flex flex-wrap gap-3">
					<a class="control" href={data.joinUrl} target="_blank" rel="noopener"
						>Buka halaman bergabung</a
					>
					{#if data.snapshot.state !== 'draft'}<button
							class="control"
							onclick={() => (view = 'activity')}
							><Icon name="arrow-right" /> Kembali ke aktivitas</button
						>{/if}
				</div>
			</div>
			<div class="joining-qr">
				<QRCode value={data.joinUrl} size={320} label="QR code sesi" />
			</div>
		</section>
	{:else if active}
		{#if !presenting && data.snapshot.state === 'ended' && data.leaderboard.length}
			<QuizLeaderboard entries={data.leaderboard} />
		{/if}
		<section class="slide" data-testid="presenter-stage">
			<p class="text-sm text-cyan-300">
				{data.activityType === 'wordcloud'
					? `Word Cloud · ${activeIndex + 1} / ${questions.length}`
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
	{#if !presenting && !showJoin && data.activityType === 'wordcloud'}
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
	{#if !presenting && !showJoin && questions.length > 1}<nav
			class="mt-6 flex flex-wrap gap-2"
			aria-label="Daftar soal"
		>
			{#each questions as question, i}<button
					class="control"
					disabled={switching}
					aria-current={i === activeIndex ? 'true' : undefined}
					onclick={() => select(i)}>Soal {i + 1}: {question.prompt}</button
				>{/each}
		</nav>{/if}
	{#if presenting}
		<nav class:visible={controls} class="presenter-controls" aria-label="Kontrol presentasi">
			<button
				class="control"
				disabled={showJoin || switching || activeIndex === 0}
				onclick={() => select(activeIndex - 1)}
				><Icon name="arrow-left" /><span>Sebelumnya</span></button
			>
			<button
				class="control"
				disabled={showJoin || switching || activeIndex >= questions.length - 1}
				onclick={() => select(activeIndex + 1)}
				><Icon name="arrow-right" /><span>Berikutnya</span></button
			>
			<button class="control" onclick={exit} data-testid="exit-fullscreen"
				><Icon name="close" /><span>Keluar presentasi (Esc)</span></button
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
		width: 100%;
		padding-bottom: 6rem;
	}
	.presentation {
		position: fixed;
		inset: 0;
		z-index: 100;
		width: 100%;
		height: 100dvh;
		display: flex;
		flex-direction: column;
		gap: clamp(0.5rem, 2vh, 1.25rem);
		padding: clamp(0.75rem, 2vw, 2rem);
		padding-bottom: 9rem;
		overflow: hidden;
	}
	.slide {
		margin-top: 2rem;
		padding: clamp(1rem, 3vw, 3rem);
		border-radius: 2rem;
		background: #111827;
	}
	.presentation header {
		flex-shrink: 0;
	}
	.presentation .slide {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		margin-top: 0;
		padding: clamp(0.75rem, 2vw, 2rem);
	}
	.presentation .slide h1 {
		margin: clamp(0.5rem, 2vh, 1.25rem) 0;
		font-size: clamp(1.5rem, 4vw, 3rem);
		overflow-wrap: anywhere;
	}
	.control[aria-current='true'] {
		border-color: #67e8f9;
		background: #164e63;
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
		gap: 0.5rem;
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
		width: max-content;
		border-radius: 999px;
		padding: 0.3rem;
		background: #e2e8f0;
		opacity: 0;
		pointer-events: none;
	}
	.presenter-controls.visible,
	.presenter-controls:focus-within {
		opacity: 1;
		pointer-events: auto;
	}
	/* Floating control dock, Mentimeter-style: pill row, icon-first, label on hover. */
	.session-toolbar {
		position: fixed;
		left: 50%;
		bottom: 0.75rem;
		transform: translateX(-50%);
		width: max-content;
		z-index: 60;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		max-width: min(96vw, 64rem);
		padding: 0.4rem;
		border: 1px solid rgba(148, 163, 184, 0.35);
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.92);
		backdrop-filter: blur(10px);
		box-shadow: 0 12px 30px rgba(2, 6, 23, 0.55);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.25s ease;
	}
	.presentation .session-toolbar {
		bottom: 4.75rem;
		background: rgba(241, 245, 249, 0.92);
		border-color: rgba(15, 23, 42, 0.12);
	}
	.session-toolbar.visible,
	.session-toolbar:focus-within {
		opacity: 1;
		pointer-events: auto;
	}
	.presentation .session-toolbar.visible {
		opacity: 0.92;
	}
	.floating-control {
		position: relative;
		display: inline-flex;
		min-height: 44px;
		min-width: 44px;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.55rem 0.6rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: #e2e8f0;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			background-color 0.2s ease,
			color 0.2s ease;
	}
	.presentation .floating-control {
		color: #0f172a;
	}
	.floating-control:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.14);
	}
	.presentation .floating-control:hover:not(:disabled) {
		background: rgba(15, 23, 42, 0.1);
	}
	.floating-control[aria-pressed='true'] {
		background: rgba(103, 232, 249, 0.25);
	}
	.floating-control:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.floating-control:focus-visible {
		outline: 3px solid #67e8f9;
		outline-offset: 2px;
	}
	.floating-control span {
		display: none;
		white-space: nowrap;
	}
	.floating-control::after {
		content: attr(title);
		position: absolute;
		bottom: calc(100% + 0.65rem);
		left: 50%;
		transform: translateX(-50%);
		background: #020617;
		color: #fff;
		font-size: 0.8rem;
		white-space: nowrap;
		padding: 0.5rem 0.7rem;
		border-radius: 0.6rem;
		opacity: 0;
		pointer-events: none;
	}
	.floating-control:hover::after,
	.floating-control:focus-visible::after {
		opacity: 1;
	}
	@media (min-width: 1100px) {
		.session-screen:not(.presentation) .floating-control span {
			display: inline;
		}
	}
	@media (max-width: 640px) {
		.session-screen:not(.presentation) {
			padding-bottom: 11rem;
		}
		.session-toolbar {
			border-radius: 999px;
		}
	}
	/* Joining instructions: the first thing a presenter shows the class. */
	.joining-panel {
		display: grid;
		gap: clamp(1.5rem, 4vw, 3rem);
		align-items: center;
		margin-top: clamp(1rem, 3vh, 2.5rem);
		padding: clamp(1.25rem, 3vw, 2.5rem);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 2rem;
		background: #111827;
	}
	@media (min-width: 900px) {
		.joining-panel {
			grid-template-columns: 1fr auto;
		}
	}
	.joining-qr {
		display: flex;
		justify-content: center;
	}
	.presentation .joining-panel {
		flex: 1;
		min-height: 0;
		margin-top: 0;
	}
	.joining-panel h1 {
		font-size: clamp(1.35rem, 3vw, 3rem);
	}
	.joining-qr {
		min-width: 0;
	}
	@media (max-width: 899px) {
		.joining-panel {
			text-align: center;
			gap: 0.75rem;
			padding: 1rem;
		}
		.joining-panel h1 {
			margin-top: 0.5rem;
		}
		.joining-qr :global(svg) {
			width: min(52vw, 220px);
		}
		.joining-panel :global(.qr-code) {
			padding: 0.3rem;
		}
		.joining-panel .mt-6 {
			margin-top: 0.75rem;
			justify-content: center;
		}
		.presenter-controls .control {
			padding: 0.5rem;
			font-size: 0.75rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.session-toolbar,
		.floating-control {
			transition: none;
		}
	}
</style>
