<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	let busy = $state(false);
	const submit: import('@sveltejs/kit').SubmitFunction = ({ formData }) => {
		busy = true;
		return async ({ update }) => {
			try {
				await update({ reset: formData.get('action') === 'create' });
			} finally {
				busy = false;
			}
		};
	};
</script>

<svelte:head><title>Editor Board — {data.activity.title}</title></svelte:head>
<div class="editor">
	<a href="/admin">← Workspace</a>
	<p class="eyebrow">Edu Nara · Board</p>
	<h1>{data.activity.title}</h1>
	<p>Susun kolom diskusi. Kartu mahasiswa tersimpan per sesi.</p>
	{#if form?.message}<p role={form.ok ? 'status' : 'alert'}>{form.message}</p>{/if}
	<section>
		<h2>Moderasi kartu</h2>
		<p>
			Aktif: kartu baru menunggu persetujuan. Nonaktif: kartu baru langsung tampil. Antrean lama
			tetap menunggu.
		</p>
		<form method="POST" use:enhance={submit}>
			<input type="hidden" name="action" value="moderation" />
			<label
				>Pengaturan moderasi<select name="enabled" value={String(data.activity.boardModeration)}
					><option value="true">Aktif</option><option value="false">Nonaktif</option></select
				></label
			>
			<button disabled={busy}>Simpan moderasi</button>
		</form>
	</section>
	<section>
		<h2>Kolom papan</h2>
		<p>Maksimal 20 kolom. Kolom hanya dapat dihapus jika kosong di semua sesi.</p>
		<form method="POST" use:enhance={submit}>
			<input type="hidden" name="action" value="create" />
			<label
				>Nama kolom baru<input
					name="title"
					required
					maxlength="120"
					placeholder="Contoh: Ide, Pertanyaan, Refleksi"
				/></label
			>
			<button disabled={busy || data.columns.length >= 20}>Tambah kolom</button>
		</form>
		<ol>
			{#each data.columns as column, index (column.id)}
				<li>
					<form method="POST" use:enhance={submit}>
						<input type="hidden" name="columnId" value={column.id} />
						<label
							>Nama kolom {index + 1}<input
								name="title"
								value={column.title}
								required
								maxlength="120"
							/></label
						>
						<button name="action" value="rename" disabled={busy}>Simpan nama</button>
						<button
							name="action"
							value="left"
							disabled={busy || index === 0}
							aria-label={`Pindahkan ${column.title} ke kiri`}>←</button
						>
						<button
							name="action"
							value="right"
							disabled={busy || index === data.columns.length - 1}
							aria-label={`Pindahkan ${column.title} ke kanan`}>→</button
						>
						<button name="action" value="delete" disabled={busy}>Hapus kolom kosong</button>
					</form>
				</li>
			{:else}<li>Belum ada kolom. Tambahkan satu untuk memulai.</li>{/each}
		</ol>
	</section>
	<form method="POST" action="/admin?/launch" target="_blank" rel="noopener">
		<input type="hidden" name="activityId" value={data.activity.id} />
		<button disabled={!data.columns.length}>Luncurkan sesi Board</button>
	</form>
</div>

<style>
	.editor {
		max-width: 64rem;
		margin: auto;
		color: #e2e8f0;
		display: grid;
		gap: 1.25rem;
	}
	.eyebrow {
		color: #fbbf24;
		font-weight: 800;
	}
	h1 {
		font-size: 2rem;
		font-weight: 900;
	}
	h2 {
		font-size: 1.2rem;
		font-weight: 800;
	}
	section {
		border: 1px solid #475569;
		border-radius: 1.25rem;
		padding: 1.25rem;
		background: #0f172a;
	}
	form {
		display: flex;
		align-items: end;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1rem;
	}
	label {
		display: grid;
		gap: 0.4rem;
		flex: 1;
		min-width: min(100%, 12rem);
	}
	input,
	select {
		width: 100%;
		color: #0f172a;
		background: white;
		border-radius: 0.6rem;
		padding: 0.75rem;
	}
	button {
		min-height: 44px;
		min-width: 44px;
		border-radius: 0.65rem;
		background: #4f46e5;
		color: white;
		padding: 0.7rem 1rem;
		font-weight: 700;
	}
	button:disabled {
		opacity: 0.45;
	}
	li {
		border-top: 1px solid #334155;
		margin-top: 1rem;
	}
	[role='alert'] {
		color: #fda4af;
	}
</style>
