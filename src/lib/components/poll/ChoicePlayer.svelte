<script lang="ts">
	import { onMount, untrack } from 'svelte';
	type Question = {
		id: string;
		prompt: string;
		position: number;
		showResults: boolean;
		timeLimit: number;
		options: { id: string; label: string; position: number }[];
	};
	type Answer = {
		questionId: string;
		optionIds: string[];
	};
	type Snapshot = {
		state: string;
		quizMode: 'guided' | 'self_paced';
		activeQuestionId: string | null;
		timerDeadline: number | null;
		timerDuration: number;
		serverNow: number;
	};
	let {
		sessionCode,
		sessionId,
		questions,
		responses = [],
		snapshot
	}: {
		sessionCode: string;
		sessionId: string;
		questions: Question[];
		responses?: Answer[];
		snapshot: Snapshot;
	} = $props();
	let live = $state(untrack(() => snapshot));
	let saved = $state<Answer[]>(untrack(() => responses));
	let current = $state(0);
	let selected = $state<string[]>([]);
	let loading = $state(false);
	let error = $state('');
	let connected = $state(false);
	let finished = $state(false);
	let now = $state(Date.now());
	let offset = $state(untrack(() => snapshot.serverNow - Date.now()));

	const guided = $derived(live.quizMode === 'guided');
	const question = $derived(
		guided ? questions.find((q) => q.id === live.activeQuestionId) : questions[current]
	);
	const answer = $derived(saved.find((a) => a.questionId === question?.id));
	const remaining = $derived(
		Math.max(
			0,
			Math.ceil(
				(live.timerDeadline == null ? live.timerDuration : live.timerDeadline - now - offset) / 1000
			)
		)
	);
	const timed = $derived(guided && (live.timerDeadline != null || live.timerDuration > 0));
	const blocked = $derived(
		live.state !== 'open' || (timed && (live.timerDeadline == null || remaining === 0))
	);
	const draftKey = (id: string) => `edu_mc_${sessionCode}_${id}`;
	function applyLive(value: Partial<Snapshot>) {
		live = { ...live, ...value };
		if (value.serverNow != null) offset = value.serverNow - Date.now();
	}
	async function refreshAnswers() {
		try {
			const res = await fetch(`/api/polls/${sessionCode}/responses`);
			if (!res.ok) return;
			const data = await res.json();
			saved = data.responses;
			applyLive(data.snapshot);
		} catch {
			/* Reconnect retries authenticated snapshot. */
		}
	}
	$effect(() => {
		const id = question?.id;
		const restored = answer?.optionIds;
		selected = restored ? [...restored] : [];
		error = '';
		if (!id) return;
		if (!restored) {
			try {
				const draft = JSON.parse(sessionStorage.getItem(draftKey(id)) ?? '[]');
				if (Array.isArray(draft))
					selected = draft.filter((v) => question?.options.some((o) => o.id === v));
			} catch {
				/* Private browsing may disable storage. */
			}
		}
	});
	onMount(() => {
		const first = questions.findIndex((q) => !saved.some((a) => a.questionId === q.id));
		current = first < 0 ? Math.max(0, questions.length - 1) : first;
		const tick = setInterval(() => (now = Date.now()), 250);
		const source = new EventSource(`/api/sessions/${sessionId}/events`);
		source.onopen = () => {
			connected = true;
			void refreshAnswers();
		};
		source.onerror = () => (connected = false);
		for (const name of ['snapshot', 'resync', 'session.question', 'session.state'])
			source.addEventListener(name, (event) => {
				applyLive(JSON.parse((event as MessageEvent).data));
				void refreshAnswers();
			});
		return () => {
			clearInterval(tick);
			source.close();
		};
	});
	function toggle(id: string) {
		if (answer || loading || blocked) return;
		selected = selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id];
		try {
			sessionStorage.setItem(draftKey(question!.id), JSON.stringify(selected));
		} catch {
			/* Optional draft only. */
		}
	}
	async function submit() {
		if (!question || !selected.length || answer || loading || blocked) return;
		const id = question.id;
		loading = true;
		error = '';
		try {
			const res = await fetch(`/api/polls/${sessionCode}/responses`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ questionId: id, optionIds: selected })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message ?? 'Jawaban gagal dikirim.');
			saved = [
				...saved.filter((a) => a.questionId !== id),
				{
					questionId: id,
					optionIds: data.optionIds
				}
			];
			try {
				sessionStorage.removeItem(draftKey(id));
			} catch {
				/* Optional draft only. */
			}
			await refreshAnswers();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Jawaban gagal dikirim.';
		} finally {
			loading = false;
		}
	}
