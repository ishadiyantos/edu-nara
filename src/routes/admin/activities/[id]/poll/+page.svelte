<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Card, Container, Input } from '$components/ui';
	let { data, form } = $props();
	let showForm = $state(false);
	let editingId = $state<string | null>(null);
	const editing = $derived(data.questions.find((question) => question.id === editingId));
</script>

<svelte:head><title>Quiz editor — {data.activity.title}</title></svelte:head>
<main class="min-h-dvh bg-[#f7f4ec] py-6 sm:py-10">
	<Container size="app">
		<a class="link mb-6 inline-flex" href="/admin">← Back to workspace</a>
		<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
			<section>
				<div class="mb-5 flex items-end justify-between gap-4">
					<div>
						<p class="eyebrow text-[#5967e8]">Quiz · question bank</p>
						<h1 class="mt-2 text-3xl font-black tracking-tight text-primary sm:text-4xl">
							Build your quiz
						</h1>
						<p class="mt-2 text-sm leading-6 text-muted">
							Add questions and mark all correct answers.
						</p>
					</div>
					<span
						class="hidden rounded-2xl bg-primary px-4 py-3 text-center text-white shadow-[0_5px_0_#0d1d2b] sm:block"
						><strong class="block text-2xl">{data.questions.length}</strong><small
							class="text-white/60">questions</small
						></span
					>
				</div>
				{#if form?.message}<p
						role="status"
						class="mb-5 rounded-2xl border-2 border-[#86d7a0] bg-[#e8f8ed] px-4 py-3 font-bold text-[#18733c]"
					>
						{form.message}
					</p>{/if}
				<div class="grid gap-3">
					{#each data.questions as question, i}
						<Card class="border-l-8 border-[#5967e8] p-5 sm:p-6"
							><div class="flex items-start gap-4">
								<span
									class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#5967e8] font-black text-white"
									>{i + 1}</span
								>
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<p class="text-lg font-black leading-6 text-primary">{question.prompt}</p>
										<span
											class="inline-flex items-center gap-1 rounded-full bg-[#fff7e6] px-2.5 py-0.5 text-[11px] font-black text-[#8a5a00] border border-[#f3ad3d]/50"
										>
											⏱ {question.timeLimit}s
										</span>
									</div>
									<form class="mt-4" method="POST" action="?/setCorrect" use:enhance>
										<input type="hidden" name="questionId" value={question.id} />
										<div class="grid gap-2 sm:grid-cols-2">
											{#each question.options as option, optionIndex}<label
													class="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-[#f7f4ec] px-3 py-2 text-sm font-semibold text-primary has-[:checked]:bg-[#e8f8ed]"
													><input
														class="h-4 w-4 accent-[#18733c]"
														type="checkbox"
														name={`option${optionIndex}`}
														value={option.id}
														checked={option.isCorrect}
														aria-label={`Mark option ${String.fromCharCode(65 + optionIndex)} as correct`}
													/><span class="font-black text-[#5967e8]"
														>{String.fromCharCode(65 + optionIndex)}</span
													>{option.label}{#if option.isCorrect}<span
															class="ml-auto text-xs font-black text-[#18733c]">CORRECT</span
														>{/if}</label
												>{/each}
										</div>
										<Button class="mt-3" type="submit" variant="ghost" size="sm"
											>Save correct answers</Button
										>
									</form>
									<Button
										class="mt-2"
										variant="ghost"
										size="sm"
										onclick={() => {
											editingId = question.id;
											showForm = true;
										}}>Edit question</Button
									>
								</div>
							</div></Card
						>
					{/each}
				</div>
				{#if data.questions.length === 0 || showForm}
					<Card class="mt-5 border-2 border-dashed border-[#5967e8]/40 p-5 sm:p-7"
						><div class="flex items-center justify-between gap-3">
							<div>
								<p class="eyebrow text-[#5967e8]">
									{editing ? 'Edit question' : 'New question'}
								</p>
								<h2 class="mt-1 text-xl font-black text-primary">
									{editing ? 'Edit challenge' : 'Add challenge'}
								</h2>
							</div>
							<button
								type="button"
								class="min-h-11 rounded-xl px-3 text-sm font-bold text-muted hover:bg-[#f7f4ec]"
								onclick={() => {
									showForm = false;
									editingId = null;
								}}>Close</button
							>
						</div>
						{#key editingId}
							<form
								method="POST"
								action={editing ? '?/editQuestion' : '?/addQuestion'}
								use:enhance={() =>
									async ({ result, update }) => {
										await update();
										if (result.type === 'success') {
											showForm = false;
											editingId = null;
										}
									}}
								class="mt-6 grid gap-5"
							>
								<input type="hidden" name="questionId" value={editingId ?? ''} />
								<Input
									label="Question"
									name="prompt"
									value={editing?.prompt ?? ''}
									required
									maxlength={1000}
									placeholder="Example: What is the capital of Indonesia?"
								/>
								<fieldset>
									<legend class="mb-3 text-sm font-bold text-primary"
										>Answer choices <span class="font-normal text-muted"
											>— select all correct answers</span
										></legend
									>
									<div class="grid gap-3 sm:grid-cols-2">
										{#each ['A', 'B', 'C', 'D'] as letter, i}<div
												class="relative rounded-2xl border-2 border-border bg-white p-3 transition has-[:checked]:border-[#5967e8] has-[:checked]:bg-[#eef0ff]"
											>
												<label class="flex items-center gap-3"
													><input
														class="h-5 w-5 accent-[#5967e8]"
														type="checkbox"
														name={`correct${i}`}
														value="on"
														checked={editing?.options[i]?.isCorrect ?? false}
														aria-label={`Mark option ${letter} as correct`}
													/><span
														class="grid h-8 w-8 place-items-center rounded-lg bg-[#5967e8] text-sm font-black text-white"
														>{letter}</span
													><input
														class="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-primary outline-none"
														name={`option${letter}`}
														aria-label={`Answer ${letter}`}
														value={editing?.options[i]?.label ?? ''}
														required={i < 2}
														maxlength="200"
														placeholder={`Answer ${letter}`}
													/></label
												>
												<p
													class="mt-2 pl-11 text-[11px] font-bold uppercase tracking-wider text-muted"
												>
													Select for a correct answer
												</p>
											</div>{/each}
									</div>
								</fieldset>
								<fieldset>
									<legend class="mb-3 text-sm font-bold text-primary"
										>Answer time <span class="font-normal text-muted"
											>— seconds students have to answer this question</span
										></legend
									>
									<div class="flex flex-wrap gap-2">
										{#each [10, 20, 30, 45, 60, 90] as seconds}<label
												class="cursor-pointer rounded-xl border-2 border-border bg-white px-4 py-2 text-sm font-black text-primary transition has-[:checked]:border-[#f3ad3d] has-[:checked]:bg-[#fff7e6]"
											>
												<input
													class="sr-only"
													type="radio"
													name="timeLimit"
													value={seconds}
													checked={seconds === (editing?.timeLimit ?? 20)}
												/>{seconds}s</label
											>{/each}
									</div>
								</fieldset>
								<Button type="submit" block size="lg"
									>{editing ? 'Save changes' : 'Save question'}
									<span aria-hidden="true">→</span></Button
								>
							</form>{/key}</Card
					>
				{:else}<Button
						class="mt-5"
						block
						size="lg"
						onclick={() => {
							editingId = null;
							showForm = true;
						}}>+ Add question</Button
					>{/if}
				{#if data.questions.length}<form
						class="mt-4"
						method="POST"
						action="/admin?/launch"
						target="_blank"
						rel="noopener"
					>
						<input type="hidden" name="activityId" value={data.activity.id} /><label
							class="mb-3 grid gap-1 text-sm font-bold text-primary"
							>Quiz mode<select
								name="quizMode"
								class="rounded-xl border border-border bg-white px-3 py-2 text-sm"
								><option value="guided">Presenter-guided</option><option value="self_paced"
									>Self-paced, no timer</option
								></select
							></label
						><Button type="submit" variant="ghost" block
							>Launch quiz <span aria-hidden="true">⚡</span></Button
						>
					</form>{/if}
			</section>
			<aside data-testid="poll-preview">
				<Card class="sticky top-5 overflow-hidden bg-primary p-0 text-white"
					><div class="relative p-5 sm:p-6">
						<div
							class="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[#5967e8]/50 blur-2xl"
							aria-hidden="true"
						></div>
						<p class="relative text-xs font-black uppercase tracking-[0.2em] text-[#9fe7dd]">
							Student preview
						</p>
						<p class="relative mt-5 text-xs font-bold text-white/60">
							ROUND 1 · Select all correct answers
						</p>
						<p class="relative mt-2 text-xl font-black leading-7">What is your answer?</p>
						<div class="relative mt-5 grid gap-2">
							{#each ['First choice', 'Second choice', 'Third choice', 'Fourth choice'] as option, i}<div
									class="flex min-h-12 items-center gap-3 rounded-xl {[
										'bg-[#ff6b4a]',
										'bg-[#2ab7a9]',
										'bg-[#5967e8]',
										'bg-[#f3ad3d]'
									][i]} px-3 font-bold"
								>
									<span class="grid h-7 w-7 place-items-center rounded-lg bg-black/15 text-xs"
										>{['A', 'B', 'C', 'D'][i]}</span
									>{option}
								</div>{/each}
						</div>
					</div>
					<div
						class="border-t border-white/10 px-5 py-4 text-center text-sm font-bold text-white/60"
					>
						Lock in your answer → earn points
					</div></Card
				>
			</aside>
		</div>
	</Container>
</main>
