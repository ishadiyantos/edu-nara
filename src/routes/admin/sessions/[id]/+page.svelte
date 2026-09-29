<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount, untrack } from 'svelte';
	import BoardLive from '$lib/components/board/BoardLive.svelte';
	let boardRefresh = $state(0);
	import QuizLeaderboard from '$lib/components/poll/QuizLeaderboard.svelte';
	import WordcloudResults from '$lib/components/poll/WordcloudResults.svelte';
	import CelebrationBurst from '$lib/components/gamification/CelebrationBurst.svelte';
	import GameShowTimer from '$lib/components/gamification/GameShowTimer.svelte';
	import { Icon, QRCode } from '$components/ui';
	let { data, form } = $props();
	let live = $state(untrack(() => data.snapshot));
	let localIndex = $state(0);
	let switching = $state(false);
	const guided = $derived(data.activityType === 'choice' && live.quizMode === 'guided');
	const questions = $derived(data.questions);
	const activeIndex = $derived(
		data.activityType === 'wordcloud' || (guided && live.state !== 'ended')
			? Math.max(
					0,
					questions.findIndex((q) => q.id === live.activeQuestionId)
				)
			: localIndex
	);
	const active = $derived(questions[activeIndex]);
	const choiceOptions = $derived(active && 'options' in active ? active.options : []);
	let tally = $state<Record<string, number>>({});
	let words = $state<{ word: string; weight: number }[]>([]);
	let moderation = $state<{ id: string; word: string; status: string }[]>([]);
	let leaderboard = $state(untrack(() => data.leaderboard));
	let connected = $state(false);
	let celebration = $state(false);
	let celebrationLabel = $state('');
	let celebrationTimer: ReturnType<typeof setTimeout> | undefined;

	function celebrate(label: string) {
		celebration = false;
		celebrationLabel = label;
		if (celebrationTimer) clearTimeout(celebrationTimer);
		celebrationTimer = setTimeout(() => (celebration = true), 20);
		setTimeout(() => (celebration = false), 1700);
	}
	const count = $derived(live.count);
	let errorMessage = $state('');
	let presenting = $state(false);
	let controls = $state(false);
	let view = $state<'join' | 'activity' | 'leaderboard'>(
		untrack(() =>
			live.state === 'draft'
				? 'join'
				: data.activityType === 'choice' && data.snapshot.state === 'ended'
					? 'leaderboard'
					: 'activity'
		)
	);
	let stage: HTMLElement;
	let hideTimer: ReturnType<typeof setTimeout>;
	let now = $state(Date.now());
	let offset = $state(untrack(() => data.snapshot.serverNow - Date.now()));
	const timerDeadline = $derived(live.timerDeadline);
	const timerSeconds = $derived(
		Math.max(
			0,
			Math.ceil((timerDeadline == null ? live.timerDuration : timerDeadline - now - offset) / 1000)
		)
	);
	const timerRunning = $derived(timerDeadline != null && timerSeconds > 0);
	const timerUsed = $derived(timerDeadline != null || live.timerDuration > 0);
	const total = $derived(Object.values(tally).reduce((sum, n) => sum + n, 0));
	const showJoin = $derived(view === 'join');
	const showTally = $derived(data.activityType === 'choice' && live.state === 'ended');
	const statusControls = [
		{ state: 'open', label: 'Buka sesi', icon: 'play' },
		{ state: 'closed', label: 'Tutup sesi', icon: 'eye-off' },
		{ state: 'ended', label: 'Akhiri sesi', icon: 'stop' }
	] as const;
	function applyLive(value: Partial<typeof live>) {
		live = { ...live, ...value };
		if (value.serverNow != null) offset = value.serverNow - Date.now();
	}
	function reveal() {
		controls = true;
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => (controls = false), 2500);
	}
	function present() {
		presenting = true;
		controls = false;
		try {
			void stage.requestFullscreen?.().catch(() => {});
		} catch {
			/* CSS fallback. */
		}
		stage.focus();
	}
	function exit() {
		presenting = false;
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
	}
	async function action(values: Record<string, string>) {
		errorMessage = '';
		try {
			const response = await fetch(window.location.pathname, {
				method: 'POST',
				headers: { 'x-sveltekit-action': 'true' },
				body: new URLSearchParams(values)
			});
			const result = deserialize(await response.text());
			if (result.type !== 'success')
				throw new Error(
					result.type === 'failure' ? String(result.data?.message ?? 'Aksi gagal.') : 'Aksi gagal.'
				);
			await invalidateAll();
			applyLive(data.snapshot);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Aksi gagal. Coba lagi.';
		}
	}
	async function select(index: number, direction?: number) {
		if (switching || index < 0 || index >= questions.length) return;
		view = 'activity';
		if (data.activityType !== 'wordcloud' && (!guided || live.state === 'ended')) {
			localIndex = index;
			return;
		}
		switching = true;
		await action(
			direction
				? { action: 'question', direction: String(direction) }
				: { action: 'question', questionId: questions[index].id }
		);
		switching = false;
	}
	async function setTimer(running: boolean, reset = false) {
		if (active && guided)
			await action({
				action: 'timer',
				questionId: active.id,
				running: String(running),
				reset: String(reset)
			});
	}
	async function refreshResults() {
		const id = active?.id;
		if (!id) return;
		try {
			const isCloud = data.activityType === 'wordcloud';
			const res = await fetch(
				isCloud
					? `/api/wordcloud/${live.code}/responses?questionId=${id}`
					: `/api/polls/${live.code}/results?questionId=${id}`
			);
			const result = await res.json();
			if (!res.ok || id !== active?.id) return;
			if (isCloud) words = result.words;
			else tally = result.counts;
		} catch {
			/* Reconnect refreshes owner-only tally. */
		}
	}
	async function refreshLeaderboard() {
		if (data.activityType !== 'choice') return;
		try {
			const res = await fetch(`/api/polls/${live.code}/results?leaderboard=true`);
			if (res.ok) leaderboard = (await res.json()).entries;
		} catch {
			/* Reconnect retries owner-only scores. */
		}
	}
	let boardToolbarHost = $state<HTMLElement | null>(null);
	function key(event: KeyboardEvent) {
		if (document.querySelector('dialog[open]')) return;
		if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select'))
			return;
		if (event.key.toLowerCase() === 'i' && !event.ctrlKey && !event.metaKey && !event.altKey) {
			view = showJoin ? 'activity' : 'join';
			reveal();
		}
		if (!presenting) return;
		if (event.key === 'Escape') exit();
		if (event.key === 'Tab') reveal();
		if (data.activityType !== 'board' && !showJoin && event.key === 'ArrowRight') {
			event.preventDefault();
			void select(activeIndex + 1, 1);
		}
		if (data.activityType !== 'board' && !showJoin && event.key === 'ArrowLeft') {
			event.preventDefault();
			void select(activeIndex - 1, -1);
		}
	}
	onMount(() => {
		const tick = setInterval(() => (now = Date.now()), 250);
		const onChange = () => {
			if (!document.fullscreenElement) presenting = false;
		};
		document.addEventListener('fullscreenchange', onChange);
		const source = new EventSource(`/api/sessions/${live.id}/events`);
		source.onopen = () => {
			connected = true;
			boardRefresh++;
			void refreshResults();
			void refreshLeaderboard();
		};
		source.onerror = () => (connected = false);
		for (const name of [
			'snapshot',
			'resync',
			'participant.count',
			'session.question',
			'session.state'
		])
			source.addEventListener(name, (event) => {
				const next = JSON.parse((event as MessageEvent).data);
				const wasEnded = live.state === 'ended';
				applyLive(next);
				boardRefresh++;
				if (!wasEnded && next.state === 'ended' && data.activityType === 'choice')
					view = 'leaderboard';
				void refreshResults();
				void refreshLeaderboard();
			});
		source.addEventListener('poll.tally', () => {
			void refreshResults();
			void refreshLeaderboard();
		});
		for (const name of [
			'board.post.new',
			'board.post.moderated',
			'board.post.removed',
			'board.reordered'
		])
			source.addEventListener(name, () => boardRefresh++);
		source.addEventListener('wordcloud.snapshot', () => void refreshResults());
		return () => {
			clearInterval(tick);
			clearTimeout(hideTimer);
			source.close();
			document.removeEventListener('fullscreenchange', onChange);
		};
	});
	$effect(() => {
		if (active?.id) {
			tally = {};
			words = [];
			void refreshResults();
		}
	});
	$effect(() => {
		if (presenting || data.activityType !== 'wordcloud' || !active) return;
		const id = active.id;
		let disposed = false;
		const refresh = async () => {
			try {
				const response = await fetch(`/api/wordcloud/sessions/${live.id}/moderation/${id}`);
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
			errorMessage = err instanceof Error ? err.message : 'Moderasi gagal.';
		}
	}
</script>

<svelte:head><title>Sesi {live.code} — Edu Nara</title></svelte:head>
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
	class:board-screen={data.activityType === 'board'}
	class="session-screen"
	data-testid="session-screen"
	data-view={view}
>
	<div class="stage-beams" aria-hidden="true"></div>
	<div class="stage-grid" aria-hidden="true"></div>
	<header class="stage-header">
		<div>
			<p class="stage-kicker">
				{data.activityType === 'board' ? 'Edu Nara · Papan diskusi' : `Edu Nara · ${live.title}`}
			</p>
			<p class="stage-code" data-testid="session-code">{live.code}</p>
		</div>
		<div class="stage-actions">
			<p class="stage-status">
				<span aria-hidden="true"></span>
				<b data-testid="participant-count">{count}</b> peserta · {connected
					? 'Live'
					: 'Menghubungkan…'} ·
				{live.state}
			</p>
			{#if data.activityType === 'board'}<div
					class="board-toolbar-host"
					bind:this={boardToolbarHost}
				></div>{/if}
		</div>
	</header>
	<div
		class:visible={!presenting ||
			controls ||
			(data.activityType === 'choice' && live.state === 'ended')}
		class="session-toolbar"
		data-testid="session-controls"
		role="group"
		aria-label="Kontrol sesi"
	>
		<a class="floating-control" href="/admin" aria-label="Dashboard admin" title="Dashboard admin"
			><Icon name="home" /> <span>Dashboard admin</span></a
		>
		{#if data.activityType === 'board'}<a
				class="floating-control"
				href={`/admin/activities/${data.activityId}/board`}
				aria-label="Editor kolom"
				title="Editor kolom">✎<span>Editor kolom</span></a
			>{/if}
		{#each statusControls as control}
			<form
				method="POST"
				use:enhance={({ formData }) => {
					return async ({ result, update }) => {
						await update();
						if (result.type === 'success') {
							applyLive(data.snapshot);
							if (formData.get('state') === 'open') view = 'activity';
						}
					};
				}}
			>
				<input type="hidden" name="state" value={control.state} />
				<button
					class="floating-control"
					aria-label={control.label}
					title={control.label}
					disabled={live.state === 'ended' ||
						live.state === control.state ||
						(live.state === 'draft' && control.state === 'closed')}
					><Icon name={control.icon} /> <span>{control.label}</span></button
				>
			</form>
		{/each}
		{#if guided && timerUsed && live.state !== 'ended'}
			<button
				type="button"
				class="floating-control"
				disabled={live.state !== 'open'}
				onclick={() => setTimer(false)}
				aria-label="Stop timer"
				title="Stop timer"><Icon name="pause" /> <span>Stop timer</span></button
			>
			<button
				type="button"
				class="floating-control"
				disabled={live.state !== 'open'}
				onclick={() => setTimer(true, true)}
				aria-label="Reset timer"
				title="Reset timer"><Icon name="timer" /> <span>Reset timer</span></button
			>
		{/if}
		{#if data.activityType === 'choice' && live.state === 'ended'}
			<button
				type="button"
				class="floating-control"
				onclick={() => (view = view === 'leaderboard' ? 'activity' : 'leaderboard')}
				aria-label={view === 'leaderboard' ? 'Tinjau soal' : 'Leaderboard'}
				title={view === 'leaderboard' ? 'Tinjau soal' : 'Leaderboard'}
				><Icon name="eye" />
				<span>{view === 'leaderboard' ? 'Tinjau soal' : 'Leaderboard'}</span></button
			>
		{/if}
		{#if !presenting}<button
				type="button"
				class="floating-control"
				onclick={present}
				data-testid="fullscreen-button"
				aria-label="Mode layar penuh"
				title="Mode layar penuh"><Icon name="fullscreen" /> <span>Mode layar penuh</span></button
			>{/if}
		<button
			type="button"
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
		<nav
			class:visible={controls}
			class="presenter-navigation"
			aria-label="Kontrol presentasi"
			data-testid="presenter-navigation"
		>
			{#if presenting}
				{#if data.activityType !== 'board'}<button
						class="floating-control"
						aria-label="Sebelumnya"
						title="Sebelumnya (←)"
						disabled={showJoin || switching || activeIndex === 0}
						onclick={() => select(activeIndex - 1, -1)}
						><Icon name="arrow-left" /><span>Sebelumnya</span></button
					>
					<button
						class="floating-control"
						aria-label="Berikutnya"
						title="Berikutnya (→)"
						disabled={showJoin || switching || activeIndex >= questions.length - 1}
						onclick={() => select(activeIndex + 1, 1)}
						><Icon name="arrow-right" /><span>Berikutnya</span></button
					>{/if}
				<button
					class="floating-control"
					aria-label="Keluar presentasi (Esc)"
					title="Keluar presentasi (Esc)"
					onclick={exit}
					data-testid="exit-fullscreen"
					><Icon name="close" /><span>Keluar presentasi (Esc)</span></button
				>
			{/if}
		</nav>
	</div>
	<CelebrationBurst
		active={celebration}
		label={celebrationLabel}
		variant={view === 'leaderboard' ? 'leaderboard' : 'correct'}
	/>
	{#if form?.message}<p role="status">{form.message}</p>{/if}
	{#if errorMessage}<p role="alert">{errorMessage}</p>{/if}
	{#if !showJoin && data.activityType === 'choice' && live.state === 'ended'}
		<div class="top-navigation" data-testid="post-session-review-nav">
			{#if questions.length > 1}<nav class="flex flex-wrap gap-2" aria-label="Daftar soal">
					{#each questions as question, i}<button
							class="control"
							disabled={switching}
							aria-current={i === activeIndex ? 'true' : undefined}
							onclick={() => select(i)}>Soal {i + 1}: {question.prompt}</button
						>{/each}
				</nav>{/if}
		</div>
	{/if}
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
						>{live.code}</span
					>
				</p>
				<p class="mt-2 text-sm text-slate-400">
					{live.title} · {count} peserta sudah bergabung
				</p>
				<div class="mt-6 flex flex-wrap gap-3">
					<a class="control" href={data.joinUrl} target="_blank" rel="noopener"
						>Buka halaman bergabung</a
					>
					{#if live.state !== 'draft'}<button class="control" onclick={() => (view = 'activity')}
							><Icon name="arrow-right" /> Kembali ke aktivitas</button
						>{/if}
				</div>
			</div>
			<div class="joining-qr">
				<QRCode value={data.joinUrl} size={320} label="QR code sesi" />
			</div>
		</section>
	{:else if data.activityType === 'board' && data.board}
		<BoardLive
			sessionId={live.id}
			sessionCode={live.code}
			initial={data.board}
			title={live.title}
			admin
			presentation={presenting}
			refreshKey={boardRefresh}
			toolbarHost={boardToolbarHost}
		/>
	{:else if active}
		{#if view === 'leaderboard'}
			<QuizLeaderboard
				entries={leaderboard}
				presentation={presenting}
				autoScroll={live.state === 'ended'}
			/>
		{:else}<section class="slide game-stage" data-testid="presenter-stage">
				<div class="stage-topline">
					<div class="stage-badges">
						<span class="live-badge"><span aria-hidden="true"></span>LIVE</span>
						<span class="round-badge"
							>{data.activityType === 'wordcloud'
								? 'Word Cloud'
								: `Ronde ${activeIndex + 1} / ${questions.length}`}</span
						>
					</div>
					<div class="stage-metrics">
						<div class="audience-meter">
							<span>{count}</span>
							peserta online
						</div>
						{#if showTally}<div class="audience-meter answer-meter" data-testid="answer-total">
								<span>{total}</span>
								pilihan masuk
							</div>{/if}
					</div>
				</div>
				<div class="prompt-deck">
					<div>
						<p class="prompt-label">Pertanyaan sekarang</p>
						<h1>{active.prompt}</h1>
					</div>
					{#if guided && timerUsed}
						<GameShowTimer
							seconds={timerSeconds}
							totalSeconds={(active && 'timeLimit' in active ? active.timeLimit : null) ??
								live.timerDuration ??
								30}
							running={timerRunning}
							paused={!timerRunning && timerSeconds > 0}
							expired={timerSeconds === 0}
						/>
					{/if}
				</div>
				{#if data.activityType === 'wordcloud'}
					<WordcloudResults {words} presentation={presenting} />
				{:else}
					{#if !presenting && live.state !== 'ended'}
						<div class="stage-actions">
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
									>{active.showResults
										? 'Sembunyikan hasil'
										: 'Tampilkan hasil ke mahasiswa'}</button
								>
							</form>
						</div>
					{/if}
					{#if showTally}
						<div class="tally-stage" data-testid="presenter-tally">
							<div class="tally-header">
								<div>
									<p class="prompt-label">Live answers</p>
									<h2>{total} pilihan masuk</h2>
								</div>
								<div class="answer-orb" aria-hidden="true">{total}</div>
							</div>
							<div class="answer-bars">
								{#each choiceOptions as option, i}
									{@const value = tally[option.id] ?? 0}
									{@const percent = total ? Math.max(4, (value / total) * 100) : 4}
									<div class="answer-bar-card">
										<div class="answer-row">
											<span class="answer-letter">{String.fromCharCode(65 + i)}</span>
											<span class="answer-label">{option.label}</span>
											<strong>{value}</strong>
										</div>
										<div class="answer-track" aria-hidden="true">
											<div class="answer-fill" style:width={`${percent}%`}></div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<div class="stage-options" data-testid="presenter-options">
							<p class="prompt-label">Pilihan jawaban</p>
							<div class="option-grid">
								{#each choiceOptions as option, i}
									{@const picked = tally[option.id] ?? 0}
									<div
										class="option-card"
										data-testid="presenter-option"
										data-index={i}
										data-picked={picked > 0}
									>
										<span class="option-letter">{String.fromCharCode(65 + i)}</span>
										<span class="option-text">{option.label}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/if}
			</section>{/if}
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
</main>

<style>
	.session-screen.board-screen.presentation {
		overflow-y: auto;
		padding-bottom: 6rem;
	}
	.session-screen {
		min-height: 100dvh;
		width: 100%;
		max-width: 100dvw;
		overflow-x: hidden;
		padding: clamp(1rem, 3vw, 3rem);
		background: #0b1120;
		color: white;
		outline: none;
	}
	.session-screen:not(.presentation) {
		width: 100%;
		max-width: 100dvw;
		padding-bottom: 6rem;
	}
	.presentation {
		position: fixed;
		inset: 0;
		z-index: 100;
		width: 100%;
		max-width: 100dvw;
		height: 100dvh;
		display: flex;
		flex-direction: column;
		gap: clamp(0.5rem, 2vh, 1.25rem);
		padding: clamp(0.75rem, 2vw, 2rem);
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
	.top-navigation {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.65rem;
		margin: 1rem 0 0.5rem;
		padding: 0.65rem;
		border: 1px solid rgb(34 211 238 / 0.22);
		border-radius: 1rem;
		background: rgb(5 8 22 / 0.72);
		box-shadow: 0 14px 32px rgb(2 6 23 / 0.28);
	}
	.top-navigation nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.presenter-navigation {
		display: contents;
	}
	/* Floating control dock, Mentimeter-style: pill row, icon-first, label on hover. */
	.session-toolbar {
		position: fixed;
		left: 50%;
		bottom: 0.75rem;
		transform: translateX(-50%);
		width: max-content;
		z-index: 1000;
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
		bottom: max(0.75rem, env(safe-area-inset-bottom));
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
	@media (max-width: 640px) {
		.session-screen:not(.presentation) {
			padding-bottom: 2rem;
		}

		.session-screen:not(.presentation) .session-toolbar {
			position: fixed;
			top: auto;
			left: 50%;
			right: auto;
			bottom: 0.5rem;
			width: max-content;
			max-width: calc(100vw - 1rem);
			transform: translateX(-50%);
			margin: 0;
			border-radius: 999px;
		}
	}
	/* Board dock floats in both normal and fullscreen views. */
	.session-screen.board-screen:not(.presentation) .session-toolbar {
		position: fixed;
		left: 50%;
		bottom: max(0.75rem, env(safe-area-inset-bottom));
		transform: translateX(-50%);
		width: max-content;
		max-width: calc(100vw - 1rem);
		margin: 0;
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
		overflow: hidden;
	}
	.presentation .stage-grid {
		transform: perspective(500px) rotateX(58deg) scale(1.02);
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
	}
	@media (prefers-reduced-motion: reduce) {
		.session-toolbar,
		.floating-control {
			transition: none;
		}
	}

	/* Game-show stage layer: loud on projector, calm under reduced motion. */
	.session-screen {
		position: relative;
		isolation: isolate;
		background:
			radial-gradient(circle at 15% 8%, rgb(34 211 238 / 0.2), transparent 25%),
			radial-gradient(circle at 86% 12%, rgb(244 114 182 / 0.18), transparent 28%),
			linear-gradient(135deg, #050816 0%, #11153b 52%, #190d32 100%);
	}
	.stage-beams,
	.stage-grid {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: -1;
	}
	.stage-beams {
		background:
			conic-gradient(
				from 210deg at 15% 0%,
				transparent 0 11%,
				rgb(34 211 238 / 0.15) 14%,
				transparent 23%
			),
			conic-gradient(
				from 130deg at 85% 0%,
				transparent 0 13%,
				rgb(244 114 182 / 0.14) 17%,
				transparent 27%
			);
		filter: blur(2px);
		animation: beamSweep 10s ease-in-out infinite alternate;
	}
	.stage-grid {
		inset: auto 0 0;
		height: 42%;
		background:
			linear-gradient(rgb(34 211 238 / 0.08) 1px, transparent 1px),
			linear-gradient(90deg, rgb(34 211 238 / 0.08) 1px, transparent 1px);
		background-size: 42px 42px;
		mask-image: linear-gradient(to top, black, transparent);
		transform: perspective(500px) rotateX(58deg) scale(1.35);
		transform-origin: bottom;
		animation: gridDrift 9s linear infinite;
	}
	.stage-header {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid rgb(255 255 255 / 0.12);
		padding-bottom: 1rem;
	}
	.stage-kicker,
	.prompt-label {
		margin: 0;
		color: #67e8f9;
		font-size: 0.7rem;
		font-weight: 1000;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		text-shadow: 0 0 15px rgb(34 211 238 / 0.55);
	}
	.stage-code {
		margin: 0.25rem 0 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: clamp(1.8rem, 5vw, 3.2rem);
		font-weight: 1000;
		letter-spacing: 0.2em;
		line-height: 1;
		color: white;
		text-shadow: 0 0 26px rgb(168 85 247 / 0.55);
	}
	.stage-status {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin: 0;
		border: 1px solid rgb(255 255 255 / 0.14);
		border-radius: 999px;
		background: rgb(255 255 255 / 0.08);
		padding: 0.65rem 0.9rem;
		color: rgb(226 232 240 / 0.8);
		font-size: 0.78rem;
		font-weight: 800;
		backdrop-filter: blur(12px);
	}
	.stage-status span,
	.live-badge span {
		height: 0.55rem;
		width: 0.55rem;
		border-radius: 999px;
		background: #34d399;
		box-shadow: 0 0 14px rgb(52 211 153 / 0.9);
	}
	.game-stage {
		position: relative;
		border: 1px solid rgb(103 232 249 / 0.22);
		background: linear-gradient(145deg, rgb(15 23 42 / 0.88), rgb(49 46 129 / 0.68));
		box-shadow:
			0 24px 80px rgb(2 6 23 / 0.5),
			inset 0 1px 0 rgb(255 255 255 / 0.1);
	}
	.stage-topline,
	.stage-badges,
	.answer-row,
	.tally-header,
	.prompt-deck,
	.stage-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.live-badge,
	.round-badge,
	.audience-meter {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border-radius: 999px;
		padding: 0.5rem 0.75rem;
		font-size: 0.7rem;
		font-weight: 1000;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.live-badge {
		border: 1px solid rgb(251 113 133 / 0.55);
		background: rgb(244 63 94 / 0.18);
		color: #fecdd3;
	}
	.live-badge span {
		background: #fb7185;
		box-shadow: 0 0 15px rgb(251 113 133 / 0.9);
		animation: liveBlink 900ms ease-in-out infinite alternate;
	}
	.round-badge {
		border: 1px solid rgb(34 211 238 / 0.25);
		background: rgb(34 211 238 / 0.12);
		color: #a5f3fc;
	}
	.audience-meter {
		border: 1px solid rgb(251 191 36 / 0.25);
		background: rgb(251 191 36 / 0.12);
		color: #fde68a;
		letter-spacing: 0.04em;
	}
	.audience-meter span {
		font-size: 1.25rem;
		line-height: 1;
	}
	.prompt-deck {
		align-items: flex-end;
		margin-top: clamp(1.25rem, 4vh, 3rem);
		gap: 1.25rem;
	}
	.prompt-deck > div:first-child {
		min-width: 0;
		flex: 1 1 28rem;
	}
	.prompt-deck h1 {
		margin: 0.65rem 0 0;
		max-width: 56rem;
		font-size: clamp(2rem, 5vw, 5rem);
		font-weight: 1000;
		letter-spacing: -0.06em;
		line-height: 0.95;
		text-wrap: balance;
		text-shadow: 0 0 35px rgb(168 85 247 / 0.42);
		animation: promptEnter 650ms cubic-bezier(0.2, 0.85, 0.2, 1);
	}
	.stage-metrics {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.answer-meter span {
		color: #fde68a;
	}
	.stage-options {
		margin-top: clamp(1.25rem, 3vh, 2.5rem);
	}
	.option-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: clamp(0.75rem, 2vw, 1.25rem);
		margin-top: 0.9rem;
	}
	.option-card {
		--option-a: rgb(14 165 233 / 0.94);
		--option-b: rgb(37 99 235 / 0.88);
		display: grid;
		min-height: clamp(6.5rem, 15vh, 10rem);
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: clamp(0.8rem, 2vw, 1.5rem);
		border: 1px solid rgb(255 255 255 / 0.2);
		border-radius: 1.35rem;
		background: linear-gradient(135deg, var(--option-a), var(--option-b));
		padding: clamp(1rem, 2.5vw, 2rem);
		box-shadow:
			0 18px 42px rgb(2 6 23 / 0.35),
			inset 0 1px 0 rgb(255 255 255 / 0.2);
	}
	.option-card:nth-child(2) {
		--option-a: rgb(168 85 247 / 0.94);
		--option-b: rgb(236 72 153 / 0.84);
	}
	.option-card:nth-child(3) {
		--option-a: rgb(16 185 129 / 0.92);
		--option-b: rgb(20 184 166 / 0.8);
	}
	.option-card:nth-child(4) {
		--option-a: rgb(245 158 11 / 0.94);
		--option-b: rgb(249 115 22 / 0.82);
	}
	.option-letter,
	.answer-letter {
		display: grid;
		height: clamp(2.7rem, 6vw, 4rem);
		width: clamp(2.7rem, 6vw, 4rem);
		place-items: center;
		border: 1px solid rgb(255 255 255 / 0.3);
		border-radius: 1rem;
		background: rgb(2 6 23 / 0.22);
		color: white;
		font-size: clamp(1.25rem, 3vw, 2rem);
		font-weight: 1000;
		box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.2);
	}
	.option-text {
		min-width: 0;
		font-size: clamp(1.2rem, 3vw, 2.4rem);
		font-weight: 1000;
		line-height: 1.05;
		overflow-wrap: anywhere;
		text-shadow: 0 2px 12px rgb(2 6 23 / 0.25);
	}
	.tally-stage {
		margin-top: clamp(1.25rem, 4vh, 2.5rem);
		border-top: 1px solid rgb(255 255 255 / 0.12);
		padding-top: 1.25rem;
	}
	.answer-bar-card {
		--option-a: rgb(14 165 233 / 0.92);
		--option-b: rgb(37 99 235 / 0.86);
		background: linear-gradient(135deg, rgb(15 23 42 / 0.92), rgb(15 23 42 / 0.68));
	}
	.answer-bar-card:nth-child(2) {
		--option-a: rgb(168 85 247 / 0.92);
		--option-b: rgb(236 72 153 / 0.8);
	}
	.answer-bar-card:nth-child(3) {
		--option-a: rgb(16 185 129 / 0.9);
		--option-b: rgb(20 184 166 / 0.76);
	}
	.answer-bar-card:nth-child(4) {
		--option-a: rgb(245 158 11 / 0.92);
		--option-b: rgb(249 115 22 / 0.78);
	}
	.answer-bar-card .answer-letter {
		background: linear-gradient(135deg, var(--option-a), var(--option-b));
	}
	.answer-bar-card .answer-fill {
		background: linear-gradient(90deg, var(--option-a), var(--option-b));
		box-shadow: 0 0 20px var(--option-a);
	}
	.tally-header h2 {
		margin: 0.25rem 0 0;
		font-size: clamp(1.4rem, 3vw, 2.2rem);
		font-weight: 1000;
		letter-spacing: -0.04em;
	}
	.answer-orb {
		display: grid;
		height: 4.2rem;
		width: 4.2rem;
		place-items: center;
		border: 1px solid rgb(251 191 36 / 0.5);
		border-radius: 999px;
		background: radial-gradient(
			circle,
			rgb(251 191 36 / 0.35),
			rgb(168 85 247 / 0.18) 65%,
			transparent 66%
		);
		color: #fef3c7;
		font-size: 1.5rem;
		font-weight: 1000;
		box-shadow: 0 0 30px rgb(251 191 36 / 0.25);
		animation: orbPulse 1.6s ease-in-out infinite alternate;
	}
	.answer-bars {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
		margin-top: 1.25rem;
		pointer-events: none;
	}
	.answer-bar-card {
		border: 1px solid rgb(255 255 255 / 0.1);
		border-radius: 1rem;
		background: rgb(2 6 23 / 0.3);
		padding: 0.75rem;
		animation: barEnter 500ms ease both;
	}
	.answer-row {
		justify-content: flex-start;
		font-size: clamp(0.95rem, 2vw, 1.2rem);
		font-weight: 900;
	}
	.answer-letter {
		flex: 0 0 auto;
	}
	.answer-label {
		min-width: 0;
		flex: 1;
		overflow-wrap: anywhere;
	}
	.answer-row strong {
		color: #fde68a;
	}
	.answer-track {
		height: 0.8rem;
		margin-top: 0.65rem;
		overflow: hidden;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.09);
	}
	.answer-fill {
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, #22d3ee, #a855f7, #fbbf24);
		box-shadow: 0 0 20px rgb(34 211 238 / 0.65);
		transition: width 700ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.stage-actions {
		position: relative;
		z-index: 5;
		justify-content: flex-start;
		margin-top: 1.25rem;
	}
	@keyframes beamSweep {
		from {
			transform: translateX(-3%) rotate(-2deg) scale(1.03);
		}
		to {
			transform: translateX(3%) rotate(2deg) scale(1.08);
		}
	}
	@keyframes gridDrift {
		to {
			background-position:
				0 42px,
				42px 0;
		}
	}
	@keyframes liveBlink {
		from {
			opacity: 0.45;
			transform: scale(0.85);
		}
		to {
			opacity: 1;
			transform: scale(1.15);
		}
	}
	@keyframes promptEnter {
		from {
			opacity: 0;
			transform: translateY(24px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	@keyframes orbPulse {
		to {
			transform: scale(1.08);
		}
	}
	@keyframes barEnter {
		from {
			opacity: 0;
			transform: translateX(-16px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}
	@media (max-width: 640px) {
		.session-screen {
			padding: 0.8rem 0.75rem 8.5rem;
		}
		.stage-header {
			align-items: flex-start;
			padding-bottom: 0.75rem;
		}
		.stage-status {
			width: 100%;
			justify-content: center;
		}
		.game-stage {
			border-radius: 1.35rem;
			padding: 1rem;
		}
		.prompt-deck {
			align-items: stretch;
		}
		.prompt-deck h1 {
			font-size: clamp(1.85rem, 9vw, 3rem);
		}
		.prompt-deck :global(.timer) {
			align-self: flex-start;
		}
		.answer-orb {
			height: 3.2rem;
			width: 3.2rem;
			font-size: 1.1rem;
		}
		.answer-bars {
			grid-template-columns: 1fr;
		}
		.stage-actions .control {
			flex: 1 1 100%;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.stage-beams,
		.stage-grid,
		.live-badge span,
		.answer-orb,
		.prompt-deck h1,
		.answer-bar-card {
			animation: none;
		}
		.answer-fill {
			transition: none;
		}
	}
	/* Board uses a calm, full-bleed canvas; quiz keeps its game-show stage. */
	.board-screen.presentation .session-toolbar {
		background: #0d3130;
		transition: none;
	}
	.board-screen.presentation .session-toolbar.visible {
		opacity: 1;
	}
	.board-screen.presentation .floating-control {
		color: white;
	}
	.board-screen :global(.column-content) {
		padding-bottom: 6rem;
	}
	.session-screen.board-screen {
		background:
			radial-gradient(ellipse at 95% 0%, #52715266, transparent 55%),
			linear-gradient(135deg, #163b36, #214c48 55%, #173c45);
	}
	.board-screen .stage-beams,
	.board-screen .stage-grid {
		display: none;
	}
	.board-screen .stage-header {
		border: 0;
		padding-bottom: 0.5rem;
		gap: 0.5rem;
	}
	.board-screen .stage-header > div {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
	}
	.board-screen .stage-code {
		font-size: 1.15rem;
		letter-spacing: 0.12em;
		margin: 0;
		text-shadow: none;
		padding: 0.4rem 0.65rem;
		background: #ffffff15;
		border-radius: 0.5rem;
	}
	.board-screen .stage-kicker {
		color: #c6e9db;
		text-shadow: none;
	}
	.board-screen :global(.live-board) {
		background: transparent;
		border-radius: 0;
		padding: 0;
	}
	.board-screen :global(.live-board h1) {
		font-size: clamp(1.5rem, 2.5vw, 2.5rem);
		margin: 0.8rem 0 0;
	}
	.stage-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 0.65rem;
		min-width: 0;
	}
	.board-toolbar-host {
		min-width: 0;
		max-width: 100%;
	}
	.board-screen .stage-header {
		flex-wrap: wrap;
	}
	.board-screen:not(.presentation) {
		padding-bottom: 7rem;
	}
</style>
