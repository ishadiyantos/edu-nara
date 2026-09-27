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
	<meta name="description" content="Masuk ke aktivitas kelas dengan kode sesi dari dosen." />
</svelte:head>

<main class="join-page min-h-dvh overflow-hidden bg-bg" data-testid="join-shell">
	<Container size="app" class="flex min-h-dvh flex-col">
		<header class="flex items-center justify-between py-5 sm:py-7">
			<a href="/" class="flex items-center gap-2.5" aria-label="Edu Nara beranda">
				<span
					class="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white shadow-lift"
					aria-hidden="true"
				>
					<svg width="19" height="19" viewBox="0 0 24 24" fill="none">
						<path
							d="M4 7l8-4 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4"
							stroke="currentColor"
							stroke-width="2"
							stroke-linejoin="round"
						/>
					</svg>
				</span>
				<span class="text-lg font-black tracking-tight text-primary">Edu Nara</span>
			</a>
			<a class="link text-sm font-semibold" href="/admin/login"
				>Masuk sebagai dosen <span aria-hidden="true">→</span></a
			>
		</header>

		<section class="flex flex-1 items-center justify-center py-6" data-testid="landing-hero">
			<div class="w-full max-w-md text-center">
				<p class="eyebrow">Ruang belajar interaktif</p>
				<h1 class="mt-3 text-3xl font-black tracking-[-0.04em] text-primary sm:text-5xl">
					Masuk ke kelasmu.
				</h1>
				<p class="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted sm:text-base">
					Masukkan kode sesi dari dosenmu untuk mulai.
				</p>

				<div
					class="surface mx-auto mt-7 w-full p-5 text-left sm:mt-8 sm:p-7"
					data-testid="activity-preview"
				>
					<form
						class="flex flex-col gap-5"
						onsubmit={(e) => {
							e.preventDefault();
							submit(e);
						}}
						novalidate
					>
						<div>
							<CodeInput bind:value={code} label="Kode sesi" />
						</div>
						{#if error}
							<p role="alert" class="-mt-2 text-sm font-semibold text-danger">{error}</p>
						{/if}
						<Button type="submit" block size="lg" ariaLabel="Masuk">
							Masuk ke kelas <span aria-hidden="true">→</span>
						</Button>
						<Button variant="ghost" block size="md" disabled>
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
					<p class="mt-5 border-t border-border pt-4 text-center text-xs leading-5 text-muted">
						Tidak perlu membuat akun. Gunakan nama panggilan yang mudah dikenali dosen.
					</p>
				</div>
			</div>
		</section>
	</Container>
</main>
