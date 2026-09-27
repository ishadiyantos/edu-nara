<script lang="ts">
	import { Container } from '$components/ui';
	import SessionStatus from '$lib/components/SessionStatus.svelte';
	import ChoicePlayer from '$lib/components/poll/ChoicePlayer.svelte';
	let { data } = $props();
</script>

<svelte:head><title>{data.snapshot.title} — Edu Nara</title></svelte:head>

<main
	class="min-h-dvh overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] py-6 sm:py-10 text-white relative"
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

	<Container size="narrow" class="relative z-10">
		<a
			class="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white/80 backdrop-blur-md transition hover:bg-white/20 hover:text-white border border-white/10 shadow-sm"
			href="/"
		>
			← Exit session <span class="sr-only">Keluar dari sesi</span>
		</a>

		{#if data.snapshot.state === 'open' && data.questions.length}
			<div class="mb-5 flex items-end justify-between gap-4">
				<div>
					<p class="text-xs font-black uppercase tracking-[0.22em] text-[#38bdf8]">
						{data.snapshot.code} · SESSION LIVE <span class="sr-only">sesi berlangsung</span>
					</p>
					<h1 class="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl drop-shadow-sm">
						{data.snapshot.title}
					</h1>
				</div>
				<span
					class="hidden rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-white/80 backdrop-blur-md sm:inline-block shadow-sm"
				>
					One screen, one challenge <span class="sr-only">Satu layar, satu tantangan</span>
				</span>
			</div>
			<ChoicePlayer
				sessionCode={data.snapshot.code}
				sessionId={data.snapshot.id}
				questions={data.questions}
				responses={data.responses}
				initialScore={data.initialScore}
			/>
		{:else}
			<SessionStatus snapshot={data.snapshot} />
		{/if}
	</Container>
</main>
