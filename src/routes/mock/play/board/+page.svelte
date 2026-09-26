<script lang="ts">
	import { Container, Card, Button, Badge } from '$components/ui';

	type Post = { id: number; author: string; body: string; status: 'pending' | 'approved' };
	const columns = [
		{ id: 'pro', title: '👍 Pro' },
		{ id: 'kontra', title: '👎 Kontra' },
		{ id: 'tanya', title: '❓ Pertanyaan' }
	];
	let posts = $state<Record<string, Post[]>>({
		pro: [
			{ id: 1, author: 'Ari', body: 'Cepat dan ringan.', status: 'approved' },
			{ id: 2, author: 'Bella', body: 'Mudah dipelajari.', status: 'approved' }
		],
		kontra: [{ id: 3, author: 'Cici', body: 'Ekosistem masih tumbuh.', status: 'approved' }],
		tanya: [{ id: 4, author: 'Dedi', body: 'Cocok untuk SSR?', status: 'pending' }]
	});
	let composerColumn = $state<string | null>(null);
	let body = $state('');

	function post() {
		if (!composerColumn || !body.trim()) return;
		const id = Date.now();
		posts[composerColumn] = [
			...(posts[composerColumn] ?? []),
			{ id, author: 'Kamu', body: body.trim(), status: 'pending' }
		];
		body = '';
		composerColumn = null;
	}
</script>

<svelte:head>
	<title>Board — Edu Nara</title>
</svelte:head>

<main class="min-h-dvh bg-bg pb-24 pt-6">
	<Container>
		<div class="mb-4 flex items-center justify-between">
			<h1 class="text-xl font-bold">Ide proyek akhir</h1>
			<Badge tone="success" dot>Terhubung</Badge>
		</div>
		<div class="flex gap-4 overflow-x-auto pb-4 sm:grid sm:grid-cols-3 sm:overflow-visible">
			{#each columns as col}
				<div class="w-72 flex-shrink-0 sm:w-auto">
					<div class="mb-3 flex items-center justify-between">
						<h2 class="font-bold">{col.title}</h2>
						<span class="text-xs text-muted">{(posts[col.id] ?? []).length}</span>
					</div>
					<div class="flex flex-col gap-3">
						{#each posts[col.id] ?? [] as p}
							<Card padded={false} class="p-4">
								<p class="text-sm">{p.body}</p>
								<div class="mt-2 flex items-center justify-between text-xs">
									<span class="font-semibold text-muted">— {p.author}</span>
									{#if p.status === 'pending'}
										<Badge tone="warning">Menunggu moderasi</Badge>
									{/if}
								</div>
							</Card>
						{/each}
						{#if composerColumn === col.id}
							<Card padded={false} class="p-3">
								<textarea
									bind:value={body}
									placeholder="Tulis kartu…"
									maxlength="500"
									class="w-full resize-none rounded-lg border border-border p-2 text-sm focus:border-primary focus:outline-none"
									rows="3"
								></textarea>
								<div class="mt-2 flex gap-2">
									<Button size="sm" onclick={post}>Kirim</Button>
									<Button size="sm" variant="ghost" onclick={() => (composerColumn = null)}
										>Batal</Button
									>
								</div>
							</Card>
						{:else}
							<Button variant="ghost" size="sm" block onclick={() => (composerColumn = col.id)}
								>+ Tambah kartu</Button
							>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</Container>
</main>
