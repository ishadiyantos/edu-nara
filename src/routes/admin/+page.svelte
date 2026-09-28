<script lang="ts">
	import { enhance } from '$app/forms';
	import { Badge, Button, Card, Input } from '$components/ui';
	let { data, form } = $props();
	type ActivityType = 'choice' | 'wordcloud' | 'board' | 'crossword';
	const typeMeta: Record<
		ActivityType,
		{ label: string; color: string; gradient: string; icon: string; description: string }
	> = {
		choice: {
			label: 'Quiz',
			color: 'bg-choice',
			gradient: 'from-[#ff416c] to-[#ff4b2b]',
			icon: '◉',
			description: 'Cek pemahaman dengan cepat'
		},
		wordcloud: {
			label: 'Word Cloud',
			color: 'bg-cloud',
			gradient: 'from-[#00b4db] to-[#0083b0]',
			icon: '✦',
			description: 'Kumpulkan kata dan gagasan'
		},
		board: {
			label: 'Board',
			color: 'bg-board',
			gradient: 'from-[#f7971e] to-[#ffd200]',
			icon: '▦',
			description: 'Ruang berbagi ide bersama'
		},
		crossword: {
			label: 'Crossword',
			color: 'bg-crossword',
			gradient: 'from-[#8e2de2] to-[#4a00e0]',
			icon: '＋',
			description: 'Belajar sambil memecahkan teka-teki'
		}
	};
	const statusTone = { draft: 'neutral', open: 'success', closed: 'warning' } as const;
	const statusLabel = { draft: 'Draft', open: 'Live', closed: 'Selesai' } as const;
	let selectedType = $state<'all' | ActivityType>('all');
	let filteredActivities = $derived(
		selectedType === 'all'
			? data.activities
			: data.activities.filter((activity) => activity.type === selectedType)
	);
</script>

<svelte:head><title>Workspace — Edu Nara</title></svelte:head>

