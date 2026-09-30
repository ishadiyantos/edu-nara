<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	let selectedId = $state<string | null>(null);
	let adding = $state(false);
	const selected = $derived(data.questions.find((q) => q.id === selectedId));
</script>

<svelte:head><title>Editor Word Cloud — {data.activity.title}</title></svelte:head>
<section
	class="mx-auto max-w-2xl space-y-6 rounded-3xl border border-white/15 bg-slate-900 p-6 text-white"
>
	<a href="/admin" class="inline-flex min-h-11 items-center text-cyan-300">← Back to workspace</a>
	<h1 class="text-3xl font-black">Word Cloud · {data.activity.title}</h1>
	<p>
		Create multiple questions. The teacher controls question changes; student screens follow
		automatically. Moderation is enabled by default.
	</p>
	{#if form?.message}<p role="status">{form.message}</p>{/if}
	<ol class="space-y-3" aria-label="Saved questions">
		{#each data.questions as q, i (q.id)}
			<li class="rounded-xl border border-white/15 p-4" data-testid="wordcloud-question-item">
				<p class="break-words font-bold">{i + 1}. {q.prompt}</p>
				<p>
					{q.wordLimit} submissions/participant · {q.moderationEnabled
						? 'Moderation enabled'
						: 'No moderation'}
				</p>
				<button
					class="min-h-11 px-4 text-cyan-300"
					onclick={() => {
						selectedId = q.id;
						adding = false;
					}}>Edit</button
				>
			</li>
		{/each}
	</ol>
	<button
		class="min-h-12 rounded-xl border border-cyan-300 px-5 font-bold"
		data-testid="wordcloud-add-question"
		onclick={() => {
			selectedId = null;
			adding = true;
		}}>+ Add question</button
	>
	{#if adding || selected}
		{#key selectedId}
			<form
				method="POST"
				action="?/save"
				class="grid gap-5"
				use:enhance={() =>
					async ({ result, update }) => {
						await update({ reset: false });
						if (result.type === 'success') {
							selectedId = null;
							adding = false;
						}
					}}
			>
				<h2 class="text-xl font-bold">{selected ? 'Edit question' : 'New question'}</h2>
				<input type="hidden" name="questionId" value={selected?.id ?? ''} />
				<label class="grid gap-2"
					>Question<textarea
						name="prompt"
						required
						maxlength="1000"
						rows="3"
						class="rounded-xl bg-slate-800 p-3"
						value={selected?.prompt ?? ''}
					></textarea></label
				>
				<label class="grid gap-2"
					>Submission limit per participant<select
						name="wordLimit"
						class="min-h-11 rounded-xl bg-slate-800 p-3"
						value={selected?.wordLimit ?? 3}
						>{#each [1, 2, 3, 4, 5] as n}<option value={n}>{n} words / phrases</option
							>{/each}</select
					></label
				>
				<label class="flex min-h-11 items-center gap-3"
					><input
						name="moderationEnabled"
						type="checkbox"
						checked={selected?.moderationEnabled ?? true}
					/>Moderate before display</label
				>
				<button class="min-h-12 rounded-xl bg-cyan-300 px-5 font-black text-slate-950"
					>Save question</button
				>
				<button
					type="button"
					class="min-h-11"
					onclick={() => {
						selectedId = null;
						adding = false;
					}}>Cancel</button
				>
			</form>
		{/key}
	{/if}
	<p class="text-sm text-slate-300">
		Maximum 80 characters per submission. Duplicates from the same participant are not counted
		again. Changing moderation does not approve earlier submissions.
	</p>
	{#if data.questions.length}<form
			method="POST"
			action="/admin?/launch"
			target="_blank"
			rel="noopener"
		>
			<input type="hidden" name="activityId" value={data.activity.id} /><button
				class="min-h-12 rounded-xl border border-cyan-300 px-5 font-bold">Launch Word Cloud</button
			>
		</form>{/if}
</section>
