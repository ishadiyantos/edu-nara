<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button, CodeInput, Container } from '$components/ui';

	let code = $state('');
	let error = $state('');

	function submit(e?: SubmitEvent) {
		e?.preventDefault();
		if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
			error = 'Kode sesi harus 6 karakter.';
			return;
		}
		error = '';
		goto(`/join?code=${encodeURIComponent(code)}`);
	}
</script>

<svelte:head>
	<title>Edu Nara — Masuk kelas</title>
	<meta
		name="description"
		content="Masuk ke aktivitas kelas game-show interaktif dengan kode sesi dosen."
	/>
</svelte:head>

<main
	class="join-page relative min-h-dvh overflow-x-hidden bg-[#081127] text-white"
	data-testid="join-shell"
>
	<div
		class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(34,211,238,0.32),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(168,85,247,0.28),transparent_28%),radial-gradient(circle_at_55%_88%,rgba(251,191,36,0.22),transparent_30%)]"
		aria-hidden="true"
	></div>
	<div
		class="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-amber-300"
		aria-hidden="true"
	></div>

	<Container size="app" class="relative flex min-h-dvh flex-col">
		<div class="flex min-h-dvh flex-col" data-testid="game-show-landing">
			<header
				class="flex min-h-16 items-center justify-between pb-3 pt-4 sm:py-6"
				style="padding-top: max(1rem, env(safe-area-inset-top));"
			>
				<a href="/" class="flex items-center gap-2.5" aria-label="Edu Nara beranda">
					<span
						class="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-200/40 bg-cyan-300/15 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.35)]"
						aria-hidden="true"
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
							<path
								d="M4 7l8-4 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4"
								stroke="currentColor"
								stroke-width="2"
								stroke-linejoin="round"
							/>
						</svg>
					</span>
					<span class="text-lg font-black tracking-tight text-white">Edu Nara</span>
				</a>
				<a
					class="text-sm font-bold text-cyan-100 underline-offset-4 hover:underline"
					href="/admin/login">Masuk sebagai dosen <span aria-hidden="true">→</span></a
				>
			</header>

			<section class="flex flex-1 items-center justify-center py-3" data-testid="landing-hero">
				<div class="grid w-full items-center gap-6 lg:grid-cols-[1fr_28rem]">
					<div class="text-center lg:text-left">
						<p
							class="mx-auto inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-white/10 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.22em] text-cyan-100 lg:mx-0"
						>
							<span class="h-2 w-2 animate-pulse rounded-full bg-rose-300" aria-hidden="true"
							></span>
							Live classroom game-show
						</p>
						<h1
							class="mx-auto mt-4 max-w-2xl text-4xl font-black leading-[0.95] tracking-[-0.055em] text-white sm:text-6xl lg:mx-0 lg:text-7xl"
						>
							Masuk ke kelasmu.
						</h1>
						<p class="mx-auto mt-4 max-w-xl text-sm leading-6 text-cyan-50/80 sm:text-lg lg:mx-0">
							Masukkan kode sesi dari dosenmu untuk mulai. Ikuti kuis, word cloud, dan aktivitas
							kelas dengan tampilan baru yang lebih ramai.
						</p>
						<div class="mt-5 hidden grid-cols-3 gap-3 text-center text-xs font-bold sm:grid">
							<div
								class="rounded-2xl border border-white/10 bg-white/10 p-3 shadow-[0_0_18px_rgba(34,211,238,0.18)]"
							>
								<span class="block text-xl">🎮</span> Game-show
							</div>
							<div
								class="rounded-2xl border border-white/10 bg-white/10 p-3 shadow-[0_0_18px_rgba(168,85,247,0.18)]"
							>
								<span class="block text-xl">⚡</span> Real-time
							</div>
							<div
								class="rounded-2xl border border-white/10 bg-white/10 p-3 shadow-[0_0_18px_rgba(251,191,36,0.18)]"
							>
								<span class="block text-xl">🏆</span> Leaderboard
							</div>
						</div>
					</div>

					<div
						class="mx-auto w-full max-w-md rounded-[2rem] border border-white/15 bg-white/10 p-4 text-left shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur sm:p-6"
						data-testid="activity-preview"
					>
						<div class="mb-4 flex items-center justify-between gap-3">
							<div>
								<p class="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
									Student pass
								</p>
								<p class="mt-1 text-sm text-white/70">Siap masuk kelas</p>
							</div>
							<span
								class="rounded-full bg-emerald-300/15 px-3 py-1 text-xs font-black text-emerald-100"
								>ONLINE</span
							>
						</div>
						<form
							class="flex flex-col gap-4"
							onsubmit={(e) => {
								e.preventDefault();
								submit(e);
							}}
							novalidate
						>
							<div
								class="rounded-2xl bg-white p-4 text-slate-900 shadow-[0_0_30px_rgba(34,211,238,0.18)]"
							>
								<CodeInput bind:value={code} label="Kode sesi" />
							</div>
							{#if error}
								<p role="alert" class="text-sm font-semibold text-rose-200">{error}</p>
							{/if}
							<Button
								type="submit"
								block
								size="lg"
								ariaLabel="Masuk"
								class="!bg-amber-300 !text-slate-950 hover:!shadow-[0_0_26px_rgba(251,191,36,0.55)]"
							>
								Masuk ke kelas <span aria-hidden="true">→</span>
							</Button>
							<Button
								variant="ghost"
								block
								size="md"
								disabled
								class="!border-white/20 !text-white/70"
							>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
									<path
										d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M8 8h8v8H8z"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
								Pindai QR belum tersedia
							</Button>
						</form>
						<p
							class="mt-4 border-t border-white/10 pt-3 text-center text-xs leading-5 text-white/60"
						>
							Tidak perlu membuat akun. Gunakan nama panggilan yang mudah dikenali dosen.
						</p>
					</div>
				</div>
			</section>
		</div>
	</Container>
</main>
