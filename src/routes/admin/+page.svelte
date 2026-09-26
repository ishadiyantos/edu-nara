<script lang="ts">
	import { Card, Button, Badge, EmptyState } from '$components/ui';

	type Activity = {
		id: string;
		title: string;
		type: 'choice' | 'wordcloud' | 'board' | 'crossword';
		status: 'draft' | 'live' | 'closed';
		participants: number;
		updated: string;
	};

	// Data mock untuk Fase 0
	const activities: Activity[] = [
		{
			id: '1',
			title: 'Survey UAS Rekayasa Perangkat Lunak',
			type: 'choice',
			status: 'live',
			participants: 87,
			updated: '2 menit lalu'
		},
		{
			id: '2',
			title: 'Kata kunci mata kuliah minggu ini',
			type: 'wordcloud',
			status: 'draft',
			participants: 0,
			updated: 'kemarin'
		},
		{
			id: '3',
			title: 'Ide proyek akhir',
			type: 'board',
			status: 'closed',
			participants: 42,
			updated: '3 hari lalu'
		}
	];

	const typeLabels: Record<Activity['type'], string> = {
		choice: 'Multiple Choice',
		wordcloud: 'Word Cloud',
		board: 'Board',
		crossword: 'Crossword'
	};
	const typeIcons: Record<Activity['type'], string> = {
		choice: '☑',
		wordcloud: '☁',
		board: '🗒',
		crossword: '⊞'
	};
	const statusTone = {
		draft: 'neutral',
		live: 'success',
		closed: 'warning'
	} as const;
	const statusLabel = { draft: 'Draft', live: 'Live', closed: 'Selesai' };

	let showEmpty = $state(false);
</script>

<svelte:head>
	<title>Dashboard — Edu Nara Admin</title>
</svelte:head>

<div class="flex items-center justify-between gap-4">
	<div>
		<h1 class="text-2xl font-bold">Aktivitas</h1>
		<p class="text-muted">Kelola aktivitas kelas Anda.</p>
	</div>
	<div class="flex gap-2">
		<Button variant="ghost" size="sm" onclick={() => (showEmpty = !showEmpty)}>
			{showEmpty ? 'Tampilkan contoh' : 'Lihat empty state'}
		</Button>
		<Button size="md">+ Aktivitas baru</Button>
	</div>
</div>

{#if showEmpty || activities.length === 0}
	<Card class="mt-6">
		<EmptyState
			title="Belum ada aktivitas"
			description="Mulai dengan membuat aktivitas Multiple Choice pertama Anda."
			icon="sparkles"
		>
			<Button>+ Aktivitas baru</Button>
		</EmptyState>
	</Card>
{:else}
	<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each activities as a}
			<Card hoverable>
				<div class="mb-3 flex items-start justify-between">
					<div class="flex items-center gap-2">
						<span
							class="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-lg text-primary"
							aria-hidden="true">{typeIcons[a.type]}</span
						>
						<span class="text-xs font-semibold uppercase tracking-wider text-muted">
							{typeLabels[a.type]}
						</span>
					</div>
					<Badge tone={statusTone[a.status]} dot>{statusLabel[a.status]}</Badge>
				</div>
				<h2 class="mb-2 line-clamp-2 text-lg font-bold leading-snug">{a.title}</h2>
				<div class="mt-4 flex items-center justify-between text-sm text-muted">
					<span>{a.participants} peserta</span>
					<span>{a.updated}</span>
				</div>
				<div class="mt-4 flex gap-2">
					<Button size="sm" variant="ghost">Edit</Button>
					<Button size="sm" href="/mock/presenter/{a.type === 'wordcloud' ? 'wordcloud' : 'choice'}"
						>Presenter</Button
					>
				</div>
			</Card>
		{/each}
	</div>
{/if}