<div data-testid="admin-workspace" class="space-y-8 animate-pop-in">
	<section
		class="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1e1b4b] via-[#0f172a] to-[#020617] p-6 text-white shadow-2xl border border-white/10 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end grid gap-6"
	>
		<div
			class="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl"
			aria-hidden="true"
		></div>
		<div class="relative z-10">
			<p class="text-xs font-black uppercase tracking-[0.25em] text-amber-300">Workspace dosen</p>
			<h1 class="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-5xl leading-tight">
				Buat ruang belajar yang ingin diikuti.
			</h1>
			<p class="mt-4 max-w-xl text-base leading-7 text-white/75 font-medium">
				Pilih aktivitas, luncurkan sesi, dan biarkan mahasiswa ikut berpikir bersama—tanpa
				mengganggu alur mengajar.
			</p>
		</div>
		<div
			class="relative z-10 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md shadow-inner"
		>
			<p class="text-xs font-black uppercase tracking-widest text-amber-300">Mulai cepat</p>
			<p class="mt-2 text-lg font-bold text-white">Satu aktivitas, satu kelas</p>
			<a
				href="#buat-aktivitas"
				class="mt-4 inline-flex min-h-11 items-center rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 px-5 py-2.5 font-black text-slate-950 shadow-[0_4px_0_#b45309] transition hover:brightness-110 active:translate-y-0.5"
				>Buat aktivitas <span class="ml-2" aria-hidden="true">→</span></a
			>
		</div>
	</section>

	{#if form?.message}
		<p
			role="status"
			class="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-4 font-bold text-emerald-300 backdrop-blur-md shadow-lg"
		>
			{form.message}
		</p>
	{/if}

	<section id="buat-aktivitas" class="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
		<Card
			class="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 text-white backdrop-blur-md shadow-xl sm:p-7"
		>
			<p class="text-xs font-black uppercase tracking-[0.2em] text-[#38bdf8]">Quick start</p>
			<h2 class="mt-2 text-2xl font-black text-white">Mulai sesi baru</h2>
			<p class="mt-2 text-sm leading-6 text-white/70">
				Buat wadah aktivitas sekarang. Editor detail akan hadir bertahap di fase berikutnya.
			</p>
			<form method="POST" action="?/create" use:enhance class="mt-6 grid gap-4">
				<Input
					label="Judul aktivitas"
					name="title"
					required
					maxlength={120}
					placeholder="Contoh: Refleksi materi hari ini"
					class="rounded-xl border-white/20 bg-slate-800 text-white placeholder-white/40 focus:border-amber-400"
				/>
				<label class="grid gap-2 text-sm font-bold text-white" for="activity-type"
					>Jenis aktivitas
					<select
						id="activity-type"
						name="type"
						class="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-3 text-base font-normal text-white focus:border-amber-400 focus:outline-none"
					>
						<option value="choice" class="bg-slate-900 text-white">Quiz</option>
						<option value="wordcloud" class="bg-slate-900 text-white">Word Cloud</option>
						<option value="board" class="bg-slate-900 text-white">Board</option>
						<option value="crossword" class="bg-slate-900 text-white">Crossword</option>
					</select>
				</label>
				<Button
					type="submit"
					block
					class="mt-2 font-black bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 shadow-[0_5px_0_#b45309] hover:brightness-110 active:translate-y-1 text-base py-3 transition-all rounded-xl"
				>
					Buat aktivitas <span aria-hidden="true">→</span>
				</Button>
			</form>
		</Card>

		<div data-testid="activity-preview">
			<Card
				class="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 text-white backdrop-blur-md shadow-xl sm:p-7"
			>
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
							Pilih format yang pas
						</p>
						<h2 class="mt-2 text-2xl font-black text-white">Aktivitas untuk setiap momen</h2>
					</div>
					<span class="text-3xl text-amber-400 animate-pulse" aria-hidden="true">✳</span>
				</div>
				<div class="mt-6 grid gap-3 sm:grid-cols-2">
					{#each Object.values(typeMeta) as meta}
						<div
							class="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm hover:border-white/20 transition-all"
						>
							<span class="activity-mark {meta.color} font-black text-white shadow-md"
								>{meta.icon}</span
							>
							<p class="mt-3 font-bold text-white text-base">{meta.label}</p>
							<p class="mt-1 text-xs leading-5 text-white/70">{meta.description}</p>
						</div>
					{/each}
				</div>
			</Card>
		</div>
	</section>

	<section data-testid="activity-library">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<p class="text-xs font-black uppercase tracking-[0.2em] text-[#38bdf8]">
					Library aktivitas
				</p>
				<h2 class="mt-2 text-2xl font-black text-white">Aktivitas Anda</h2>
				<p class="mt-1 text-sm text-white/70">Temukan kembali aktivitas untuk kelas berikutnya.</p>
			</div>
			<div
				data-testid="activity-filter"
				class="flex max-w-full gap-2 overflow-x-auto pb-1"
				aria-label="Filter aktivitas"
			>
				{#each [['all', 'Semua'], ...Object.entries(typeMeta).map( ([key, meta]) => [key, meta.label] )] as [value, label]}
					<button
						type="button"
						class="min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold transition {selectedType ===
						value
							? 'border-amber-400 bg-amber-400 text-slate-950 shadow-md font-black'
							: 'border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:text-white'}"
						onclick={() => (selectedType = value as 'all' | ActivityType)}
						aria-pressed={selectedType === value}>{label}</button
					>
				{/each}
			</div>
		</div>
		<div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
			{#each filteredActivities as activity}
				{@const meta = typeMeta[activity.type as ActivityType]}
				<Card
					as="article"
					hoverable
					class="flex flex-col rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 text-white backdrop-blur-md shadow-xl transition-all hover:-translate-y-1"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="flex items-center gap-3">
							<span class="activity-mark {meta.color} font-black text-white shadow-md"
								>{meta.icon}</span
							>
							<div>
								<p class="text-xs font-black uppercase tracking-wider text-white/80">
									{meta.label}
								</p>
								<p class="mt-0.5 text-xs text-white/50">Aktivitas tersimpan</p>
							</div>
						</div>
						<Badge tone="neutral" class="bg-white/10 text-white/80 border border-white/15 font-bold"
							>Draft</Badge
						>
					</div>
					<h3 class="mt-5 line-clamp-2 text-xl font-black leading-tight text-white">
						{activity.title}
					</h3>
					<p class="mt-2 flex-1 text-sm leading-6 text-white/70">
						Siapkan konten dan luncurkan saat kelas siap dimulai.
					</p>
					<form method="POST" action="?/launch" target="_blank" rel="noopener" class="mt-5">
						<input type="hidden" name="activityId" value={activity.id} />
						{#if activity.type === 'choice' || activity.type === 'wordcloud'}
							<div class="grid gap-2 sm:grid-cols-2">
								<a
									class="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-center font-bold text-white shadow-[0_3px_0_#1e3a8a] transition hover:brightness-110 active:translate-y-0.5"
									href={`/admin/activities/${activity.id}/${activity.type === 'wordcloud' ? 'wordcloud' : 'poll'}`}
									>Buka editor <span class="ml-2" aria-hidden="true">→</span></a
								>
								<Button
									type="submit"
									block
									class="font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_3px_0_#065f46] hover:brightness-110 active:translate-y-0.5 rounded-xl"
									>Luncurkan sesi <span aria-hidden="true">→</span></Button
								>
							</div>
						{:else}
							<Button
								type="submit"
								block
								class="font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_3px_0_#065f46] hover:brightness-110 active:translate-y-0.5 rounded-xl"
								>Luncurkan sesi <span aria-hidden="true">→</span></Button
							>
						{/if}
					</form>
				</Card>
			{:else}
				<Card
					class="md:col-span-2 xl:col-span-3 rounded-[2rem] border-dashed border-white/20 bg-white/5 p-8 text-center text-white"
				>
					<p class="font-bold text-lg text-white">Belum ada aktivitas di filter ini.</p>
					<p class="mt-1 text-sm text-white/70">
						Pilih format lain atau buat aktivitas pertama di atas.
					</p>
				</Card>
			{/each}
		</div>
	</section>

	<section>
		<div class="flex items-end justify-between">
			<div>
				<p class="text-xs font-black uppercase tracking-[0.2em] text-[#38bdf8]">Monitor</p>
				<h2 class="mt-2 text-2xl font-black text-white">Sesi kelas</h2>
			</div>
			<span class="text-sm font-bold text-white/70">{data.sessions.length} sesi tersimpan</span>
		</div>
		<div
			class="mt-4 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-md shadow-xl"
		>
			{#each data.sessions as session}
				<a
					class="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-4 transition hover:bg-white/5 sm:px-5"
					href={`/admin/sessions/${session.id}`}
				>
					<span>
						<span class="block font-bold text-white text-base">{session.title}</span>
						<span class="mt-1 block font-mono text-xs text-amber-300/90 font-bold"
							>{session.code}</span
						>
					</span>
					<Badge tone={statusTone[session.state as keyof typeof statusTone] ?? 'neutral'} dot
						>{statusLabel[session.state as keyof typeof statusLabel] ?? session.state}</Badge
					>
				</a>
			{:else}
				<p class="px-5 py-8 text-sm text-white/70">
					Belum ada sesi. Luncurkan aktivitas untuk memulai.
				</p>
			{/each}
		</div>
	</section>
</div>
