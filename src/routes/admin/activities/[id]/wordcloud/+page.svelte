<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<svelte:head><title>Editor Word Cloud — {data.activity.title}</title></svelte:head>
<section
	class="mx-auto max-w-2xl space-y-6 rounded-3xl border border-white/15 bg-slate-900 p-6 text-white"
>
	<a href="/admin" class="inline-flex min-h-11 items-center text-cyan-300">← Kembali ke workspace</a
	>
	<h1 class="text-3xl font-black">Word Cloud · {data.activity.title}</h1>
	<p>
		Kumpulkan kata atau frasa pendek. Satu pertanyaan per aktivitas. Kiriman baru hanya tampil
		setelah disetujui jika moderasi aktif.
	</p>
	{#if form?.message}<p role="status">{form.message}</p>{/if}
	<form method="POST" use:enhance class="grid gap-5">
		<label class="grid gap-2"
			>Pertanyaan<textarea
				name="prompt"
				required
				maxlength="1000"
				rows="3"
				class="rounded-xl bg-slate-800 p-3"
				value={data.question?.prompt ?? ''}
			></textarea></label
		>
		<label class="grid gap-2"
			>Batas kiriman per peserta<select
				name="wordLimit"
				class="min-h-11 rounded-xl bg-slate-800 p-3"
				value={data.question?.wordLimit ?? 3}
				>{#each [1, 2, 3, 4, 5] as n}<option value={n}>{n} kata / frasa</option>{/each}</select
			></label
		>
		<label class="flex min-h-11 items-center gap-3"
			><input
				name="moderationEnabled"
				type="checkbox"
				checked={data.question?.moderationEnabled ?? true}
			/>Moderasi sebelum tampil</label
		>
		<p class="text-sm text-slate-300">
			Maksimal 80 karakter per kiriman. Duplikat dari peserta yang sama tidak dihitung ulang.
			Perubahan moderasi tidak otomatis menyetujui kiriman lama.
		</p>
		<button class="min-h-12 rounded-xl bg-cyan-300 px-5 font-black text-slate-950"
			>Simpan Word Cloud</button
		>
	</form>
	{#if data.question}<form method="POST" action="/admin?/launch">
			<input type="hidden" name="activityId" value={data.activity.id} /><button
				class="min-h-12 rounded-xl border border-cyan-300 px-5 font-bold"
				>Luncurkan Word Cloud</button
			>
		</form>{/if}
</section>
