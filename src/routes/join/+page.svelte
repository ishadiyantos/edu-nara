<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { Button, Input, Container, Card } from '$components/ui';
	import { joinSchema } from '$lib/validation';
	let { data, form } = $props();
	let code = $state(untrack(() => data.code));
	let displayName = $state('');
	let validation = $state('');
	let loading = $state(false);
</script>

<svelte:head><title>Bergabung — Edu Nara</title></svelte:head>
<main class="min-h-dvh bg-bg py-10">
	<Container size="narrow"
		><a class="link mb-6 inline-block" href="/">← Kembali</a><Card
			><h1 class="mb-4 text-2xl font-bold">Perkenalkan dirimu</h1>
			<form
				method="POST"
				use:enhance={({ cancel }) => {
					const result = joinSchema.safeParse({ code, displayName });
					if (!result.success) {
						validation = result.error.issues[0].message;
						cancel();
						return;
					}
					validation = '';
					loading = true;
					return async ({ update }) => {
						await update();
						loading = false;
					};
				}}
				class="grid gap-5"
				novalidate
			>
				<Input label="Kode sesi" name="code" bind:value={code} required maxlength={6} />
				<Input
					label="Nama tampilan"
					name="displayName"
					bind:value={displayName}
					required
					maxlength={24}
					autocomplete="nickname"
					hint="Boleh nama panggilan. 2–24 karakter."
				/>
				{#if validation || form?.message}<p role="alert" class="text-danger">
						{validation || form?.message}
					</p>{/if}<Button type="submit" {loading}>Bergabung</Button>
			</form></Card
		>
		<p class="mt-6 text-sm text-muted">
			Dengan bergabung kamu setuju menjaga percakapan tetap sopan. Nama disimpan selama sesi; nama
			bukan kata sandi untuk memulihkan akses.
		</p></Container
	>
</main>
