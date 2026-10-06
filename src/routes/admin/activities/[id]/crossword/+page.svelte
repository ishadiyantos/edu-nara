<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { Container, Card, Input, Button } from '$components/ui';
	let { data, form } = $props();
	let editingId = $state<string | null>(null);
	const editing = $derived(data.entries.find((entry) => entry.id === editingId));
	let showForm = $state(untrack(() => data.entries.length === 0));
</script>

<svelte:head><title>Crossword editor — {data.activity.title}</title></svelte:head>
<main class="min-h-dvh bg-[#f7f4ec] py-6 sm:py-10">
	<Container size="app">
		<a class="link mb-6 inline-flex" href="/admin">← Back to workspace</a>
		<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
			<div>
				<p class="eyebrow text-[#1e3a5f]">Crossword · manual editor</p>
				<h1 class="mt-2 text-3xl font-black tracking-tight text-primary sm:text-4xl">
					{data.activity.title}
				</h1>
				<p class="mt-2 max-w-2xl text-sm leading-6 text-muted">
					Add clues with grid coordinates. Answers stay on server and never enter student payloads.
				</p>
			</div>
			<span
				class="rounded-2xl bg-[#1e3a5f] px-4 py-3 text-center text-white shadow-[0_5px_0_#0d1d2b]"
				><strong class="block text-2xl">{data.entries.length}</strong><small class="text-white/70"
					>entries</small
				></span
			>
		</div>
		{#if form?.message}<p
				role={form.ok ? 'status' : 'alert'}
				class="mb-5 rounded-2xl border-2 px-4 py-3 font-bold {form.ok
					? 'border-[#86d7a0] bg-[#e8f8ed] text-[#18733c]'
					: 'border-red-300 bg-red-50 text-red-700'}"
			>
				{form.message}
			</p>{/if}
		<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
			<section>
				{#if data.entries.length}
					<div class="grid gap-3">
						{#each data.entries as entry}
							<Card class="border-l-8 border-[#1e3a5f] p-5">
								<div class="flex flex-wrap items-start gap-3">
									<span
										class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1e3a5f] font-black text-white"
										>{entry.number}</span
									>
									<div class="min-w-0 flex-1">
										<h2 class="text-lg font-black text-primary">{entry.clue}</h2>
										<p class="mt-1 text-sm text-muted">
											{entry.direction} · row {entry.row}, column {entry.col} · {entry.answer
												.length} letters
										</p>
									</div>
									<div class="flex gap-2">
										<Button
											size="sm"
											variant="ghost"
											onclick={() => {
												editingId = entry.id;
												showForm = true;
											}}>Edit</Button
										>
										<form method="POST" action="?/deleteEntry" use:enhance>
											<input type="hidden" name="entryId" value={entry.id} /><Button
												size="sm"
												variant="ghost"
												type="submit">Delete</Button
											>
										</form>
									</div>
								</div>
							</Card>
						{/each}
					</div>
				{/if}
				{#if showForm}<Card class="mt-5 border-2 border-dashed border-[#1e3a5f]/40 p-5 sm:p-7">
						<div class="flex items-center justify-between gap-3">
							<div>
								<p class="eyebrow text-[#1e3a5f]">{editing ? 'Edit entry' : 'New entry'}</p>
								<h2 class="mt-1 text-xl font-black text-primary">
									{editing ? 'Update clue' : 'Add clue'}
								</h2>
							</div>
							{#if data.entries.length}<button
									type="button"
									class="min-h-11 rounded-xl px-3 text-sm font-bold text-muted hover:bg-[#f7f4ec]"
									onclick={() => {
										showForm = false;
										editingId = null;
									}}>Close</button
								>{/if}
						</div>
						{#key editingId}<form
								class="mt-6 grid gap-5"
								method="POST"
								action={editing ? '?/editEntry' : '?/addEntry'}
								use:enhance={() =>
									async ({ result, update }) => {
										await update();
										if (result.type === 'success') {
											showForm = false;
											editingId = null;
										}
									}}
							>
								{#if editing}<input type="hidden" name="entryId" value={editing.id} />{/if}
								<label
									>Answer<input
										name="answer"
										value={editing?.answer ?? ''}
										required
										maxlength="40"
										pattern="[A-Za-z0-9]+"
										placeholder="PADI"
									/></label
								>
								<Input
									label="Clue"
									name="clue"
									value={editing?.clue ?? ''}
									required
									maxlength={240}
									placeholder="Tanaman pangan sawah"
								/>
								<div class="grid gap-4 sm:grid-cols-3">
									<label
										>Row<input
											name="row"
											type="number"
											min="0"
											max="24"
											value={editing?.row ?? 0}
											required
										/></label
									><label
										>Column<input
											name="col"
											type="number"
											min="0"
											max="24"
											value={editing?.col ?? 0}
											required
										/></label
									><label
										>Direction<select name="direction" value={editing?.direction ?? 'across'}
											><option value="across">Across</option><option value="down">Down</option
											></select
										></label
									>
								</div>
								<Button type="submit" block size="lg"
									>{editing ? 'Save changes' : 'Save entry'}
									<span aria-hidden="true">→</span></Button
								>
							</form>{/key}
					</Card>{:else}<Button
						class="mt-5"
						block
						size="lg"
						onclick={() => {
							editingId = null;
							showForm = true;
						}}>+ Add clue</Button
					>{/if}
				{#if data.entries.length}<form
						class="mt-4"
						method="POST"
						action="/admin?/launch"
						target="_blank"
						rel="noopener"
					>
						<input type="hidden" name="activityId" value={data.activity.id} /><Button
							block
							variant="ghost"
							type="submit">Launch crossword session ⚡</Button
						>
					</form>{/if}
			</section>
			<aside>
				<Card class="sticky top-5 bg-[#1e3a5f] p-5 text-white"
					><p class="text-xs font-black uppercase tracking-[0.2em] text-[#fde68a]">Grid rules</p>
					<ul class="mt-4 grid gap-3 text-sm text-white/80">
						<li>Use Latin letters and numbers only.</li>
						<li>Crossing letters must match.</li>
						<li>Rows and columns start at 0.</li>
						<li>Same answer cannot repeat.</li>
						<li>Student receives clues and geometry, never answers.</li>
					</ul></Card
				>
			</aside>
		</div>
	</Container>
</main>

<style>
	label {
		display: grid;
		gap: 0.4rem;
		font-weight: 700;
		color: #1f2937;
	}
	input,
	select {
		min-height: 44px;
		width: 100%;
		border: 1px solid #cbd5e1;
		border-radius: 0.7rem;
		background: white;
		padding: 0.65rem;
		color: #0f172a;
	}
</style>
