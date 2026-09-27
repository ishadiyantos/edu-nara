<script lang="ts">
	import { Button, EmptyState } from '$components/ui';
	import {
		SAMPLE_COLUMNS,
		SAMPLE_POSTS,
		linkifyBody,
		movePost,
		sortPosts,
		statusLabel,
		statusTone,
		type BoardColumn,
		type BoardPost,
		type PostStatus
	} from '$lib/board/posts';
	import PostComposer from './PostComposer.svelte';

	type Props = {
		columns?: BoardColumn[];
		posts?: BoardPost[];
		loading?: boolean;
		error?: string | null;
		onmoderate?: (payload: { postId: string; status: PostStatus }) => void | Promise<void>;
		onreorder?: (payload: { columnId: string; posts: BoardPost[] }) => void | Promise<void>;
		onaddpost?: (payload: { columnId: string; body: string }) => void | Promise<void>;
	};

	let {
		columns = SAMPLE_COLUMNS,
		posts = SAMPLE_POSTS,
		loading = false,
		error = null,
		onmoderate,
		onreorder,
		onaddpost
	}: Props = $props();

	const initialPosts = () => [...posts];
	let localPosts = $state<BoardPost[]>(initialPosts());
	let filter = $state<'all' | PostStatus>('all');
	let activeComposer = $state<string | null>(null);
	let actionFeedback = $state('');

	$effect(() => {
		localPosts = [...posts];
	});

	function getColumnPosts(colId: string) {
		const colPosts = sortPosts(localPosts.filter((p) => p.columnId === colId));
		if (filter === 'all') return colPosts;
		return colPosts.filter((p) => p.status === filter);
	}

	async function setStatus(postId: string, newStatus: PostStatus) {
		localPosts = localPosts.map((p) => (p.id === postId ? { ...p, status: newStatus } : p));
		actionFeedback = `Status kartu diperbarui: ${statusLabel(newStatus)}`;
		if (onmoderate) {
			await onmoderate({ postId, status: newStatus });
		}
	}

	async function move(columnId: string, postId: string, delta: -1 | 1) {
		const colPosts = sortPosts(localPosts.filter((p) => p.columnId === columnId));
		const reordered = movePost(colPosts, postId, delta);
		const otherPosts = localPosts.filter((p) => p.columnId !== columnId);
		localPosts = [...otherPosts, ...reordered];
		actionFeedback = delta === -1 ? 'Kartu dipindahkan ke atas.' : 'Kartu dipindahkan ke bawah.';
		if (onreorder) {
			await onreorder({ columnId, posts: reordered });
		}
	}

	async function handleAddPost(payload: { columnId: string; body: string }) {
		if (onaddpost) {
			await onaddpost(payload);
		} else {
			const newPost: BoardPost = {
				id: `post-${Date.now()}`,
				columnId: payload.columnId,
				author: 'Dosen',
				body: payload.body,
				status: 'approved',
				position: localPosts.filter((p) => p.columnId === payload.columnId).length
			};
			localPosts = [...localPosts, newPost];
		}
		activeComposer = null;
		actionFeedback = 'Kartu baru ditambahkan.';
	}
</script>

