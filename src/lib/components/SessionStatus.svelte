<script lang="ts">
	import { onMount, untrack } from 'svelte';
	let { snapshot } = $props<{
		snapshot: { id: string; code: string; title: string; state: string; count: number };
	}>();
	let live = $state(untrack(() => snapshot));
	let connection = $state('Menghubungkan…');
	const labels: Record<string, string> = {
		draft: 'Menunggu dosen membuka sesi',
		open: 'Sesi terbuka',
		closed: 'Sesi ditutup',
		ended: 'Sesi selesai'
	};
	onMount(() => {
		const stream = new EventSource(`/api/sessions/${snapshot.id}/events`);
		const full = (event: MessageEvent) => {
			const next = JSON.parse(event.data);
			if (snapshot.state !== 'open' && next.state === 'open') window.location.reload();
			live = next;
		};
		stream.addEventListener('snapshot', full);
		stream.addEventListener('resync', full);
		stream.addEventListener('participant.count', (event) => {
			live = { ...live, count: JSON.parse(event.data).count };
		});
		stream.addEventListener('session.state', (event) => {
			const next = JSON.parse(event.data).state;
			if (snapshot.state !== 'open' && next === 'open') window.location.reload();
			live = { ...live, state: next };
		});
		stream.onopen = () => (connection = 'Terhubung');
		stream.onerror = () => (connection = 'Koneksi terputus. Menghubungkan ulang…');
		return () => stream.close();
	});
</script>

<div class="my-4 space-y-3" aria-live="polite">
	<p data-testid="connection" class="text-sm text-muted">{connection}</p>
	<p data-testid="session-state" class="text-xl font-bold">{labels[live.state]}</p>
	<p>Total peserta bergabung: <strong data-testid="participant-count">{live.count}</strong></p>
</div>
<noscript>JavaScript nonaktif. Muat ulang halaman untuk memperbarui status.</noscript>
