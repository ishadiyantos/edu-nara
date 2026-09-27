<script lang="ts">
	import { Badge, Button, EmptyState } from '$components/ui';
	import {
		SAMPLE_COLUMNS,
		SAMPLE_POSTS,
		linkifyBody,
		sortPosts,
		type BoardColumn,
		type BoardPost
	} from '$lib/board/posts';
	import PostComposer from './PostComposer.svelte';

	type Props = {
		columns?: BoardColumn[];
		posts?: BoardPost[];
		loading?: boolean;
		error?: string | null;
		onpost?: (payload: { columnId: string; body: string }) => void | Promise<void>;
	};

	let {
		columns = SAMPLE_COLUMNS,
		posts = SAMPLE_POSTS,
		loading = false,
		error = null,
		onpost
	}: Props = $props();

	let activeComposer = $state<string | null>(null);

	let approvedPosts = $derived(sortPosts(posts.filter((post) => post.status === 'approved')));

	function getColumnPosts(colId: string) {
		return approvedPosts.filter((post) => post.columnId === colId);
	}

	async function handleComposerSubmit(payload: { columnId: string; body: string }) {
		if (onpost) {
			await onpost(payload);
		}
		activeComposer = null;
	}
</script>

<!-- ponytail: public board view with approved posts and safe auto-linkify; SSE realtime updates in t_77b96303 -->
<div data-testid="board-view" class="w-full max-w-full space-y-6">
	{#if error}
		<div
			role="alert"
			class="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm font-bold text-danger"
		>
			{error}
		</div>
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
			<span>Memuat papan kolaborasi...</span>
		</div>
	{:else if columns.length === 0}
		<EmptyState title="Belum Ada Kolom" description="Papan ini belum memiliki kolom diskusi." />
	{:else}
		<div
			class="flex gap-4 overflow-x-auto pb-6 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible w-full"
		>
			{#each columns as col (col.id)}
				{@const colPosts = getColumnPosts(col.id)}
				<section
					data-testid={`board-column-${col.id}`}
					class="flex w-72 shrink-0 flex-col rounded-2xl border border-border bg-surface/80 p-4 shadow-card sm:w-auto"
					aria-label={col.title}
				>
					<header class="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
						<h2 class="text-base font-bold text-text break-words">
							{col.title}
						</h2>
						<Badge tone="neutral" class="text-xs font-bold">
							{colPosts.length}
						</Badge>
					</header>

					<div class="flex flex-1 flex-col gap-3">
						{#if colPosts.length === 0}
							<p class="py-6 text-center text-xs text-text-muted italic">
								Belum ada kartu tampil di kolom ini.
							</p>
						{:else}
							{#each colPosts as post (post.id)}
								<article
									data-testid={`board-post-${post.id}`}
									class="rounded-xl border border-border/80 bg-surface p-3.5 shadow-sm transition hover:shadow-md"
								>
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
									<footer
										class="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-xs text-text-muted"
									>
										<span class="font-medium">— {post.author || 'Anonim'}</span>
									</footer>
								</article>
							{/each}
						{/if}

						<div class="mt-2">
							{#if activeComposer === col.id}
								<PostComposer
									columnId={col.id}
									onsubmit={handleComposerSubmit}
									oncancel={() => (activeComposer = null)}
								/>
							{:else}
								<Button
									variant="ghost"
									size="sm"
									block
									onclick={() => (activeComposer = col.id)}
									ariaLabel={`Tambah kartu ke kolom ${col.title}`}
									class="border-dashed border-border text-text-muted hover:border-primary hover:text-primary"
								>
									+ Tambah kartu
								</Button>
							{/if}
						</div>
					</div>
				</section>
			{/each}
		</div>
	{/if}
</div>
