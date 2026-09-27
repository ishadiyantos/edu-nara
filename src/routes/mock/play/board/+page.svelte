<script lang="ts">
	import { BoardView } from '$lib/components/board';
	import { SAMPLE_COLUMNS, SAMPLE_POSTS, type BoardPost } from '$lib/board/posts';
	import { Container } from '$components/ui';

	let posts = $state<BoardPost[]>([...SAMPLE_POSTS]);

	async function addPost(payload: { columnId: string; body: string }) {
		posts = [
			...posts,
			{
				id: `local-${Date.now()}`,
				columnId: payload.columnId,
				author: 'Kamu',
				body: payload.body,
				status: 'pending',
				position: posts.filter((post) => post.columnId === payload.columnId).length
			}
		];
	}
</script>

<svelte:head><title>Board — Edu Nara</title></svelte:head>

<main class="min-h-dvh overflow-x-hidden bg-bg pb-16 pt-6">
	<Container>
		<header class="mb-6 flex flex-wrap items-end justify-between gap-3">
			<div>
				<p class="eyebrow">Papan kelas</p>
				<h1 class="mt-1 text-2xl font-black text-text">Ide proyek akhir</h1>
				<p class="mt-1 text-sm text-text-muted">Bagikan ide, pertanyaan, dan pertimbanganmu.</p>
			</div>
			<span
				class="rounded-full border border-emerald-300/60 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"
				>● Terhubung</span
			>
		</header>
		<BoardView columns={SAMPLE_COLUMNS} {posts} onpost={addPost} />
	</Container>
</main>
