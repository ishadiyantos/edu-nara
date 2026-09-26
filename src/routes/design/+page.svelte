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
			Semua primitive UI. Uji di 360/768/1440 px, keyboard, dan reduced motion.
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
					<Input label="Nama" bind:value={name} placeholder="Isha D." hint="Nama tampilan" />
				</Card>
				<Card>
					<Input label="Email" type="email" error="Format email tidak valid" value="isha@" />
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
					<Badge tone="danger">Ditutup</Badge>
					<Badge tone="info" dot>Terhubung</Badge>
				</div>
			</Card>
		</section>

		<section class="mb-10">
			<h2 class="mb-4 text-xl font-bold">Modal + Toast</h2>
			<Card>
				<div class="flex flex-wrap gap-3">
					<Button onclick={() => (modalOpen = true)}>Buka Modal</Button>
					<Button variant="accent" onclick={() => (toastOpen = true)}>Tampilkan Toast</Button>
				</div>
			</Card>
			<Modal bind:open={modalOpen} title="Konfirmasi">
				<p class="mb-4">Ini contoh dialog dengan focus trap dan Escape untuk tutup.</p>
				<div class="flex justify-end gap-2">
					<Button variant="ghost" onclick={() => (modalOpen = false)}>Batal</Button>
					<Button onclick={() => (modalOpen = false)}>Konfirmasi</Button>
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
					title="Belum ada aktivitas"
					description="Buat aktivitas pertama untuk memulai."
					icon="sparkles"
				>
					<Button>+ Aktivitas baru</Button>
				</EmptyState>
			</Card>
		</section>
	</Container>
</div>
