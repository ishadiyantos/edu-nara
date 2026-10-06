<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { Modal } from '$components/ui';
	import ActivityArt from '$lib/components/activity/ActivityArt.svelte';
	import {
		activityTypes,
		activityTemplates,
		editorPath,
		type LibraryType
	} from '$lib/activity-templates';
	let { data, form } = $props();
	let query = $state('');
	let filter = $state('all');
	let sort = $state('newest');
	let view = $state('grid');
	let createOpen = $state(false);
	let selectedType = $state<LibraryType>('choice');
	let templateId = $state('');
	let title = $state('');
	let busy = $state(false);
	let modalError = $state('');
	let editing = $state<{ id: string; title: string; ongoing: number } | null>(null);
	let operation = $state<'rename' | 'duplicate'>('rename');
	let editTitle = $state('');
	let editOpen = $state(false);
	const selectedTemplate = $derived(activityTemplates.find((t) => t.id === templateId));
	const filtered = $derived(
		data.activities
			.filter(
				(a) =>
					(filter === 'all' || a.type === filter) &&
					a.title.toLowerCase().includes(query.toLowerCase().trim())
			)
			.toSorted((a, b) =>
				sort === 'name' ? a.title.localeCompare(b.title, 'en') : b.createdAt - a.createdAt
			)
	);
	$effect(() => {
		const type = $page.url.searchParams.get('create');
		if (type && type in activityTypes) {
			selectedType = type as LibraryType;
			templateId = $page.url.searchParams.get('template') ?? '';
			title = activityTemplates.find((t) => t.id === templateId)?.title ?? '';
			modalError = '';
			createOpen = true;
		}
	});
	function openCreate(type: LibraryType) {
		selectedType = type;
		templateId = '';
		title = '';
		modalError = '';
		createOpen = true;
	}
	function edit(activity: (typeof data.activities)[number], action: 'rename' | 'duplicate') {
		editing = activity;
		operation = action;
		editTitle = action === 'duplicate' ? `Copy — ${activity.title}`.slice(0, 120) : activity.title;
		modalError = '';
		editOpen = true;
	}
	const submit: import('@sveltejs/kit').SubmitFunction = () => {
		busy = true;
		modalError = '';
		return async ({ result, update }) => {
			try {
				if (result.type === 'failure')
					modalError = String(result.data?.message ?? 'Request failed.');
				if (result.type === 'success') {
					editOpen = false;
					createOpen = false;
				}
				await update({ reset: false });
			} finally {
				busy = false;
			}
		};
	};
</script>

