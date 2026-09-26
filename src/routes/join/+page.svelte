<script lang="ts">
	import { Button, Input, Container, Card, Badge } from '$components/ui';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let name = $state('');
	let error = $state('');
	let code = $derived(($page.url.searchParams.get('code') || 'ABC7XK').toUpperCase());
	const isScan = $derived($page.url.searchParams.get('scan') === '1');

	function submit(e?: SubmitEvent) {
		e?.preventDefault();
		const trimmed = name.trim();
		if (trimmed.length < 2) {
			error = 'Nama minimal 2 karakter.';
			return;
		}
		if (trimmed.length > 24) {
			error = 'Nama maksimal 24 karakter.';
			return;
		}
		error = '';
		// Fase 0: langsung ke waiting room mock
		goto(`/play/${code}`);
	}
</script>

<svelte:head>
	<title>Bergabung ke {code} — Edu Nara</title>
</svelte:head>

<main class="min-h-dvh bg-bg pb-16 pt-10 sm:pt-16">
	<Container size="narrow">
		<div class="mb-6 flex items-center justify-between">
			<a class="link text-sm font-medium" href="/">← Kembali</a>
			<Badge tone="info" dot>Sesi {code}</Badge>
		</div>

		<Card>
			<h1 class="mb-2 text-2xl font-bold">Perkenalkan dirimu</h1>
			<p class="mb-6 text-muted">
				{isScan ? 'QR terdeteksi.' : 'Isi nama tampilan agar teman-temanmu bisa mengenalimu.'}
			</p>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					submit(e);
				}}
				class="flex flex-col gap-6"
				novalidate
			>
				<Input
					label="Nama tampilan"
					bind:value={name}
					placeholder="Contoh: Isha D."
					maxlength={24}
					hint="Boleh nama panggilan. Maksimal 24 karakter."
					{error}
					required
					autocomplete="nickname"
				/>
				<Button type="submit" block size="lg">Bergabung</Button>
			</form>
		</Card>

		<p class="mt-6 text-center text-xs text-muted">
			Dengan bergabung kamu setuju untuk menjaga percakapan tetap sopan.
		</p>
	</Container>
</main>