</script>

<section class="quiz" data-testid="choice-player">
	<header>
		<p>{guided ? 'Terpandu presenter' : 'Mandiri · tanpa timer'}</p>
		<span data-testid="connection">{connected ? 'Terhubung' : 'Menghubungkan…'}</span>
	</header>
	<p class="status" data-testid="session-state">
		{live.state === 'ended'
			? 'Sesi selesai'
			: live.state === 'closed'
				? 'Sesi ditutup'
				: live.state === 'draft'
					? 'Menunggu dosen membuka sesi'
					: 'Sesi terbuka'}
	</p>
	{#if finished && !guided}<div data-testid="quiz-finished">
			<h2>Quiz selesai</h2>
			<p>Jawaban Anda sudah tersimpan.</p>
			<button onclick={() => (finished = false)}>Tinjau jawaban</button>
		</div>
	{:else if question}
		<p class="round">Ronde {question.position + 1} dari {questions.length}</p>
		<h2>{question.prompt}</h2>
		{#if guided}<p data-testid="quiz-timer">
				{!timed
					? 'Tanpa timer · menunggu dosen memulai timer'
					: remaining === 0
						? 'Waktu habis'
						: live.timerDeadline == null
							? `Timer dijeda · ${remaining}s`
							: `${remaining}s`}
			</p>{/if}
		<div class="choices" role="group" aria-label="Pilihan jawaban; pilih semua jawaban yang benar">
			{#each question.options as option}
				<button
					type="button"
					class:selected={selected.includes(option.id)}
					aria-pressed={selected.includes(option.id)}
					disabled={!!answer || loading || blocked}
					onclick={() => toggle(option.id)}
					><span>{String.fromCharCode(65 + option.position)}</span>{option.label}</button
				>
			{/each}
		</div>
		{#if answer}<p class="status" role="status">Jawaban tersimpan.</p>
		{:else}<button class="submit" disabled={!selected.length || loading || blocked} onclick={submit}
				>{loading ? 'Mengirim…' : 'Kirim jawaban'}</button
			>{/if}
		{#if error}<p role="alert">{error}</p>{/if}
		{#if !guided}<nav aria-label="Navigasi soal">
				<button disabled={current === 0 || loading} onclick={() => current--}>Sebelumnya</button
				><button
					disabled={loading}
					onclick={() => (current < questions.length - 1 ? current++ : (finished = true))}
					>{current < questions.length - 1 ? 'Pertanyaan berikutnya' : 'Selesai'}</button
				>
			</nav>{/if}
	{:else}<h2>Menunggu dosen membuka soal.</h2>{/if}
</section>

<style>
	.quiz {
		border: 1px solid rgb(255 255 255 / 0.15);
		border-radius: 2rem;
		background: #111827;
		padding: clamp(1.25rem, 5vw, 2rem);
		color: white;
	}
	header,
	nav {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	header,
	.round {
		color: #7dd3fc;
		font-weight: 800;
	}
	h2 {
		margin: 1rem 0 1.5rem;
		font-size: clamp(1.5rem, 5vw, 2.25rem);
		font-weight: 900;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}
	.choices {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
	}
	button {
		min-height: 48px;
		border: 1px solid rgb(255 255 255 / 0.3);
		border-radius: 1rem;
		padding: 0.9rem 1rem;
		color: white;
		font-weight: 800;
		text-align: left;
		background: #1e293b;
	}
	.choices button {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: #4338ca;
	}
	.choices button:nth-child(2n) {
		background: #0369a1;
	}
	.choices button.selected {
		outline: 3px solid #fbbf24;
		outline-offset: 2px;
	}
	button:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}
	.choices span {
		display: inline-grid;
		min-width: 2rem;
		min-height: 2rem;
		place-items: center;
		border-radius: 0.5rem;
		background: rgb(0 0 0 / 0.2);
	}
	.submit {
		width: 100%;
		margin-top: 1.25rem;
		text-align: center;
		background: #fbbf24;
		color: #172033;
	}
	.status,
	.round,
	nav {
		margin-top: 1rem;
	}
	[role='alert'] {
		color: #fda4af;
		margin-top: 1rem;
	}
	button:focus-visible {
		outline: 3px solid #67e8f9;
		outline-offset: 3px;
	}
</style>
