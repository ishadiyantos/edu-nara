<script lang="ts">
	import { Container } from '$components/ui';
	import SessionStatus from '$lib/components/SessionStatus.svelte';
	import ChoicePlayer from '$lib/components/poll/ChoicePlayer.svelte';
	import WordcloudPlayer from '$lib/components/poll/WordcloudPlayer.svelte';
	let { data } = $props();
</script>

<svelte:head><title>{data.snapshot.title} — Edu Nara</title></svelte:head>

<main
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

	<Container size="app" class="relative z-10 max-w-5xl">
		<a
			class="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-white/10 px-4 py-2 text-sm font-black text-white/80 shadow-[0_0_24px_rgba(34,211,238,0.18)] backdrop-blur-md transition hover:bg-white/20 hover:text-white sm:mb-6"
			href="/"
		>
			← Exit session <span class="sr-only">Keluar dari sesi</span>
		</a>

		{#if data.snapshot.state === 'open' && data.questions.length}
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
				/>
			{:else}
				<ChoicePlayer
					sessionCode={data.snapshot.code}
					sessionId={data.snapshot.id}
					questions={data.questions}
					responses={data.responses}
					snapshot={data.snapshot}
				/>
			{/if}
		{:else}
			<SessionStatus snapshot={data.snapshot} />
		{/if}
	</Container>
</main>
