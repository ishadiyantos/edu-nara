<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { Button, Input, Container, Card } from '$components/ui';
	import { joinSchema } from '$lib/validation';
	let { data, form } = $props();
	let code = $state(untrack(() => data.code));
	let column = $state(untrack(() => data.column));
	let displayName = $state('');
	let validation = $state('');
	let loading = $state(false);
</script>

<svelte:head><title>Join — Edu Nara</title></svelte:head>
<main class="min-h-dvh bg-bg py-10">
	<Container size="narrow"
		><a class="link mb-6 inline-block" href="/">← Back</a><Card
			><h1 class="mb-4 text-2xl font-bold">Introduce yourself</h1>
			<form
				method="POST"
				use:enhance={({ cancel }) => {
					const result = joinSchema.safeParse({
						code,
						displayName,
						...(column ? { columnId: column } : {})
					});
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
				<Input label="Session code" name="code" bind:value={code} required maxlength={6} />
				{#if column}<input type="hidden" name="columnId" value={column} />{/if}
				<Input
					label="Display name"
					name="displayName"
					bind:value={displayName}
					required
					maxlength={24}
					autocomplete="nickname"
					hint="A nickname is fine. 2–24 characters."
				/>
				{#if validation || form?.message}<p role="alert" class="text-danger">
						{validation || form?.message}
					</p>{/if}<Button type="submit" {loading}>Join session</Button>
			</form></Card
		>
		<p class="mt-6 text-sm text-muted">
			By joining, you agree to keep the conversation respectful. Your name is stored for this
			session; it is not a password for recovering access.
		</p></Container
	>
</main>
