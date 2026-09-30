<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Input, Button, Container } from '$components/ui';
	let { form } = $props();
	let loading = $state(false);
</script>

<svelte:head><title>Admin login — Edu Nara</title></svelte:head>
<main class="min-h-dvh bg-bg py-10">
	<Container size="narrow"
		><a class="link mb-6 inline-block" href="/">← Back</a><Card>
			<h1 class="mb-2 text-2xl font-bold">Admin login</h1>
			<p class="mb-6 text-muted">Accounts are issued by the platform owner.</p>
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
					label="Password"
					name="password"
					type="password"
					required
					autocomplete="current-password"
					maxlength={256}
				/>
				{#if form?.message}<p role="alert" class="text-danger">{form.message}</p>{/if}
				<Button type="submit" {loading} block>Log in</Button>
			</form></Card
		></Container
	>
</main>
