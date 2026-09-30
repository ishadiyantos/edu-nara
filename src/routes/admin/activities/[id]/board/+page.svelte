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
	<p>Organize discussion columns. Student cards are stored per session.</p>
	{#if form?.message}<p role={form.ok ? 'status' : 'alert'}>{form.message}</p>{/if}
	<section>
		<h2>Card moderation</h2>
		<p>
			Enabled: new cards await approval. Disabled: new cards appear immediately. Earlier pending
			cards still await approval.
		</p>
		<form method="POST" use:enhance={submit}>
			<input type="hidden" name="action" value="moderation" />
			<label
				>Moderation settings<select name="enabled" value={String(data.activity.boardModeration)}
					><option value="true">Aktif</option><option value="false">Nonaktif</option></select
				></label
			>
			<button disabled={busy}>Save moderation</button>
		</form>
	</section>
	<section>
		<h2>Board columns</h2>
		<p>Maximum 20 columns. A column can only be deleted if it is empty in all sessions.</p>
		<form method="POST" use:enhance={submit}>
			<input type="hidden" name="action" value="create" />
			<label
				>New column name<input
					name="title"
					required
					maxlength="120"
					placeholder="Example: Ideas, Questions, Reflection"
				/></label
			>
			<button disabled={busy || data.columns.length >= 20}>Add column</button>
		</form>
		<ol>
			{#each data.columns as column, index (column.id)}
				<li>
					<form method="POST" use:enhance={submit}>
						<input type="hidden" name="columnId" value={column.id} />
						<label
							>Column name {index + 1}<input
								name="title"
								value={column.title}
								required
								maxlength="120"
							/></label
						>
						<button name="action" value="rename" disabled={busy}>Save name</button>
						<button
							name="action"
							value="left"
							disabled={busy || index === 0}
							aria-label={`Move ${column.title} left`}>←</button
						>
						<button
							name="action"
							value="right"
							disabled={busy || index === data.columns.length - 1}
							aria-label={`Move ${column.title} right`}>→</button
						>
						<button name="action" value="delete" disabled={busy}>Delete empty column</button>
					</form>
				</li>
			{:else}<li>No columns yet. Add one to get started.</li>{/each}
		</ol>
	</section>
	<form method="POST" action="/admin?/launch" target="_blank" rel="noopener">
		<input type="hidden" name="activityId" value={data.activity.id} />
		<button disabled={!data.columns.length}>Launch Board session</button>
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