<!-- ponytail: admin board editor with moderation controls and accessible keyboard reordering; full backend API wireup in t_77b96303 -->
<div data-testid="board-editor" class="w-full max-w-full space-y-6">
	{#if error}
		<div
			role="alert"
			class="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm font-bold text-danger"
		>
			{error}
		</div>
	{/if}

	<div
		class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm"
	>
		<div>
			<h2 class="text-lg font-black text-text">Moderasi & Pengaturan Papan</h2>
			<p class="text-xs text-text-muted">Setujui, tolak, atau susun urutan kartu mahasiswa.</p>
		</div>

		<div class="flex flex-wrap items-center gap-2" role="group" aria-label="Filter status moderasi">
			{#each [['all', 'Semua'], ['pending', 'Menunggu'], ['approved', 'Tampil'], ['rejected', 'Ditolak']] as [key, label]}
				<button
					type="button"
					class={`min-h-11 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
						filter === key
							? 'bg-primary text-white shadow-sm'
							: 'border border-border bg-surface text-text hover:bg-primary-soft'
					}`}
					onclick={() => (filter = key as 'all' | PostStatus)}
					aria-pressed={filter === key}
				>
					{label}
				</button>
			{/each}
		</div>
	</div>

	{#if actionFeedback}
		<p
			role="status"
			class="rounded-xl border border-emerald-500/30 bg-emerald-50 p-3 text-xs font-bold text-emerald-800"
		>
			{actionFeedback}
		</p>
	{/if}

	{#if loading}
		<div
			role="status"
			class="flex items-center justify-center gap-3 py-12 text-sm font-semibold text-text-muted"
		>
			<span
				class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
				aria-hidden="true"
			></span>
			<span>Memuat data editor...</span>
		</div>
	{:else if columns.length === 0}
		<EmptyState
			title="Belum Ada Kolom"
			description="Tambahkan kolom baru untuk mulai memoderasi kartu."
		/>
	{:else}
		<div
			class="flex gap-4 overflow-x-auto pb-6 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible w-full"
		>
			{#each columns as col (col.id)}
				{@const colPosts = getColumnPosts(col.id)}
				<section
					data-testid={`admin-column-${col.id}`}
					class="flex w-80 shrink-0 flex-col rounded-2xl border border-border bg-surface p-4 shadow-card sm:w-auto"
					aria-label={`Editor kolom ${col.title}`}
				>
					<header class="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
						<div>
							<h3 class="text-base font-bold text-text break-words">
								{col.title}
							</h3>
							<span class="text-xs text-text-muted">{colPosts.length} kartu</span>
						</div>
					</header>

					<div class="flex flex-1 flex-col gap-3">
						{#if colPosts.length === 0}
							<p class="py-6 text-center text-xs text-text-muted italic">
								Tidak ada kartu pada filter ini.
							</p>
						{:else}
							{#each colPosts as post, idx (post.id)}
								<article
									data-testid={`admin-post-${post.id}`}
									class="flex flex-col gap-2 rounded-xl border border-border bg-bg/40 p-3 shadow-sm"
								>
									<div class="flex items-center justify-between gap-2">
										<span class="text-xs font-bold text-text-muted"
											>— {post.author || 'Anonim'}</span
										>
										<span
											class={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${statusTone(post.status)}`}
										>
											{statusLabel(post.status)}
										</span>
									</div>

									<p class="text-sm leading-relaxed text-text break-words whitespace-pre-wrap">
										{#each linkifyBody(post.body) as segment}
											{#if segment.type === 'link'}
												<a
													href={segment.href}
													target="_blank"
													rel="noopener noreferrer"
													class="link font-medium text-primary underline break-all focus-visible:outline-2"
													>{segment.value}</a
												>
											{:else}
												<span>{segment.value}</span>
											{/if}
										{/each}
									</p>

									<div
										class="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2"
									>
										<div class="flex items-center gap-1" role="group" aria-label="Urutan kartu">
											<button
												type="button"
												class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-surface px-2 text-xs font-bold text-text hover:bg-primary-soft disabled:opacity-40 disabled:hover:bg-surface"
												disabled={idx === 0}
												onclick={() => move(col.id, post.id, -1)}
												aria-label={`Pindahkan kartu ${post.author} ke atas`}
											>
												↑ <span class="sr-only">Naik</span>
											</button>
											<button
												type="button"
												class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-surface px-2 text-xs font-bold text-text hover:bg-primary-soft disabled:opacity-40 disabled:hover:bg-surface"
												disabled={idx === colPosts.length - 1}
												onclick={() => move(col.id, post.id, 1)}
												aria-label={`Pindahkan kartu ${post.author} ke bawah`}
											>
												↓ <span class="sr-only">Turun</span>
											</button>
										</div>

										<div class="flex flex-wrap items-center gap-1">
											{#if post.status !== 'approved'}
												<button
													type="button"
													class="inline-flex min-h-11 items-center rounded-lg bg-emerald-600 px-2.5 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95"
													onclick={() => setStatus(post.id, 'approved')}
													aria-label={`Setujui kartu dari ${post.author}`}
												>
													Setujui
												</button>
											{/if}
											{#if post.status !== 'rejected'}
												<button
													type="button"
													class="inline-flex min-h-11 items-center rounded-lg border border-rose-300 bg-rose-50 px-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 active:scale-95"
													onclick={() => setStatus(post.id, 'rejected')}
													aria-label={`Tolak kartu dari ${post.author}`}
												>
													Tolak
												</button>
											{/if}
										</div>
									</div>
								</article>
							{/each}
						{/if}

						<div class="mt-2">
							{#if activeComposer === col.id}
								<PostComposer
									columnId={col.id}
									placeholder="Tambah catatan dosen di kolom ini..."
									onsubmit={handleAddPost}
									oncancel={() => (activeComposer = null)}
								/>
							{:else}
								<Button
									variant="ghost"
									size="sm"
									block
									onclick={() => (activeComposer = col.id)}
									ariaLabel={`Tambah kartu dosen ke kolom ${col.title}`}
									class="border-dashed border-border text-text-muted hover:border-primary hover:text-primary"
								>
									+ Tambah kartu admin
								</Button>
							{/if}
						</div>
					</div>
				</section>
			{/each}
		</div>
	{/if}
</div>
