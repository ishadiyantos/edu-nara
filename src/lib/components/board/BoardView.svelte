<script lang="ts">
	import {
		SAMPLE_COLUMNS,
		SAMPLE_POSTS,
		linkifyBody,
		sortPosts,
		statusLabel,
		statusTone,
		movePost,
		type BoardColumn,
		type BoardPost,
		type PostStatus
	} from '$lib/board/posts';
	import PostComposer, { type PostDraft } from './PostComposer.svelte';
	let {
		columns = SAMPLE_COLUMNS,
		posts = SAMPLE_POSTS,
		loading = false,
		error = null,
		onpost,
		admin = false,
		showOwn = false,
		disabled = false,
		presentation = false,
		onmoderate,
		onreorder,
		onmove,
		onrenamecolumn,
		onaddcolumn,
		onshare
	}: {
		columns?: BoardColumn[];
		posts?: BoardPost[];
		loading?: boolean;
		error?: string | null;
		onpost?: (payload: PostDraft) => void | Promise<void>;
		admin?: boolean;
		showOwn?: boolean;
		disabled?: boolean;
		presentation?: boolean;
		onmoderate?: (payload: { postId: string; status: PostStatus }) => void | Promise<void>;
		onreorder?: (payload: { columnId: string; posts: BoardPost[] }) => void | Promise<void>;
		onmove?: (payload: {
			postId: string;
			targetColumnId: string;
			targetPosition: number;
		}) => void | Promise<void>;
		onrenamecolumn?: (payload: { columnId: string; title: string }) => void | Promise<void>;
		onaddcolumn?: (title: string) => void | Promise<void>;
		onshare?: () => void | Promise<void>;
	} = $props();
	let activeComposer = $state<string | null>(null);
	let search = $state('');
	let filter = $state('all');
	let busy = $state(false);
	let actionError = $state('');
	let slideshow = $state(false);
	let slide = $state(0);
	let dragging = $state<string | null>(null);
	let newColumnTitle = $state('');
	let editingColumn = $state<string | null>(null);
	let editingTitle = $state('');
	const visible = $derived(
		sortPosts(
			posts.filter(
				(p) =>
					(p.status === 'approved' || (!presentation && (admin || showOwn))) &&
					(!admin || presentation || filter === 'all' || p.status === filter) &&
					`${p.author} ${p.title ?? ''} ${p.body} ${p.linkUrl ?? ''}`
						.toLocaleLowerCase('id')
						.includes(search.toLocaleLowerCase('id'))
			)
		)
	);
	const slides = $derived(
		[...columns]
			.sort((a, b) => a.position - b.position)
			.flatMap((column) =>
				visible.filter((post) => post.status === 'approved' && post.columnId === column.id)
			)
	);
	const slideIndex = $derived(Math.min(slide, Math.max(0, slides.length - 1)));
	async function submit(payload: PostDraft) {
		if (!onpost) throw new Error('Pengiriman tidak tersedia.');
		await onpost(payload);
		activeComposer = null;
	}
	async function moderate(postId: string, status: PostStatus) {
		if (!onmoderate || busy) return;
		busy = true;
		actionError = '';
		try {
			await onmoderate({ postId, status });
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Moderasi gagal.';
		} finally {
			busy = false;
		}
	}
	async function move(post: BoardPost, delta: -1 | 1) {
		if (!onreorder || busy) return;
		busy = true;
		actionError = '';
		try {
			await onreorder({
				columnId: post.columnId,
				posts: movePost(
					sortPosts(posts.filter((p) => p.columnId === post.columnId)),
					post.id,
					delta
				)
			});
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Urutan gagal disimpan.';
		} finally {
			busy = false;
		}
	}
	async function moveToColumn(postId: string, targetColumnId: string, targetPosition: number) {
		if (!onmove || busy) return;
		busy = true;
		actionError = '';
		try {
			await onmove({ postId, targetColumnId, targetPosition });
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Pemindahan kartu gagal.';
		} finally {
			dragging = null;
			busy = false;
		}
	}
	async function renameColumn(columnId: string) {
		const title = editingTitle.trim();
		if (!onrenamecolumn || !title || busy) return;
		busy = true;
		actionError = '';
		try {
			await onrenamecolumn({ columnId, title });
			editingColumn = null;
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Judul kolom gagal disimpan.';
		} finally {
			busy = false;
		}
	}
	async function addColumn() {
		const title = newColumnTitle.trim();
		if (!onaddcolumn || !title || busy) return;
		busy = true;
		actionError = '';
		try {
			await onaddcolumn(title);
			newColumnTitle = '';
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Kolom gagal ditambahkan.';
		} finally {
			busy = false;
		}
	}
	function key(event: KeyboardEvent) {
		if (
			!slideshow ||
			(event.target instanceof HTMLElement && event.target.closest('input,textarea,select'))
		)
			return;
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			slide = Math.min(slideIndex + 1, slides.length - 1);
		}
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			slide = Math.max(0, slideIndex - 1);
		}
		if (event.key === 'Escape') slideshow = false;
	}
