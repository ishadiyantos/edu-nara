<script lang="ts">
	import BoardLive from '$lib/components/board/BoardLive.svelte';
	import { Container } from '$components/ui';
	import SessionStatus from '$lib/components/SessionStatus.svelte';
	import ChoicePlayer from '$lib/components/poll/ChoicePlayer.svelte';
	import WordcloudPlayer from '$lib/components/poll/WordcloudPlayer.svelte';
	let { data } = $props();
	let studentToolbarHost = $state<HTMLElement | null>(null);
</script>

<svelte:head><title>{data.snapshot.title} — Edu Nara</title></svelte:head>

<main
	class:student-board={data.activityType === 'board'}
	class="relative min-h-dvh overflow-x-hidden bg-[#050816] py-4 text-white sm:py-10"
	style="padding-top: max(1rem, env(safe-area-inset-top)); padding-bottom: max(1rem, env(safe-area-inset-bottom));"
>
	<!-- Dynamic game arena background glow elements -->
	<div
		class="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-purple-600/20 blur-3xl"
		aria-hidden="true"
	></div>
	<div
		class="pointer-events-none absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl"
		aria-hidden="true"
	></div>
	<div
		class="pointer-events-none absolute left-1/4 bottom-10 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl"
		aria-hidden="true"
	></div>

	<div
		class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_12%,rgba(34,211,238,0.32),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(244,114,182,0.24),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.2),rgba(49,46,129,0.72))]"
		aria-hidden="true"
	></div>
	<div
		class="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-amber-300"
		aria-hidden="true"
	></div>
	<Container
		size="app"
		class={data.activityType === 'board'
			? 'relative z-10 board-container'
			: 'relative z-10 max-w-5xl'}
	>
		{#if data.activityType !== 'board'}<a
				class="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-white/10 px-4 py-2 text-sm font-black text-white/80 shadow-[0_0_24px_rgba(34,211,238,0.18)] backdrop-blur-md transition hover:bg-white/20 hover:text-white sm:mb-6"
				href="/"
			>
				← Exit session <span class="sr-only">Keluar dari sesi</span>
			</a>{/if}

		{#if data.activityType === 'board' && data.board}
			<div class="student-board-header">
				<div class="student-board-copy">
					<div class="student-board-identity">
						<p>Edu Nara · Papan diskusi</p>
						<strong>{data.snapshot.code}</strong>
					</div>
					<h1 class="student-board-title">{data.snapshot.title}</h1>
				</div>
				<div class="student-board-actions">
					<a class="student-board-pill" href="/" aria-label="Exit session">← Exit session</a>
					<div class="student-board-toolbar-host" bind:this={studentToolbarHost}></div>
					<p class="student-board-status">
						<span aria-hidden="true"></span><b>{data.snapshot.count}</b> peserta · Live · {data
							.snapshot.state}
					</p>
				</div>
			</div>
			<BoardLive
				sessionId={data.snapshot.id}
				sessionCode={data.snapshot.code}
				initial={data.board}
				title={data.snapshot.title}
				toolbarHost={studentToolbarHost}
			/>
		{:else if data.snapshot.state === 'open' && data.questions.length}
			<div class="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
				<div>
					<p
						class="text-xs font-black uppercase tracking-[0.22em] text-[#67e8f9] drop-shadow-[0_0_12px_rgba(34,211,238,0.55)]"
					>
						{data.snapshot.code} · SESSION LIVE <span class="sr-only">sesi berlangsung</span>
					</p>
					<h1
						class="mt-2 text-2xl font-black tracking-[-0.04em] text-white drop-shadow-[0_0_24px_rgba(168,85,247,0.32)] sm:text-4xl"
					>
						{data.snapshot.title}
					</h1>
				</div>
				<span
					class="hidden rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-white/80 backdrop-blur-md sm:inline-block shadow-sm"
				>
					One screen, one challenge <span class="sr-only">Satu layar, satu tantangan</span>
				</span>
			</div>
			{#if data.activityType === 'wordcloud'}
				<WordcloudPlayer
					sessionCode={data.snapshot.code}
					sessionId={data.snapshot.id}
					questions={data.questions}
					activeQuestionId={data.snapshot.activeQuestionId}
					responses={data.responses}
					participantName={data.participantName}
				/>
			{:else}
				<ChoicePlayer
					sessionCode={data.snapshot.code}
					sessionId={data.snapshot.id}
					questions={data.questions}
					responses={data.responses}
					snapshot={data.snapshot}
					participantName={data.participantName}
				/>
			{/if}
		{:else}
			<SessionStatus snapshot={data.snapshot} />
		{/if}
	</Container>
</main>

<style>
	.student-board {
		background:
			radial-gradient(ellipse at 95% 0%, #52715266, transparent 55%),
			linear-gradient(135deg, #163b36, #214c48 55%, #173c45);
	}
	.student-board > div[aria-hidden='true'] {
		display: none;
	}
	.student-board :global(.board-container) {
		width: 100%;
		max-width: none;
		padding-inline: clamp(0.75rem, 2vw, 2rem);
	}
	.student-board :global(.live-board) {
		padding: 0;
		border-radius: 0;
		background: transparent;
		min-height: calc(100dvh - 6rem);
	}
	.student-board :global(.column-content) {
		padding-bottom: 6rem;
	}
	.student-board-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		padding: 0.25rem 0 0.5rem;
		color: #c6e9db;
	}
	.student-board-copy {
		min-width: 0;
	}
	.student-board-identity {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-width: 0;
	}
	.student-board-identity p {
		margin: 0;
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.22em;
		text-transform: uppercase;
	}
	.student-board-identity strong {
		padding: 0.4rem 0.65rem;
		border-radius: 0.5rem;
		background: #ffffff15;
		color: white;
		font:
			900 1.15rem/1 ui-monospace,
			monospace;
		letter-spacing: 0.12em;
	}
	.student-board-title {
		margin: 0.35rem 0 0;
		max-width: min(58rem, 65vw);
		color: white;
		font-size: clamp(1.45rem, 3vw, 3rem);
		font-weight: 950;
		line-height: 1;
		letter-spacing: -0.04em;
		overflow-wrap: anywhere;
	}
	.student-board-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 0.5rem;
		min-width: 0;
	}
	.student-board-pill,
	.student-board-status {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-height: 2.75rem;
		margin: 0;
		border: 1px solid rgb(255 255 255 / 0.14);
		border-radius: 999px;
		background: rgb(255 255 255 / 0.08);
		padding: 0.65rem 0.9rem;
		color: rgb(226 232 240 / 0.86);
		font-size: 0.78rem;
		font-weight: 800;
		white-space: nowrap;
	}
	.student-board-pill {
		color: white;
		text-decoration: none;
	}
	.student-board-pill:hover {
		background: rgb(255 255 255 / 0.16);
	}
	.student-board-status span {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
		background: #34d399;
		box-shadow: 0 0 14px rgb(52 211 153 / 0.9);
	}
	.student-board-toolbar-host {
		display: contents;
	}
	.student-board :global(.live-board h1) {
		display: none;
	}
	@media (max-width: 720px) {
		.student-board-header {
			align-items: flex-start;
		}
		.student-board-actions {
			width: 100%;
			justify-content: flex-start;
		}
		.student-board-status {
			margin-left: auto;
		}
	}
</style>
