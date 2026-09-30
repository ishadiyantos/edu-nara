<script lang="ts">
	import '../../app.css';
	import {
		Container,
		Card,
		Button,
		Input,
		CodeInput,
		Badge,
		Modal,
		QRCode,
		Stepper,
		EmptyState,
		Toast
	} from '$components/ui';

	let modalOpen = $state(false);
	let toastOpen = $state(false);
	let code = $state('');
	let name = $state('');
</script>

<svelte:head>
	<title>Design system — Edu Nara</title>
</svelte:head>

<div class="min-h-dvh bg-bg py-8">
	<Container>
		<h1 class="mb-2 text-3xl font-black">Design Kitchen Sink</h1>
		<p class="mb-8 text-muted">
			All UI primitives. Test at 360/768/1440 px, with keyboard and reduced motion.
		</p>

		<section class="mb-10">
			<h2 class="mb-4 text-xl font-bold">Buttons</h2>
			<Card>
				<div class="flex flex-wrap gap-3">
					<Button variant="primary">Primary</Button>
					<Button variant="accent">Accent</Button>
					<Button variant="ghost">Ghost</Button>
					<Button variant="danger">Danger</Button>
					<Button disabled>Disabled</Button>
					<Button loading>Loading</Button>
				</div>
				<div class="mt-3 flex flex-wrap items-center gap-3">
					<Button size="sm">Small</Button>
					<Button size="md">Medium</Button>
					<Button size="lg">Large</Button>
				</div>
			</Card>
		</section>

		<section class="mb-10">
			<h2 class="mb-4 text-xl font-bold">Inputs</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				<Card>
					<Input label="Name" bind:value={name} placeholder="Isha D." hint="Display name" />
				</Card>
				<Card>
					<Input label="Email" type="email" error="Invalid email format" value="isha@" />
				</Card>
				<Card>
					<CodeInput bind:value={code} />
				</Card>
			</div>
		</section>

		<section class="mb-10">
			<h2 class="mb-4 text-xl font-bold">Badges</h2>
			<Card>
				<div class="flex flex-wrap gap-2">
					<Badge>Neutral</Badge>
					<Badge tone="success" dot>Live</Badge>
					<Badge tone="warning" dot>Draft</Badge>
					<Badge tone="danger">Closed</Badge>
					<Badge tone="info" dot>Connected</Badge>
				</div>
			</Card>
		</section>

		<section class="mb-10">
			<h2 class="mb-4 text-xl font-bold">Modal + Toast</h2>
			<Card>
				<div class="flex flex-wrap gap-3">
					<Button onclick={() => (modalOpen = true)}>Open modal</Button>
					<Button variant="accent" onclick={() => (toastOpen = true)}>Show toast</Button>
				</div>
			</Card>
			<Modal bind:open={modalOpen} title="Confirmation">
				<p class="mb-4">This sample dialog traps focus. Press Escape to close.</p>
				<div class="flex justify-end gap-2">
					<Button variant="ghost" onclick={() => (modalOpen = false)}>Cancel</Button>
					<Button onclick={() => (modalOpen = false)}>Confirm</Button>
				</div>
			</Modal>
			{#if toastOpen}
				<Toast tone="success" message="Toast muncul dengan aria-live!" />
			{/if}
		</section>

		<section class="mb-10">
			<h2 class="mb-4 text-xl font-bold">Stepper</h2>
			<Card>
				<div class="space-y-4">
					<Stepper current={1} total={5} />
					<Stepper current={3} total={5} />
					<Stepper current={5} total={5} />
				</div>
			</Card>
		</section>

		<section class="mb-10">
			<h2 class="mb-4 text-xl font-bold">QR Code</h2>
			<Card>
				<div class="flex flex-wrap gap-6">
					<QRCode value="ABC7XK" />
					<QRCode value="X9K2M4" size={160} />
				</div>
			</Card>
		</section>

		<section class="mb-10">
			<h2 class="mb-4 text-xl font-bold">Empty state</h2>
			<Card>
				<EmptyState
					title="No activities yet"
					description="Create your first activity to get started."
					icon="sparkles"
				>
					<Button>+ New activity</Button>
				</EmptyState>
			</Card>
		</section>
	</Container>
</div>
