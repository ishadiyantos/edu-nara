<script lang="ts">
	import { Card, Input, Button, Container } from '$components/ui';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function submit(e?: SubmitEvent) {
		e?.preventDefault();
		if (!email || !password) {
			error = 'Email dan kata sandi wajib diisi.';
			return;
		}
		loading = true;
		// Fase 0: langsung ke dashboard mock
		await new Promise((r) => setTimeout(r, 400));
		loading = false;
		goto('/admin');
	}
</script>

<svelte:head>
	<title>Masuk admin — Edu Nara</title>
</svelte:head>

<main class="min-h-dvh bg-bg pb-16 pt-10 sm:pt-16">
	<Container size="narrow">
		<a class="link mb-6 inline-block text-sm font-medium" href="/">← Kembali</a>
		<Card>
			<h1 class="mb-1 text-2xl font-bold">Masuk sebagai admin</h1>
			<p class="mb-6 text-muted">Dosen/pemilik platform.</p>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					submit(e);
				}}
				class="flex flex-col gap-5"
				novalidate
			>
				<Input
					label="Email"
					type="email"
					bind:value={email}
					autocomplete="email"
					required
					placeholder="admin@example.com"
				/>
				<Input
					label="Kata sandi"
					type="password"
					bind:value={password}
					autocomplete="current-password"
					required
				/>
				{#if error}
					<p role="alert" class="text-sm font-medium text-danger">{error}</p>
				{/if}
				<Button type="submit" block size="lg" {loading}>
					{loading ? 'Memeriksa…' : 'Masuk'}
				</Button>
			</form>
		</Card>
	</Container>
</main>
