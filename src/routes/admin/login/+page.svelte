<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Input, Button, Container } from '$components/ui';
	let { form } = $props();
	let loading = $state(false);
</script>

<svelte:head><title>Masuk admin — Edu Nara</title></svelte:head>
<main class="min-h-dvh bg-bg py-10">
	<Container size="narrow"
		><a class="link mb-6 inline-block" href="/">← Kembali</a><Card>
			<h1 class="mb-2 text-2xl font-bold">Masuk sebagai admin</h1>
			<p class="mb-6 text-muted">Akun hanya disediakan pemilik platform.</p>
			<form
				method="POST"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						await update();
						loading = false;
					};
				}}
				class="flex flex-col gap-5"
			>
				<Input
					label="Email"
					name="email"
					type="email"
					required
					autocomplete="username"
					maxlength={254}
				/>
				<Input
					label="Kata sandi"
					name="password"
					type="password"
					required
					autocomplete="current-password"
					maxlength={256}
				/>
				{#if form?.message}<p role="alert" class="text-danger">{form.message}</p>{/if}
				<Button type="submit" {loading} block>Masuk</Button>
			</form></Card
		></Container
	>
</main>
