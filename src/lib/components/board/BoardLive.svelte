<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import BoardView from './BoardView.svelte';
	import type { PostDraft } from './PostComposer.svelte';
	import type { BoardColumn, BoardPost, PostStatus } from '$lib/board/posts';
	type Snapshot = {
		columns: BoardColumn[];
		posts: BoardPost[];
		moderationEnabled: boolean;
		state: string;
	};
	let {
		sessionId,
		sessionCode,
		initial,
		admin = false,
		presentation = false,
		refreshKey = 0,
		title = ''
	}: {
		sessionId: string;
		sessionCode: string;
		initial: Snapshot;
		admin?: boolean;
		presentation?: boolean;
		refreshKey?: number;
		title?: string;
	} = $props();
	let board = $state(untrack(() => initial));
	let error = $state('');
	let saving = $state(false);
	let mounted = false;
	let disposed = false;
	let inFlight: Promise<void> | null = null;
	let again = false;
	async function refresh() {
		if (inFlight) {
			again = true;
			return inFlight;
		}
		inFlight = (async () => {
			do {
				again = false;
				try {
					const res = await fetch(`/api/boards/${sessionCode}/posts`, { cache: 'no-store' });
					const data = await res.json();
					if (!res.ok || !data.ok) throw new Error(data.message || 'Papan gagal dimuat.');
					if (!disposed) {
						board = data;
						error = '';
					}
				} catch (err) {
					if (!disposed)
						error = err instanceof Error ? err.message : 'Koneksi terputus. Coba muat ulang.';
				}
			} while (again && !disposed);
		})();
		try {
			await inFlight;
		} finally {
			inFlight = null;
		}
	}
	async function request(path: string, body: FormData | Record<string, unknown>) {
		const multipart = body instanceof FormData;
		const res = await fetch(path, {
			method: 'POST',
			headers: multipart ? {} : { 'Content-Type': 'application/json' },
			body: multipart ? body : JSON.stringify(body)
		});
		let data;
		try {
			data = await res.json();
		} catch {
			throw new Error(`Permintaan gagal (${res.status}). Coba lagi.`);
		}
		if (!res.ok || !data.ok) throw new Error(data.message || 'Permintaan gagal.');
		await refresh();
		return data;
	}
	async function post(payload: PostDraft) {
		const body = new FormData();
		for (const key of ['columnId', 'body', 'title', 'linkUrl', 'requestId'] as const)
			body.set(key, payload[key]);
		if (payload.image) body.set('image', payload.image);
		await request(`/api/boards/${sessionCode}/posts`, body);
	}
	async function moderate(payload: { postId: string; status: PostStatus }) {
		await request(`/api/boards/posts/${payload.postId}/moderate`, { status: payload.status });
	}
	async function reorder(payload: { columnId: string; posts: BoardPost[] }) {
		await request(`/api/boards/${sessionCode}/columns/${payload.columnId}/order`, {
			ids: payload.posts.map((p) => p.id)
		});
	}
	async function move(payload: { postId: string; targetColumnId: string; targetPosition: number }) {
		await request(`/api/boards/${sessionCode}/posts/${payload.postId}/move`, {
			columnId: payload.targetColumnId,
			position: payload.targetPosition
		});
	}
	async function renameColumn(payload: { columnId: string; title: string }) {
		await request(`/api/boards/${sessionCode}/columns/${payload.columnId}`, {
			title: payload.title
		});
	}
	async function createColumn(title: string) {
		await request(`/api/boards/${sessionCode}/columns`, { title });
	}
	async function shareBoard() {
		try {
			const canShare = 'share' in navigator && typeof navigator.share === 'function';
			if (canShare) await navigator.share({ title, url: window.location.href });
			else await navigator.clipboard.writeText(window.location.href);
		} catch {
			/* User cancelled native share. */
		}
	}
	async function toggle() {
		if (saving) return;
		saving = true;
		error = '';
		try {
			await request(`/api/boards/${sessionCode}/settings`, {
				moderationEnabled: !board.moderationEnabled
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Pengaturan gagal disimpan.';
		} finally {
			saving = false;
		}
	}
	onMount(() => {
		mounted = true;
		void refresh();
		const source = admin ? null : new EventSource(`/api/sessions/${sessionId}/events`);
		if (source) {
			source.onopen = () => {
				void refresh();
			};
			source.onerror = () => {
				/* EventSource reconnects automatically. */
			};
			for (const name of [
				'snapshot',
				'resync',
				'session.state',
				'board.post.new',
				'board.post.moderated',
				'board.post.removed',
				'board.reordered'
			])
				source.addEventListener(name, () => void refresh());
		}
		// Recover snapshots even if an intermediary silently drops an invalidation.
		const timer = setInterval(() => void refresh(), 15000);
		return () => {
			disposed = true;
			mounted = false;
			source?.close();
			clearInterval(timer);
		};
	});
	$effect(() => {
		void refreshKey;
		if (mounted) void refresh();
	});
</script>

<section class="live-board" aria-label="Papan kolaborasi">
	{#if title}<h1>{title}</h1>{/if}
	{#if board.state !== 'open'}<p role="status" class="hint">
			{board.state === 'draft'
				? 'Menunggu dosen membuka sesi.'
				: board.state === 'ended'
					? 'Sesi selesai. Papan tetap dapat dibaca.'
					: 'Kiriman ditutup sementara.'}
		</p>{/if}
	{#if error}<div role="alert" class="error">
			{error} <button onclick={() => void refresh()}>Muat ulang</button>
		</div>{/if}
	<BoardView
		columns={board.columns}
		posts={board.posts}
		{admin}
		{presentation}
		showOwn={!admin}
		disabled={board.state !== 'open'}
		onpost={admin ? undefined : post}
		onmoderate={admin ? moderate : undefined}
		onreorder={admin ? reorder : undefined}
		onmove={admin ? move : undefined}
		onrenamecolumn={admin ? renameColumn : undefined}
		onaddcolumn={admin ? createColumn : undefined}
		onshare={shareBoard}
		moderationEnabled={board.moderationEnabled}
		ontogglemoderation={admin && !presentation ? toggle : undefined}
		{saving}
	/>
</section>

<style>
	.live-board {
		width: 100%;
		max-width: 100%;
		min-width: 0;
		padding: clamp(1rem, 2vw, 2rem);
		border-radius: 1.25rem;
		color: white;
		background:
			radial-gradient(ellipse at 95% 0%, #52715266, transparent 55%),
			linear-gradient(135deg, #163b36, #214c48 55%, #173c45);
	}
	h1 {
		font-size: clamp(1.5rem, 3vw, 2.5rem);
		font-weight: 900;
		margin-bottom: 1rem;
		overflow-wrap: anywhere;
	}
	button {
		min-height: 44px;
		border: 1px solid #818cf8;
		border-radius: 0.65rem;
		padding: 0.65rem 1rem;
		background: #4338ca;
		color: white;
		font-weight: 700;
	}
	button:disabled {
		opacity: 0.5;
	}
	.hint {
		font-size: 0.85rem;
		margin-bottom: 1rem;
	}
	.error {
		color: #9f1239;
		background: #fff1f2;
		padding: 1rem;
		border-radius: 0.8rem;
		margin-bottom: 1rem;
	}
</style>