<svelte:head><title>My Activities — Edu Nara</title></svelte:head>
<div data-testid="admin-workspace" class="library">
	<header>
		<div>
			<h1>My Activities</h1>
			<p>{data.activities.length} saved activities · Ready for your next class</p>
		</div>
		<a href="/admin/templates">Explore templates</a>
	</header>
	<section aria-labelledby="create-heading">
		<h2 id="create-heading" class="section-heading">Create an activity</h2>
		<div class="picker" data-testid="activity-picker">
			{#each Object.entries(activityTypes) as [type, meta]}
				<button
					class="type-card"
					onclick={() => openCreate(type as LibraryType)}
					aria-label={`Create ${meta.label}`}
					><span class="illustration"><ActivityArt {type} /></span><span class="type-copy"
						><strong>{meta.label}</strong><span>{meta.description}</span></span
					></button
				>
			{/each}
		</div>
	</section>
	{#if form?.message}<p role="status" class="notice">{form.message}</p>{/if}
	<section data-testid="activity-library" aria-label="Saved activities">
		<div class="toolbar">
			<label class="search"
				>Search activities<input
					type="search"
					placeholder="Search by title"
					bind:value={query}
				/></label
			>
			<label
				>Activity type<select bind:value={filter}
					><option value="all">All types</option
					>{#each Object.entries(activityTypes) as [type, meta]}<option value={type}
							>{meta.label}</option
						>{/each}</select
				></label
			>
			<label
				>Sort by<select bind:value={sort}
					><option value="newest">Newest created</option><option value="name">Name A–Z</option
					></select
				></label
			>
			<div class="view" aria-label="Library view">
				<button aria-pressed={view === 'grid'} onclick={() => (view = 'grid')}>Grid</button><button
					aria-pressed={view === 'list'}
					onclick={() => (view = 'list')}>List</button
				>
			</div>
		</div>
		<div class:list={view === 'list'} class="activities" data-testid="library-items">
			{#each filtered as activity (activity.id)}
				{@const meta = activityTypes[activity.type as LibraryType]}
				<article data-testid="activity-card">
					{#if meta}<a
							class="preview"
							href={editorPath(activity)}
							aria-label={`Edit ${activity.title}`}
							><ActivityArt type={activity.type} /><span
								>{activity.preview ?? 'Blank activity'}</span
							></a
						>{/if}
					<div class="card-body">
						<div class="card-top">
							<span class="type-label">{meta?.label ?? 'Crossword · Unavailable'}</span
							>{#if meta}<details>
									<summary aria-label={`Actions for ${activity.title}`}>•••</summary>
									<div class="actions-menu">
										<button
											onclick={(e) => {
												e.currentTarget.closest('details')?.removeAttribute('open');
												edit(activity, 'rename');
											}}>Rename</button
										><button
											onclick={(e) => {
												e.currentTarget.closest('details')?.removeAttribute('open');
												edit(activity, 'duplicate');
											}}>Duplicate</button
										>
									</div>
								</details>{/if}
						</div>
						<h3>
							{#if meta}<a href={editorPath(activity)}>{activity.title}</a
								>{:else}{activity.title}{/if}
						</h3>
						<p class="metadata">
							{activity.contentCount}
							{activity.type === 'board'
								? 'columns'
								: activity.type === 'crossword'
									? 'clues'
									: 'questions'} · Created {new Date(activity.createdAt).toLocaleDateString(
								'en-US',
								{
									month: 'short',
									day: 'numeric',
									year: 'numeric',
									timeZone: 'UTC'
								}
							)}
						</p>
						{#if activity.ongoing}<p class="live-warning">
								Ongoing sessions: edits affect shared content. Duplicate for safe reuse.
							</p>{/if}
						{#if meta}<form method="POST" action="?/launch" target="_blank" rel="noopener">
								<input type="hidden" name="activityId" value={activity.id} />
								{#if activity.type === 'choice'}<label class="mode"
										>Quiz mode<select name="quizMode"
											><option value="guided">Presenter-guided</option><option value="self_paced"
												>Self-paced, no timer</option
											></select
										></label
									>{/if}
								<div class="card-actions">
									<a href={editorPath(activity)}>Edit</a><button class="primary"
										>Launch session</button
									>
								</div>
							</form>{/if}
					</div>
				</article>
			{:else}<div class="empty">
					{#if data.activities.length}<h3>No matching activities</h3>
						<p>Try a different title or activity type.</p>
						<button
							onclick={() => {
								query = '';
								filter = 'all';
							}}>Clear filters</button
						>{:else}<h3>Your library starts here</h3>
						<p>Choose an activity above or use a ready-to-edit template.</p>
						<a href="/admin/templates">Browse templates</a>{/if}
				</div>{/each}
		</div>
	</section>
</div>
<Modal bind:open={createOpen} title="Create activity">
	<form class="modal-form" method="POST" action="?/create" use:enhance={submit}>
		<label
			>Activity type<select
				name="type"
				bind:value={selectedType}
				onchange={() => {
					templateId = '';
					title = '';
				}}
				>{#each Object.entries(activityTypes) as [type, meta]}<option value={type}
						>{meta.label}</option
					>{/each}</select
			></label
		>
		<label
			>Starting point<select
				name="templateId"
				bind:value={templateId}
				onchange={() => (title = activityTemplates.find((t) => t.id === templateId)?.title ?? '')}
				><option value="">Start blank</option
				>{#each activityTemplates.filter((t) => t.type === selectedType) as template}<option
						value={template.id}>{template.title}</option
					>{/each}</select
			></label
		>
		{#if selectedTemplate}<p>{selectedTemplate.description}</p>{/if}
		<label
			>Activity title<input
				name="title"
				bind:value={title}
				required
				maxlength="120"
				placeholder="Name your activity"
			/></label
		>
		{#if modalError}<p role="alert">{modalError}</p>{/if}
		<button class="primary" disabled={busy}>{busy ? 'Creating…' : 'Create activity'}</button>
	</form>
</Modal>
<Modal
	bind:open={editOpen}
	title={operation === 'rename' ? 'Rename activity' : 'Duplicate activity'}
>
	<form class="modal-form" method="POST" action={`?/${operation}`} use:enhance={submit}>
		<input type="hidden" name="activityId" value={editing?.id ?? ''} />
		<label
			>Activity title<input name="title" bind:value={editTitle} required maxlength="120" /></label
		>
		<p>
			{operation === 'duplicate'
				? 'Copies questions, answer keys, settings, and columns. Sessions, student responses, cards, and images are never copied.'
				: editing?.ongoing
					? 'This title is shared with ongoing sessions.'
					: 'Update the title in your library.'}
		</p>
		{#if modalError}<p role="alert">{modalError}</p>{/if}
		<button class="primary" disabled={busy}
			>{busy ? 'Saving…' : operation === 'rename' ? 'Save title' : 'Duplicate activity'}</button
		>
	</form>
</Modal>

<style>
	.library {
		max-width: 1500px;
		margin: auto;
		display: grid;
		gap: 24px;
	}
	header {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		justify-content: space-between;
	}
	h1 {
		font-size: 1.7rem;
		font-weight: 800;
	}
	header p {
		color: #b0bccd;
		font-size: 0.875rem;
		margin-top: 4px;
	}
	header > a {
		color: #f5cd62;
		display: flex;
		align-items: center;
		font-size: 0.875rem;
	}
	.section-heading {
		font-size: 0.875rem;
		font-weight: 700;
		margin-bottom: 10px;
		color: #cbd5e1;
	}
	.picker {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}
	.type-card {
		display: grid;
		grid-template-columns: 30% 70%;
		border: 1px solid #414a5a;
		background: #222935;
		border-radius: 12px;
		overflow: hidden;
		text-align: left;
		transition: border-color 0.15s;
	}
	.type-card:hover,
	.type-card:focus-visible {
		border-color: #f5cd62;
	}
	.illustration {
		background: #303747;
		display: grid;
		place-items: center;
		border-right: 1px solid #414a5a;
	}
	.type-copy {
		padding: 16px 12px;
		display: grid;
		gap: 6px;
	}
	.type-copy strong {
		font-size: 1.05rem;
	}
	.type-copy > span {
		color: #bac5d5;
		font-size: 0.78rem;
		line-height: 1.5;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 12px;
		margin-bottom: 18px;
	}
	label {
		display: grid;
		gap: 6px;
		font-size: 0.78rem;
		font-weight: 650;
	}
	.search {
		flex: 1;
		min-width: 160px;
	}
	input,
	select {
		width: 100%;
		border: 1px solid #495365;
		background: #222935;
		color: #f1f5f9;
		border-radius: 8px;
		padding: 10px 12px;
		font-size: 0.875rem;
	}
	.view {
		display: flex;
		border: 1px solid #495365;
		border-radius: 8px;
		overflow: hidden;
	}
	button {
		padding: 9px 12px;
		font-weight: 700;
		font-size: 0.875rem;
	}
	.view button[aria-pressed='true'] {
		background: #414b60;
	}
	.activities {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 16px;
	}
	article {
		min-width: 0;
		background: #222935;
		border: 1px solid #394252;
		border-radius: 12px;
	}
	.preview {
		display: flex;
		align-items: center;
		padding: 16px;
		aspect-ratio: 16/9;
		background: #2b3343;
		border-radius: 12px 12px 0 0;
		gap: 12px;
		overflow: hidden;
	}
	.preview :global(svg) {
		width: 42%;
		flex-shrink: 0;
	}
	.preview > span {
		font-size: 0.85rem;
		font-weight: 650;
		display: -webkit-box;
		-webkit-line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
		overflow-wrap: anywhere;
	}
	.card-body {
		padding: 14px;
	}
	.card-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 28px;
	}
	.type-label {
		font-size: 0.7rem;
		font-weight: 800;
		color: #c4b5fd;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	h3 {
		font-size: 1.05rem;
		font-weight: 750;
		overflow-wrap: anywhere;
	}
	h3 a {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.metadata {
		font-size: 0.7rem;
		color: #b0bccd;
		margin-top: 8px;
	}
	.mode {
		margin-top: 12px;
	}
	.live-warning {
		color: #fde68a;
		font-size: 0.75rem;
		margin-top: 8px;
	}
	.card-actions {
		display: flex;
		gap: 8px;
		margin-top: 14px;
	}
	.card-actions a {
		border: 1px solid #596578;
		border-radius: 8px;
		padding: 10px 14px;
		display: flex;
		align-items: center;
		font-size: 0.85rem;
		font-weight: 700;
	}
	.primary {
		background: #f5cd62;
		color: #20232b;
		border-radius: 8px;
		padding: 10px 14px;
	}
	.card-actions .primary {
		flex: 1;
	}
	details {
		position: relative;
	}
	summary {
		cursor: pointer;
		min-width: 44px;
		min-height: 44px;
		display: grid;
		place-items: center;
	}
	.actions-menu {
		position: absolute;
		right: 0;
		top: 42px;
		z-index: 2;
		background: #111827;
		border: 1px solid #64748b;
		border-radius: 8px;
		display: grid;
		min-width: 140px;
		padding: 4px;
	}
	.actions-menu button {
		text-align: left;
	}
	.actions-menu button:hover {
		background: #334155;
	}
	.empty {
		grid-column: 1/-1;
		border: 1px dashed #596578;
		border-radius: 12px;
		padding: 30px;
		text-align: center;
	}
	.empty p {
		margin: 8px 0;
		color: #b0bccd;
	}
	.empty a,
	.empty button {
		color: #f5cd62;
		display: inline-flex;
		align-items: center;
	}
	.notice {
		padding: 12px;
		border: 1px solid #596578;
		border-radius: 8px;
	}
	.modal-form {
		display: grid;
		gap: 16px;
		color: #183042;
	}
	.modal-form input,
	.modal-form select {
		background: white;
		color: #183042;
		border-color: #94a3b8;
	}
	.modal-form p {
		font-size: 0.875rem;
	}
	.modal-form [role='alert'] {
		color: #b91c1c;
	}
	button:disabled {
		opacity: 0.6;
	}
	.list {
		grid-template-columns: 1fr;
	}
	.list article {
		display: grid;
		grid-template-columns: 180px 1fr;
	}
	.list .preview {
		height: 100%;
		aspect-ratio: auto;
		border-radius: 12px 0 0 12px;
		flex-direction: column;
	}
	.list .preview :global(svg) {
		width: 70%;
	}
	.list .card-actions {
		max-width: 380px;
	}
	.list .mode {
		max-width: 380px;
	}
	@media (max-width: 1200px) {
		.activities {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.list {
			grid-template-columns: 1fr;
		}
		.type-copy {
			padding: 12px 10px;
		}
	}
	@media (max-width: 650px) {
		.picker,
		.activities {
			grid-template-columns: 1fr;
		}
		.type-copy {
			padding: 16px;
		}
		.type-copy > span {
			font-size: 0.85rem;
		}
		.type-card {
			min-height: 110px;
		}
		.toolbar > label {
			flex: 1;
		}
		.search {
			flex-basis: 100% !important;
		}
		.list article {
			grid-template-columns: 1fr;
		}
		.list .preview {
			display: none;
		}
	}
</style>
