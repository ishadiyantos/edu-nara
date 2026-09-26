<script lang="ts">
	import { Button, CodeInput, Container, Card } from '$components/ui';
	import { goto } from '$app/navigation';

	let code = $state('');
	let error = $state('');

	function submit(e?: SubmitEvent) {
		e?.preventDefault();
		if (code.length !== 6) {
			error = 'Kode sesi harus 6 karakter.';
			return;
		}
		error = '';
		goto(`/join?code=${encodeURIComponent(code)}`);
	}
</script>

<svelte:head>
	<title>Edu Nara — Masuk kelas</title>
</svelte:head>

<main class="min-h-dvh bg-gradient-to-b from-primary-soft via-bg to-bg pb-16 pt-10 sm:pt-16">
	<Container size="narrow">
		<header class="mb-8 text-center">
			<div class="mb-3 inline-flex items-center gap-2">
				<span
					class="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white shadow-lift"
					aria-hidden="true"
				>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
						<path
							d="M4 7l8-4 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4"
							stroke="currentColor"
							stroke-width="2"
							stroke-linejoin="round"
						/>
					</svg>
				</span>
				<h1 class="text-2xl font-black tracking-tight">Edu Nara</h1>
			</div>
			<p class="text-muted">Masuk ke sesi kelas dengan kode dari dosen.</p>
		</header>

		<Card>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					submit(e);
				}}
				class="flex flex-col gap-6"
				novalidate
			>
				<CodeInput bind:value={code} />
				{#if error}
					<p role="alert" class="text-sm font-medium text-danger">{error}</p>
				{/if}
				<div class="flex flex-col gap-3">
					<Button type="submit" block size="lg">Masuk</Button>
					<Button variant="ghost" block size="md" href="/join?scan=1">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path
								d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M8 8h8v8H8z"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						Pindai QR
					</Button>
				</div>
			</form>
		</Card>

		<p class="mt-8 text-center text-sm text-muted">
			Dosen? <a class="link font-semibold" href="/admin/login">Masuk sebagai admin</a>
		</p>
	</Container>
</main>
