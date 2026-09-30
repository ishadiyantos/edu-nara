<script lang="ts">
	import { onDestroy, tick } from 'svelte';
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
	import Modal from '$lib/components/ui/Modal.svelte';
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
		toolbarHost = null,
		onmoderate,
		onreorder,
		onmove,
		onrenamecolumn,
		onaddcolumn,
		onshare,
		moderationEnabled = false,
		ontogglemoderation,
		saving = false
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
		toolbarHost?: HTMLElement | null;
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
		moderationEnabled?: boolean;
		ontogglemoderation?: () => void | Promise<void>;
		saving?: boolean;
	} = $props();
	let composerOpen = $state(false);
	let composerColumn = $state('');
	function openComposer(columnId = columns[0]?.id ?? '') {
		composerColumn = columnId;
		composerOpen = true;
	}
	let search = $state('');
	let searchOpen = $state(false);
	let searchInput: HTMLInputElement;
	let searchToggle: HTMLButtonElement;
	async function toggleSearch() {
		searchOpen = !searchOpen;
		if (searchOpen) {
			await tick();
			searchInput.focus();
		} else {
			search = '';
			searchToggle.focus();
		}
	}
	let filter = $state('all');
	let busy = $state(false);
	let actionError = $state('');
	let slideshow = $state(false);
	let slide = $state(0);
	let dragging = $state<string | null>(null);
	let dropTarget = $state<{ columnId: string; beforeId: string | null } | null>(null);
	let dragPreview: HTMLElement | null = null;
	function clearDrag() {
		dragging = null;
		dropTarget = null;
		dragPreview?.remove();
		dragPreview = null;
	}
	onDestroy(clearDrag);
	function startDrag(event: DragEvent, post: BoardPost) {
		if (!admin || slideshow || !onmove || busy || !event.dataTransfer) {
			event.preventDefault();
			return;
		}
		event.stopPropagation();
		clearDrag();
		const source = (event.currentTarget as HTMLElement).closest('article')!;
		const rect = source.getBoundingClientRect();
		// Native drag image stays under the pointer, including outside the board.
		dragPreview = source.cloneNode(true) as HTMLElement;
		dragPreview.removeAttribute('data-testid');
		dragPreview.removeAttribute('data-post-id');
		dragPreview.setAttribute('aria-hidden', 'true');
		dragPreview.dataset.dragPreview = 'true';
		dragPreview.inert = true;
		dragPreview.style.cssText = `position:fixed;left:-10000px;top:0;width:${rect.width}px;max-height:320px;overflow:hidden;transform:rotate(-2deg);opacity:0.95;box-shadow:0 18px 40px #001e2455;pointer-events:none;`;
		(document.fullscreenElement ?? document.body).appendChild(dragPreview);
		event.dataTransfer.setDragImage(
			dragPreview,
			Math.min(rect.width - 8, Math.max(8, event.clientX - rect.x)),
			Math.min(280, Math.max(8, event.clientY - rect.y))
		);
		event.dataTransfer.setData('application/x-edu-nara-board-post', post.id);
		event.dataTransfer.setData('text/plain', post.id);
		event.dataTransfer.effectAllowed = 'move';
		dragging = post.id;
	}
	function locateDrop(event: DragEvent, columnId: string) {
		if (!dragging || !admin || !onmove || busy) return null;
		const column = event.currentTarget as HTMLElement;
		const cards = [...column.querySelectorAll<HTMLElement>('[data-post-id]')].filter(
			(node) => node.dataset.postId !== dragging
		);
		const next = cards.find((node) => {
			const rect = node.getBoundingClientRect();
			return event.clientY < rect.top + rect.height / 2;
		});
		return { columnId, beforeId: next?.dataset.postId ?? null };
	}
	function dragOver(event: DragEvent, columnId: string) {
		const target = locateDrop(event, columnId);
		if (!target) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		dropTarget = target;
	}
	function dropCard(event: DragEvent, columnId: string) {
		const target = locateDrop(event, columnId);
		if (!target || !dragging) return;
		event.preventDefault();
		event.stopPropagation();
		const id = dragging;
		// API position excludes the dragged card, also when filters hide siblings.
		const siblings = sortPosts(posts.filter((p) => p.columnId === columnId && p.id !== id));
		const position = target.beforeId
			? siblings.findIndex((p) => p.id === target.beforeId)
			: siblings.length;
		clearDrag();
		if (position >= 0) void moveToColumn(id, columnId, position);
	}

	let newColumnTitle = $state('');
	let editingColumn = $state<string | null>(null);
	let editingTitle = $state('');
	let addingColumn = $state(false);
	function placeToolbar(node: HTMLElement, target: HTMLElement | null) {
		const parent = node.parentElement!;
		function update(host: HTMLElement | null) {
			(host ?? parent).appendChild(node);
		}
		update(target);
		return { update, destroy: () => node.remove() };
	}
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
		composerOpen = false;
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
			addingColumn = false;
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Kolom gagal ditambahkan.';
		} finally {
			busy = false;
		}
	}
	function key(event: KeyboardEvent) {
		if (event.key === 'Escape' && dragging) {
			clearDrag();
			return;
		}
		if (editingColumn || addingColumn) return;
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

<svelte:window onkeydown={key} ondragend={clearDrag} ondrop={clearDrag} onblur={clearDrag} />
{#snippet card(post: BoardPost)}
	<article
		data-testid={`board-post-${post.id}`}
		data-post-id={post.id}
		class={`board-card color-${post.cardColor ?? 'cream'}`}
		draggable={!!admin && !slideshow && !!onmove}
		class:dragging={dragging === post.id}
		ondragstart={(event) => startDrag(event, post)}
		ondragend={clearDrag}
	>
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
				rel="noopener noreferrer"
			>
				{#if post.previewImageUrl}<img
						class="preview-image"
						src={post.previewImageUrl}
						alt=""
						loading="lazy"
					/>{/if}
				<span
					><b>{post.previewTitle || new URL(post.linkUrl).hostname}</b><small
						>{new URL(post.linkUrl).hostname}</small
					></span
				>
			</a>{/if}
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
<div
	data-testid="board-view"
	aria-busy={busy}
	class="board"
	class:presentation
	class:slideshow-active={slideshow}
	class:toolbar-hosted={!!toolbarHost}
>
	<div
		class="board-tools"
		class:slideshow-mode={slideshow}
		class:hosted={!!toolbarHost}
		use:placeToolbar={toolbarHost}
	>
		<div class="search-control" class:search-open={searchOpen}>
			<button
				type="button"
				class="tool-button search-toggle"
				bind:this={searchToggle}
				aria-label={searchOpen ? 'Tutup pencarian' : 'Buka pencarian'}
				title={searchOpen ? 'Tutup pencarian' : 'Cari kartu'}
				aria-expanded={searchOpen}
				onclick={toggleSearch}
			>
				<svg
					aria-hidden="true"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				>
					<circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" />
				</svg>
			</button>
			<label class="search"
				><span>Cari</span><input
					type="search"
					aria-label="Cari kartu"
					bind:this={searchInput}
					bind:value={search}
					placeholder="Cari kartu…"
					onkeydown={(event) => {
						if (event.key === 'Escape' && searchOpen) {
							event.preventDefault();
							event.stopPropagation();
							void toggleSearch();
						}
					}}
				/></label
			>
		</div>
		<button
			class="tool-button"
			onclick={() => {
				slideshow = !slideshow;
				slide = 0;
			}}
			aria-label={slideshow ? 'Kembali ke papan' : 'Slideshow'}
			aria-pressed={slideshow}>{slideshow ? '▦' : '▷'}</button
		>
		{#if onshare}<button
				class="tool-button"
				onclick={() => void onshare()}
				aria-label="Bagikan papan">↗</button
			>{/if}
		{#if admin && ontogglemoderation && !slideshow}<button
				class="tool-button"
				onclick={() => void ontogglemoderation()}
				disabled={saving}
				aria-label={moderationEnabled ? 'Nonaktifkan moderasi' : 'Aktifkan moderasi'}
				aria-pressed={moderationEnabled}>{moderationEnabled ? '◉' : '◎'}</button
			>{/if}
		{#if admin && !slideshow && onaddcolumn}
			<button
				class="tool-button"
				aria-label="Tambah kolom"
				title="Tambah kolom"
				onclick={() => {
					actionError = '';
					addingColumn = true;
				}}>+</button
			>
		{/if}
		{#if admin && !presentation && !slideshow}<label class="status-filter"
				><span class="sr-only">Status</span><select bind:value={filter}
					><option value="all">Semua</option><option value="pending">Menunggu</option><option
						value="approved">Tampil</option
					><option value="rejected">Ditolak</option><option value="hidden">Disembunyikan</option
					></select
				></label
			>{/if}
	</div>
	{#if onpost && !disabled && !slideshow && columns[0]}<button
			class="posting"
			onclick={() => {
				openComposer();
			}}>+ Posting</button
		>{/if}
	{#if error || actionError}<p role="alert" class="error">{error || actionError}</p>{/if}
	{#if loading}<p role="status" class="sr-only">Memuat papan kolaborasi…</p>{/if}
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
					ondragover={(event) => dragOver(event, column.id)}
					ondragleave={(event) => {
						if (
							!(event.relatedTarget instanceof Node) ||
							!event.currentTarget.contains(event.relatedTarget)
						)
							dropTarget = null;
					}}
					ondrop={(event) => dropCard(event, column.id)}
				>
					<header class="column-heading">
						<span class="column-count">{cards.length} kartu</span>
						<h2>{column.title}</h2>
						{#if admin && onrenamecolumn}<button
								class="icon-button"
								aria-label={`Edit judul ${column.title}`}
								onclick={() => {
									actionError = '';
									editingColumn = column.id;
									editingTitle = column.title;
								}}
								title="Edit judul kolom">⋯</button
							>{/if}
					</header>
					<div class="column-content">
						{#if onpost && !disabled && !presentation}<button
								class="add"
								aria-label={`Tambah kartu ke kolom ${column.title}`}
								onclick={() => openComposer(column.id)}>+</button
							>{/if}
						{#each cards as post (post.id)}
							<div
								class="card-slot"
								class:insert-before={dropTarget?.columnId === column.id &&
									dropTarget.beforeId === post.id}
								class:insert-after={dropTarget?.columnId === column.id &&
									dropTarget.beforeId === null &&
									cards.at(-1)?.id === post.id}
							>
								{@render card(post)}
							</div>
						{:else}<p class="empty" class:insert-before={dropTarget?.columnId === column.id}>
								{search ? 'Tidak ada kartu yang cocok.' : 'Belum ada kiriman.'}
							</p>{/each}
					</div>
				</section>
			{:else}<p class="empty">
					Belum ada kolom. Dosen dapat menambahkan kolom melalui editor.
				</p>{/each}
		</div>
	{/if}
</div>

<Modal open={composerOpen} title="Tulis kartu baru" onclose={() => (composerOpen = false)}>
	<PostComposer
		bind:columnId={composerColumn}
		columns={[...columns].sort((a, b) => a.position - b.position)}
		onsubmit={submit}
		oncancel={() => (composerOpen = false)}
		{disabled}
	/>
</Modal>

<Modal
	open={editingColumn !== null || addingColumn}
	title={addingColumn ? 'Tambah kolom' : 'Edit judul kolom'}
	onclose={() => {
		editingColumn = null;
		addingColumn = false;
	}}
>
	<form
		class="column-form"
		onsubmit={(event) => {
			event.preventDefault();
			if (addingColumn) void addColumn();
			else if (editingColumn) void renameColumn(editingColumn);
		}}
	>
		<label
			>Judul kolom
			{#if addingColumn}<textarea
					aria-label="Judul kolom baru"
					bind:value={newColumnTitle}
					maxlength="120"
					rows="4"
					required
				></textarea>
			{:else}<textarea
					aria-label={`Edit judul ${columns.find((c) => c.id === editingColumn)?.title}`}
					bind:value={editingTitle}
					maxlength="120"
					rows="4"
					required
				></textarea>{/if}
		</label>
		<p class="character-count">
			{(addingColumn ? newColumnTitle : editingTitle).length}/120 karakter
		</p>
		{#if actionError}<p role="alert" class="error">{actionError}</p>{/if}
		<div class="dialog-actions">
			<button
				type="button"
				onclick={() => {
					editingColumn = null;
					addingColumn = false;
				}}>Batal</button
			><button
				class="save-column"
				type="submit"
				disabled={busy || !(addingColumn ? newColumnTitle : editingTitle).trim()}
				>{busy ? 'Menyimpan…' : 'Simpan'}</button
			>
		</div>
	</form>
</Modal>

<style>
	.board {
		position: relative;
		width: 100%;
		min-width: 0;
		max-width: 100%;
		color: #f8fafc;
		padding: 5.5rem 0 1rem;
		background: transparent;
	}
	.board-tools {
		position: absolute;
		top: 0.85rem;
		right: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 0.35rem;
		max-width: 100%;
		padding: 0;
		border: 0;
		background: transparent;
	}
	.board-tools.slideshow-mode {
		top: 0.65rem;
		right: 0.65rem;
	}
	label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.8rem;
		font-weight: 700;
	}
	.search {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		min-width: min(15rem, 42vw);
		color: #cbd5e1;
		font-size: 0.78rem;
	}
	.search input {
		flex: 1;
		min-width: 0;
	}
	.search span {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	.column-form {
		display: grid;
		gap: 0.75rem;
		color: #183042;
	}
	.column-form label {
		font-size: 0.95rem;
	}
	.character-count {
		text-align: right;
		color: #647481;
		font-size: 0.8rem;
	}
	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.save-column {
		background: #176d65;
		color: white;
		border-color: #176d65;
	}
	.icon-button {
		position: absolute;
		top: 0.35rem;
		right: 0.35rem;
		padding: 0.2rem;
		border: 0;
		background: transparent;
		color: white;
		font-size: 1.5rem;
	}
	input,
	textarea,
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
	.tool-button {
		display: inline-grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		min-height: 44px;
		padding: 0;
		border: 0;
		border-radius: 0.75rem;
		background: #ffffff12;
		color: #f8fafc;
		font-size: 1.15rem;
		font-weight: 800;
	}
	.tool-button:hover:not(:disabled),
	.tool-button[aria-pressed='true'] {
		border-color: #99f6e4;
		background: #176d65;
		color: white;
	}
	.board-tools input,
	.board-tools select {
		min-height: 44px;
		border: 0;
		border-radius: 0.75rem;
		background: #ffffff12;
		color: #f8fafc;
	}
	.status-filter {
		display: grid;
		color: #cbd5e1;
	}
	.status-filter select {
		width: auto;
		min-width: 5.5rem;
		max-width: 6rem;
	}
	.posting {
		position: fixed;
		right: max(1.25rem, env(safe-area-inset-right));
		bottom: max(1.25rem, env(safe-area-inset-bottom));
		z-index: 20;
		padding: 0.9rem 1.5rem;
		border-radius: 999px;
		background: #facc55;
		color: #24332a;
		border-color: #facc55;
		box-shadow: 0 8px 28px #001e2450;
		font-size: 1rem;
	}
	.columns {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(min(19rem, 85vw), 1fr);
		grid-template-rows: auto auto;
		gap: 1.25rem;
		width: 100%;
		max-width: 100%;
		overflow-x: auto;
		padding: 0.25rem 0.1rem 1.25rem;
		scroll-snap-type: x proximity;
	}
	.column {
		min-width: 0;
		display: grid;
		grid-row: span 2;
		grid-template-rows: subgrid;
		row-gap: 0.75rem;
		scroll-snap-align: start;
	}
	.column-content {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		/* Scroll area follows the remaining viewport so long columns cut far below the floating dock. */
		max-height: max(26rem, calc(100dvh - 16rem));
		overflow-y: auto;
		padding: 0 0.2rem 1rem;
		scrollbar-width: thin;
		scrollbar-color: #ffffff60 transparent;
	}
	.column-content > :global(*) {
		flex-shrink: 0;
	}
	.column-heading {
		position: relative;
		display: grid;
		align-content: end;
		gap: 0.5rem;
		border: 1px solid #ffffff24;
		border-radius: 1rem;
		background: #164e47ed;
		padding: 1.1rem 1.25rem 1.25rem;
		box-shadow: 0 6px 20px #002a2720;
	}
	h2 {
		font-size: clamp(1.15rem, 1.6vw, 1.6rem);
		font-weight: 800;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}
	.column-count {
		padding-right: 2.5rem;
		color: #bce0d5;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.add {
		width: 100%;
		border: 1px solid #ffffff28;
		background: #ffffff18;
		color: white;
		font-size: 1.5rem;
		padding: 0;
	}
	.board-card {
		position: relative;
		min-width: 0;
		cursor: default;
		background: #fff;
		color: #0f172a;
		padding: 1rem;
		border: 1px solid #e2e8f0;
		border-radius: 0.85rem;
		box-shadow: 0 5px 16px #002a2726;
		display: grid;
		gap: 0.85rem;
		overflow-wrap: anywhere;
	}

	.board-card.color-cream {
		background: #fffaf0;
	}
	.board-card.color-rose {
		background: #ffe4e6;
	}
	.board-card.color-amber {
		background: #fff3c4;
	}
	.board-card.color-mint {
		background: #dcfce7;
	}
	.board-card.color-sky {
		background: #e0f2fe;
	}
	.board-card.color-lavender {
		background: #ede9fe;
	}
	.board-card {
		transition:
			opacity 180ms ease,
			filter 180ms ease,
			transform 180ms ease,
			box-shadow 180ms ease;
	}
	.board-card[draggable='true'] {
		cursor: grab;
	}
	.board-card.dragging {
		opacity: 0.18;
		filter: blur(2.5px) saturate(0.7);
		transform: scale(0.985);
		box-shadow: 0 0 0 2px #facc5570;
		cursor: grabbing;
	}
	.card-slot,
	.empty {
		position: relative;
		transition: transform 180ms ease;
	}
	.column-content {
		padding-top: 0.65rem;
	}
	.insert-before::before,
	.insert-after::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		height: 10px;
		top: -0.8rem;
		z-index: 4;
		pointer-events: none;
		background:
			radial-gradient(circle at 4px 4px, #facc15 0 4px, transparent 4px),
			linear-gradient(#facc15, #facc15) 5px center / calc(100% - 5px) 4px no-repeat;
		filter: drop-shadow(0 0 5px #facc15aa);
		animation: insertion-pulse 900ms ease-in-out infinite alternate;
	}
	.insert-after::after {
		top: auto;
		bottom: -0.8rem;
	}
	@keyframes insertion-pulse {
		from {
			opacity: 0.7;
			transform: scaleX(0.985);
		}
		to {
			opacity: 1;
			transform: scaleX(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.board-card,
		.card-slot,
		.insert-before::before,
		.insert-after::after {
			transition: none;
			animation: none;
		}
	}
	.card-author {
		padding-right: 2.5rem;
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
		display: grid;
		grid-template-columns: minmax(0, 7rem) 1fr;
		align-items: center;
		gap: 0.7rem;
		color: #0f172a;
		text-decoration: none;
		overflow: hidden;
		font-size: 0.85rem;
		background: #f8fafc;
		border-radius: 0.5rem;
		padding: 0.6rem;
	}
	.attachment:not(:has(.preview-image)) {
		grid-template-columns: 1fr;
	}
	.attachment span {
		min-width: 0;
		display: grid;
		gap: 0.2rem;
	}
	.attachment b {
		overflow-wrap: anywhere;
	}
	.attachment small {
		color: #64748b;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.preview-image {
		aspect-ratio: 16 / 9;
		height: 100%;
		object-fit: cover;
		border-radius: 0.45rem;
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
		color: #d0e5df;
		border: 1px dashed #ffffff38;
		border-radius: 0.85rem;
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
		color: #d0f3e6;
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
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	@media (max-width: 560px) {
		.board {
			padding-top: 9rem;
		}
		.board-tools {
			left: 0;
			right: 0;
			justify-content: flex-end;
		}
		.search {
			flex: 1 1 100%;
			min-width: 100%;
		}
	}
	.board.toolbar-hosted {
		padding-top: 1rem;
	}
	.board-tools.hosted {
		position: static;
		max-width: 100%;
	}
	.board-tools :is(button, input, select):focus-visible {
		outline: 2px solid #facc55;
		outline-offset: 2px;
	}
	.search-control {
		display: contents;
	}
	.search-toggle {
		display: none;
	}
	@media (max-width: 720px) {
		.search-control {
			display: block;
			flex: 0 0 44px;
		}
		.board-tools.hosted {
			position: relative;
			inset: auto;
		}
		.search-toggle {
			display: inline-grid;
		}
		.board-tools .search-control .search {
			display: none;
			position: absolute;
			top: calc(100% + 0.35rem);
			left: 0;
			width: 100%;
			min-width: 0;
			z-index: 30;
		}
		.board-tools .search-control.search-open .search {
			display: flex;
		}
		.board-tools .search-control input {
			background: #163b36;
			border: 1px solid #8ab8a8;
			box-shadow: 0 6px 18px #001e2466;
		}
	}
</style>