</script>

<svelte:window onkeydown={key} />
{#snippet card(post: BoardPost, dropPosition = 0)}
	<article
		data-testid={`board-post-${post.id}`}
		class="board-card"
		class:dragging={dragging === post.id}
		ondragover={(event) => {
			if (onmove) event.preventDefault();
		}}
		ondrop={(event) => {
			event.preventDefault();
			const id = event.dataTransfer?.getData('text/plain') || dragging;
			if (id && id !== post.id) void moveToColumn(id, post.columnId, dropPosition);
		}}
	>
		{#if admin && !slideshow && onmove}<button
				type="button"
				class="drag-handle"
				draggable="true"
				aria-label={`Geser kartu ${post.title || post.body || post.author}`}
				title="Geser kartu"
				ondragstart={(event) => {
					dragging = post.id;
					event.dataTransfer?.setData('text/plain', post.id);
					if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
				}}
				ondragend={() => (dragging = null)}>⋮⋮</button
			>{/if}
		{#if admin && onmove}<label class="move-select"
				>Pindahkan ke
				<select
					aria-label={`Pindahkan kartu ${post.title || post.body || post.author} ke kolom`}
					value={post.columnId}
					onchange={(event) => {
						const target = event.currentTarget as HTMLSelectElement;
						const targetColumn = columns.find((column) => column.id === target.value);
						if (targetColumn && targetColumn.id !== post.columnId)
							void moveToColumn(post.id, targetColumn.id, 0);
					}}
					>{#each columns as option}<option value={option.id}>{option.title}</option>{/each}</select
				>
			</label>{/if}
		<header class="card-author">
			<span class="avatar" aria-hidden="true"
				>{post.author.slice(0, 1).toLocaleUpperCase('id')}</span
			>
			<div>
				<b>{post.author || 'Peserta'}</b>{#if post.createdAt}<time datetime={post.createdAt}
						>{new Date(post.createdAt).toLocaleString('id-ID', {
							timeZone: 'Asia/Jakarta',
							day: 'numeric',
							month: 'short',
							hour: '2-digit',
							minute: '2-digit'
						})} WIB</time
					>{/if}
			</div>
		</header>
		{#if !presentation && (admin || post.status !== 'approved')}<span
				class={`post-status ${statusTone(post.status)}`}>{statusLabel(post.status)}</span
			>{/if}
		{#if post.title}<h3>{post.title}</h3>{/if}
		{#if post.imageUrl}<img
				src={post.imageUrl}
				alt={post.title || `Gambar dari ${post.author}`}
				loading="lazy"
			/>{/if}
		{#if post.body}<p class="body">
				{#each linkifyBody(post.body) as segment}{#if segment.type === 'link'}<a
							href={segment.href}
							target="_blank"
							rel="noopener noreferrer">{segment.value}</a
						>{:else}{segment.value}{/if}{/each}
			</p>{/if}
		{#if post.linkUrl}<a
				class="attachment"
				href={post.linkUrl}
				target="_blank"
				rel="noopener noreferrer">↗ {post.linkUrl}</a
			>{/if}
		{#if admin && !presentation && !slideshow}
			{@const siblings = sortPosts(posts.filter((p) => p.columnId === post.columnId))}
			<div class="moderation" aria-label={`Moderasi kartu ${post.author}`}>
				{#if post.status !== 'approved'}<button
						disabled={busy}
						onclick={() => moderate(post.id, 'approved')}>Setujui</button
					>{/if}
				{#if post.status !== 'rejected'}<button
						disabled={busy}
						onclick={() => moderate(post.id, 'rejected')}>Tolak</button
					>{/if}
				{#if post.status === 'approved'}<button
						disabled={busy}
						onclick={() => moderate(post.id, 'hidden')}>Sembunyikan</button
					>{/if}
				<button
					disabled={busy || siblings[0]?.id === post.id}
					onclick={() => move(post, -1)}
					aria-label={`Pindahkan kartu ${post.author} ke atas`}>↑</button
				>
				<button
					disabled={busy || siblings.at(-1)?.id === post.id}
					onclick={() => move(post, 1)}
					aria-label={`Pindahkan kartu ${post.author} ke bawah`}>↓</button
				>
			</div>
		{/if}
	</article>
{/snippet}
<div data-testid="board-view" class="board" class:presentation>
	<div class="board-tools">
		<label class="search"
			><span>Cari kartu</span><input
				type="search"
				bind:value={search}
				placeholder="Nama, judul, atau isi kartu…"
			/></label
		>
		<button
			onclick={() => {
				slideshow = !slideshow;
				slide = 0;
			}}
			aria-pressed={slideshow}>{slideshow ? 'Kembali ke papan' : 'Slideshow'}</button
		>
		{#if onshare}<button onclick={() => void onshare()} aria-label="Bagikan papan">↗ Bagikan</button
			>{/if}
		{#if admin && (presentation || !slideshow) && onaddcolumn}
			<form
				class="add-column"
				onsubmit={(event) => {
					event.preventDefault();
					void addColumn();
				}}
			>
				<input
					aria-label="Judul kolom baru"
					bind:value={newColumnTitle}
					maxlength="120"
					placeholder="Kolom baru"
				/>
				<button type="submit" disabled={busy || !newColumnTitle.trim()}>+ Tambah kolom</button>
			</form>
		{/if}
		{#if admin && !presentation && !slideshow}<label
				>Status<select bind:value={filter}
					><option value="all">Semua</option><option value="pending">Menunggu</option><option
						value="approved">Tampil</option
					><option value="rejected">Ditolak</option><option value="hidden">Disembunyikan</option
					></select
				></label
			>{/if}
		{#if onpost && !disabled && !slideshow && columns[0]}<button
				class="posting"
				onclick={() => {
					activeComposer = columns[0].id;
				}}>+ Posting</button
			>{/if}
	</div>
	{#if error || actionError}<p role="alert" class="error">{error || actionError}</p>{/if}
	{#if loading}<p role="status">Memuat papan kolaborasi…</p>{/if}
	{#if slideshow}
		<section class="slideshow" aria-label="Slideshow kartu disetujui" data-testid="board-slideshow">
			{#if slides[slideIndex]}<p class="slide-column">
					{columns.find((c) => c.id === slides[slideIndex].columnId)?.title}
				</p>
				{@render card(slides[slideIndex])}{:else}<p>Belum ada kartu disetujui yang cocok.</p>{/if}
			<nav aria-label="Navigasi slideshow">
				<button disabled={slideIndex === 0} onclick={() => (slide = slideIndex - 1)}
					>← Kartu sebelumnya</button
				><span>{slides.length ? slideIndex + 1 : 0} / {slides.length}</span><button
					disabled={slideIndex >= slides.length - 1}
					onclick={() => (slide = slideIndex + 1)}>Kartu berikutnya →</button
				>
			</nav>
		</section>
	{:else}
		<!-- Scroll region must be focusable for keyboard horizontal navigation. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="columns" tabindex="0" role="region" aria-label="Kolom papan, geser horizontal">
			{#each [...columns].sort((a, b) => a.position - b.position) as column (column.id)}
				{@const cards = visible.filter((p) => p.columnId === column.id)}
				<section
					class="column"
					data-testid={`board-column-${column.id}`}
					aria-label={column.title}
					ondragover={(event) => {
						if (onmove) event.preventDefault();
					}}
					ondrop={(event) => {
						event.preventDefault();
						const id = event.dataTransfer?.getData('text/plain') || dragging;
						if (id) void moveToColumn(id, column.id, cards.length);
					}}
				>
					<header class="column-heading">
						{#if editingColumn === column.id}
							<form
								class="column-edit"
								onsubmit={(event) => {
									event.preventDefault();
									void renameColumn(column.id);
								}}
							>
								<input
									aria-label={`Edit judul ${column.title}`}
									bind:value={editingTitle}
									maxlength="120"
								/>
								<button type="submit" disabled={busy}>Simpan</button>
								<button type="button" onclick={() => (editingColumn = null)}>Batal</button>
							</form>
						{:else}
							<h2>{column.title}</h2>
							{#if onrenamecolumn}<button
									class="icon-button"
									aria-label={`Edit judul ${column.title}`}
									onclick={() => {
										editingColumn = column.id;
										editingTitle = column.title;
									}}>✎</button
								>{/if}
						{/if}
						<span>{cards.length}</span>
					</header>
					{#if onpost && !disabled && !presentation}<button
							class="add"
							aria-label={`Tambah kartu ke kolom ${column.title}`}
							onclick={() => (activeComposer = activeComposer === column.id ? null : column.id)}
							>+ Tambah kartu</button
						>{/if}
					{#if activeComposer === column.id && onpost && !presentation}<PostComposer
							columnId={column.id}
							onsubmit={submit}
							oncancel={() => (activeComposer = null)}
							{disabled}
						/>{/if}
					{#each cards as post, index (post.id)}{@render card(post, index)}{:else}<p class="empty">
							Belum ada kartu yang cocok.
						</p>{/each}
				</section>
			{:else}<p class="empty">
					Belum ada kolom. Dosen dapat menambahkan kolom melalui editor.
				</p>{/each}
		</div>
	{/if}
</div>

<style>
	.board {
		width: 100%;
		min-width: 0;
		max-width: 100%;
		color: #0f172a;
		border-radius: 1.25rem;
		padding: clamp(0.6rem, 2vw, 1.4rem);
		background: #eef2ff;
	}
	.board-tools {
		display: flex;
		align-items: end;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin-bottom: 1.25rem;
		padding: 0.35rem;
		border-radius: 1rem;
		background: color-mix(in srgb, #334155 10%, transparent);
	}
	label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.8rem;
		font-weight: 700;
	}
	.search {
		flex: 1;
		min-width: min(100%, 12rem);
	}
	.add-column {
		display: flex;
		align-items: end;
		gap: 0.35rem;
		flex: 1 1 16rem;
	}
	.add-column input {
		min-width: 8rem;
	}
	.column-edit {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		width: 100%;
	}
	.column-edit input {
		min-width: 0;
		padding: 0.35rem 0.5rem;
	}
	.icon-button {
		min-height: 32px;
		min-width: 32px;
		padding: 0.2rem;
		border: 0;
		background: transparent;
	}
	input,
	select {
		min-height: 44px;
		width: 100%;
		border: 1px solid #cbd5e1;
		border-radius: 0.7rem;
		padding: 0.65rem;
		background: white;
		color: #0f172a;
	}
	button {
		min-height: 44px;
		min-width: 44px;
		padding: 0.6rem 0.85rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.75rem;
		background: white;
		color: #334155;
		font-size: 0.85rem;
		font-weight: 700;
	}
	button:disabled {
		opacity: 0.45;
	}
	button:hover:not(:disabled) {
		border-color: #4f46e5;
	}
	.posting {
		background: #4f46e5;
		color: white;
		border-color: #4f46e5;
	}
	.columns {
		display: flex;
		align-items: flex-start;
		gap: 1.25rem;
		width: 100%;
		max-width: 100%;
		overflow-x: auto;
		padding: 0.25rem 0.1rem 1.25rem;
		scroll-snap-type: x proximity;
	}
	.column {
		flex: 0 0 min(300px, 100%);
		min-width: 0;
		display: grid;
		gap: 0.85rem;
		scroll-snap-align: start;
	}
	.column-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		border-bottom: 3px solid #818cf8;
		padding: 0.5rem 0.2rem 0.75rem;
	}
	h2 {
		font-size: 1rem;
		font-weight: 850;
		overflow-wrap: anywhere;
	}
	.column-heading span {
		border-radius: 1rem;
		background: #dfe5fb;
		padding: 0.1rem 0.6rem;
		font-size: 0.75rem;
	}
	.add {
		width: 100%;
		border-style: dashed;
		background: #ffffffa8;
	}
	.board-card {
		min-width: 0;
		cursor: default;
		background: #fff;
		color: #0f172a;
		padding: 1rem;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
		box-shadow: 0 4px 14px #3341550b;
		display: grid;
		gap: 0.85rem;
		overflow-wrap: anywhere;
	}
	.drag-handle {
		justify-self: end;
		padding: 0.15rem 0.5rem;
		border: 1px dashed #94a3b8;
		border-radius: 0.4rem;
		background: #f8fafc;
		cursor: grab;
	}
	.move-select {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: #475569;
	}
	.move-select select {
		min-height: 32px;
		padding: 0.2rem 0.4rem;
	}
	.board-card.dragging {
		opacity: 0.45;
		outline: 2px dashed #4f46e5;
	}
	.card-author {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.8rem;
	}
	.card-author div {
		min-width: 0;
	}
	time {
		display: block;
		font-size: 0.68rem;
		color: #64748b;
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		background: #ede9fe;
		color: #6d28d9;
		border-radius: 50%;
		font-weight: 800;
	}
	h3 {
		font-weight: 850;
		font-size: 1.1rem;
	}
	.body {
		white-space: pre-wrap;
		font-size: 0.95rem;
		line-height: 1.65;
	}
	a {
		color: #4338ca;
		text-decoration: underline;
		overflow-wrap: anywhere;
	}
	.attachment {
		font-size: 0.85rem;
		background: #f8fafc;
		border-radius: 0.5rem;
		padding: 0.6rem;
	}
	img {
		width: 100%;
		max-height: 30rem;
		object-fit: contain;
		border-radius: 0.6rem;
		background: #f8fafc;
	}
	.post-status {
		justify-self: start;
		padding: 0.2rem 0.45rem;
		border-width: 1px;
		border-radius: 0.4rem;
		font-size: 0.7rem;
		font-weight: 700;
	}
	.moderation {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		border-top: 1px solid #e2e8f0;
		padding-top: 0.75rem;
	}
	.empty {
		padding: 1rem;
		color: #64748b;
		font-size: 0.85rem;
	}
	.error {
		background: #fff1f2;
		color: #b91c1c;
		padding: 1rem;
		border-radius: 0.8rem;
		margin-bottom: 1rem;
	}
	.slideshow {
		max-width: 48rem;
		margin: auto;
		padding: 1rem 0;
	}
	.slideshow :global(.board-card) {
		padding: clamp(1rem, 3vw, 2rem);
	}
	.slideshow :global(.body) {
		font-size: clamp(1rem, 2vw, 1.5rem);
	}
	.slide-column {
		color: #4338ca;
		font-weight: 800;
		margin-bottom: 1rem;
	}
	nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 1rem;
	}
	nav span {
		font-size: 0.8rem;
	}
	.presentation {
		min-height: 65dvh;
	}
</style>
