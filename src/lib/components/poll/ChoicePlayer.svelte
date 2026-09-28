<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import CelebrationBurst from '$lib/components/gamification/CelebrationBurst.svelte';

	let celebration = $state(false);
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
	const questionProgress = $derived(
		questions.length ? ((question?.position ?? current) + 1) / questions.length : 0
	);
	const timerTotal = $derived(Math.max(question?.timeLimit ?? live.timerDuration ?? 30, 1));
	const timerProgress = $derived(timed ? Math.max(0, Math.min(1, remaining / timerTotal)) : 1);
	const timerText = $derived(
		!timed
			? 'Tanpa timer · menunggu dosen memulai timer'
			: remaining === 0
				? 'Waktu habis'
				: live.timerDeadline == null
					? `Timer dijeda · ${remaining}s`
					: `${remaining}s`
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
			celebration = true;
			await refreshAnswers();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Jawaban gagal dikirim.';
		} finally {
			loading = false;
		}
	}
</script>

<section class="quiz" data-testid="choice-player">
	<CelebrationBurst
		active={celebration}
		variant="neutral"
		label="Jawaban tersimpan"
		emojis={['✨', '⚡', '🌟', '🎉', '💫', '🔥']}
	/>
	<div class="arena-lights" aria-hidden="true"></div>
	<header class="hud">
		<div>
			<p class="mode-chip">{guided ? 'Terpandu presenter' : 'Mode mandiri'}</p>
			<p class="status" data-testid="session-state">
				{live.state === 'ended'
					? 'Sesi selesai'
					: live.state === 'closed'
						? 'Sesi ditutup'
						: live.state === 'draft'
							? 'Menunggu dosen membuka sesi'
							: 'Sesi terbuka'}
			</p>
		</div>
		<span class="connection" data-testid="connection" data-live={connected}
			><span aria-hidden="true"></span>{connected ? 'Terhubung' : 'Menghubungkan…'}</span
		>
	</header>
	<div class="progress" aria-hidden="true">
		<div style:width={`${questionProgress * 100}%`}></div>
	</div>

	{#if finished && !guided}
		<div class="finish-card" data-testid="quiz-finished">
			<p class="mode-chip">Final</p>
			<h2>Quiz selesai</h2>
			<p>Jawaban Anda sudah tersimpan.</p>
			<button onclick={() => (finished = false)}>Tinjau jawaban</button>
		</div>
	{:else if question}
		<div class="question-topline">
			<p class="round">Ronde {question.position + 1} dari {questions.length}</p>
			{#if guided}
				<div
					class="timer-ring"
					data-testid="quiz-timer"
					data-urgent={timed && remaining > 0 && remaining <= 5}
					data-expired={timed && remaining === 0}
					style:--timer-progress={timerProgress}
				>
					<span aria-hidden="true">{timed ? remaining : '∞'}</span>
					<b>{timerText}</b>
				</div>
			{/if}
		</div>
		<h2>{question.prompt}</h2>
		<div
			class="choices"
			data-testid="answer-grid"
			role="group"
			aria-label="Pilihan jawaban; pilih semua jawaban yang benar"
		>
			{#each question.options as option}
				<button
					type="button"
					class:selected={selected.includes(option.id)}
					aria-pressed={selected.includes(option.id)}
					disabled={!!answer || loading || blocked}
					onclick={() => toggle(option.id)}
				>
					<span class="option-letter">{String.fromCharCode(65 + option.position)}</span>
					<span class="option-label">{option.label}</span>
					<span class="option-spark" aria-hidden="true">✦</span>
				</button>
			{/each}
		</div>
		{#if answer}
			<p class="answer-saved" role="status">Jawaban tersimpan.</p>
		{:else}
			<button class="submit" disabled={!selected.length || loading || blocked} onclick={submit}
				>{loading ? 'Mengirim…' : 'Kirim jawaban'}<span aria-hidden="true">↗</span></button
			>
		{/if}
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		{#if !guided}
			<nav aria-label="Navigasi soal">
				<button disabled={current === 0 || loading} onclick={() => current--}>Sebelumnya</button>
				<button
					disabled={loading}
					onclick={() => (current < questions.length - 1 ? current++ : (finished = true))}
					>{current < questions.length - 1 ? 'Pertanyaan berikutnya' : 'Selesai'}</button
				>
			</nav>
		{/if}
	{:else}
		<div class="finish-card waiting">
			<p class="mode-chip">Stand by</p>
			<h2>Menunggu dosen membuka soal.</h2>
			<p>Siapkan layar. Pertanyaan akan muncul otomatis.</p>
		</div>
	{/if}
</section>

<style>
	.quiz {
		position: relative;
		overflow: hidden;
		border: 1px solid rgb(34 211 238 / 0.28);
		border-radius: 2rem;
		background:
			linear-gradient(135deg, rgb(15 23 42 / 0.82), rgb(49 46 129 / 0.72)),
			radial-gradient(circle at 12% 18%, rgb(34 211 238 / 0.28), transparent 34%),
			radial-gradient(circle at 88% 8%, rgb(244 114 182 / 0.22), transparent 30%);
		padding: clamp(1rem, 4vw, 2rem);
		color: white;
		box-shadow:
			0 24px 90px rgb(2 6 23 / 0.5),
			inset 0 1px 0 rgb(255 255 255 / 0.12);
		isolation: isolate;
	}
	.arena-lights {
		position: absolute;
		inset: -20%;
		z-index: -1;
		background:
			conic-gradient(from 120deg, transparent, rgb(34 211 238 / 0.16), transparent 35%),
			repeating-linear-gradient(115deg, rgb(255 255 255 / 0.06) 0 1px, transparent 1px 46px);
		animation: arenaSpin 12s linear infinite;
	}
	.hud,
	nav,
	.question-topline {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.mode-chip,
	.round {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 950;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: #67e8f9;
		text-shadow: 0 0 14px rgb(34 211 238 / 0.55);
	}
	.status {
		margin-top: 0.35rem;
		color: rgb(226 232 240 / 0.82);
		font-weight: 800;
	}
	.connection {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid rgb(255 255 255 / 0.16);
		border-radius: 999px;
		background: rgb(255 255 255 / 0.1);
		padding: 0.55rem 0.8rem;
		font-size: 0.76rem;
		font-weight: 950;
		color: rgb(255 255 255 / 0.78);
		backdrop-filter: blur(12px);
	}
	.connection span {
		height: 0.6rem;
		width: 0.6rem;
		border-radius: 999px;
		background: #fb7185;
		box-shadow: 0 0 14px rgb(251 113 133 / 0.75);
	}
	.connection[data-live='true'] span {
		background: #34d399;
		box-shadow: 0 0 14px rgb(52 211 153 / 0.8);
	}
	.progress {
		margin: 1rem 0 1.25rem;
		height: 0.55rem;
		overflow: hidden;
		border-radius: 999px;
		background: rgb(15 23 42 / 0.7);
	}
	.progress div {
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, #22d3ee, #a855f7, #fbbf24);
		box-shadow: 0 0 22px rgb(34 211 238 / 0.5);
		transition: width 300ms ease;
	}
	h2 {
		margin: 1rem 0 1.3rem;
		font-size: clamp(1.85rem, 7vw, 3.4rem);
		font-weight: 1000;
		line-height: 0.98;
		letter-spacing: -0.055em;
		text-wrap: balance;
		overflow-wrap: anywhere;
		text-shadow: 0 0 30px rgb(168 85 247 / 0.36);
		animation: questionPop 520ms cubic-bezier(0.2, 0.9, 0.2, 1);
	}
	.timer-ring {
		--timer-progress: 1;
		display: inline-grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 0.7rem;
		max-width: 100%;
		border: 1px solid rgb(251 191 36 / 0.35);
		border-radius: 999px;
		background: rgb(2 6 23 / 0.54);
		padding: 0.45rem 0.8rem 0.45rem 0.45rem;
		box-shadow: 0 0 24px rgb(251 191 36 / 0.2);
	}
	.timer-ring > span {
		display: grid;
		height: 3rem;
		width: 3rem;
		place-items: center;
		border-radius: 999px;
		background:
			conic-gradient(#fbbf24 calc(var(--timer-progress) * 1turn), rgb(255 255 255 / 0.1) 0), #111827;
		color: #fff7ed;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: 1.35rem;
		font-weight: 1000;
		line-height: 1;
	}
	.timer-ring b {
		min-width: 0;
		font-size: 0.78rem;
		font-weight: 1000;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #fde68a;
	}
	.timer-ring[data-urgent='true'] {
		animation: dangerPulse 700ms ease-in-out infinite alternate;
	}
	.timer-ring[data-expired='true'] {
		border-color: rgb(251 113 133 / 0.6);
		box-shadow: 0 0 28px rgb(251 113 133 / 0.28);
	}
	.choices {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
		margin-top: 1rem;
	}
	button {
		min-height: 48px;
		border: 0;
		border-radius: 1rem;
		padding: 0.9rem 1rem;
		font-weight: 900;
	}
	.choices button {
		position: relative;
		--choice-a: rgb(14 165 233 / 0.92);
		--choice-b: rgb(37 99 235 / 0.86);
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.85rem;
		min-height: 4.25rem;
		overflow: hidden;
		border: 1px solid rgb(255 255 255 / 0.16);
		background: linear-gradient(135deg, var(--choice-a), var(--choice-b));
		color: white;
		text-align: left;
		box-shadow: 0 14px 34px rgb(2 6 23 / 0.28);
		transition:
			transform 180ms ease,
			box-shadow 180ms ease,
			border-color 180ms ease;
		animation: cardIn 420ms cubic-bezier(0.2, 0.85, 0.2, 1) both;
	}
	.choices button:nth-child(2) {
		--choice-a: rgb(168 85 247 / 0.92);
		--choice-b: rgb(236 72 153 / 0.8);
	}
	.choices button:nth-child(3) {
		--choice-a: rgb(16 185 129 / 0.9);
		--choice-b: rgb(20 184 166 / 0.76);
	}
	.choices button:nth-child(4) {
		--choice-a: rgb(245 158 11 / 0.92);
		--choice-b: rgb(249 115 22 / 0.78);
	}
	.choices button::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(100deg, transparent, rgb(255 255 255 / 0.22), transparent);
		transform: translateX(-120%);
	}
	.choices button:hover:not(:disabled),
	.choices button:focus-visible:not(:disabled) {
		transform: translateY(-3px) scale(1.01);
		border-color: rgb(251 191 36 / 0.55);
		box-shadow: 0 18px 42px rgb(34 211 238 / 0.2);
	}
	.choices button:hover:not(:disabled)::before,
	.choices button:focus-visible:not(:disabled)::before {
		animation: shine 850ms ease;
	}
	.choices button.selected {
		border-color: #fbbf24;
		box-shadow:
			0 0 0 3px rgb(251 191 36 / 0.2),
			0 0 34px rgb(251 191 36 / 0.46),
			0 18px 42px rgb(2 6 23 / 0.35);
		transform: translateY(-2px) scale(1.015);
	}
	.option-letter {
		display: grid;
		min-width: 2.7rem;
		min-height: 2.7rem;
		place-items: center;
		border-radius: 0.9rem;
		background: rgb(2 6 23 / 0.34);
		box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.18);
		font-size: 1.15rem;
		font-weight: 1000;
	}
	.option-label {
		min-width: 0;
		font-size: clamp(1rem, 4.2vw, 1.22rem);
		overflow-wrap: anywhere;
	}
	.option-spark {
		color: #fde68a;
		opacity: 0.85;
		filter: drop-shadow(0 0 10px rgb(251 191 36 / 0.75));
	}
	.submit,
	.finish-card button,
	nav button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.55rem;
		border: 1px solid rgb(255 255 255 / 0.18);
		background: linear-gradient(135deg, #fbbf24, #fb7185);
		color: #111827;
		box-shadow: 0 18px 40px rgb(251 191 36 / 0.25);
	}
	.submit {
		width: 100%;
		margin-top: 1.2rem;
		min-height: 3.6rem;
		font-size: 1.02rem;
	}
	.answer-saved {
		margin-top: 1.2rem;
		border: 1px solid rgb(52 211 153 / 0.4);
		border-radius: 1rem;
		background: rgb(16 185 129 / 0.14);
		padding: 0.9rem 1rem;
		color: #bbf7d0;
		font-weight: 1000;
		text-align: center;
		box-shadow: 0 0 24px rgb(52 211 153 / 0.18);
	}
	nav {
		margin-top: 1rem;
	}
	nav button {
		flex: 1 1 10rem;
		background: rgb(255 255 255 / 0.12);
		color: white;
	}
	.finish-card {
		border: 1px solid rgb(255 255 255 / 0.15);
		border-radius: 1.5rem;
		background: rgb(2 6 23 / 0.35);
		padding: clamp(1rem, 4vw, 2rem);
		text-align: center;
	}
	.finish-card p:not(.mode-chip) {
		color: rgb(226 232 240 / 0.8);
		font-weight: 800;
	}
	.error {
		margin-top: 1rem;
		color: #fecdd3;
		font-weight: 800;
	}
	button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	button:focus-visible {
		outline: 3px solid #67e8f9;
		outline-offset: 3px;
	}
	@keyframes arenaSpin {
		to {
			transform: rotate(1turn);
		}
	}
	@keyframes questionPop {
		from {
			opacity: 0;
			transform: translateY(18px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	@keyframes cardIn {
		from {
			opacity: 0;
			transform: translateY(16px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	@keyframes shine {
		to {
			transform: translateX(120%);
		}
	}
	@keyframes dangerPulse {
		from {
			transform: scale(1);
		}
		to {
			transform: scale(1.04);
		}
	}
	@media (max-width: 420px) {
		.choices {
			gap: 0.65rem;
		}
		.choices button {
			grid-template-columns: auto 1fr;
			min-height: 4.7rem;
			padding: 0.75rem;
		}
		.option-spark {
			display: none;
		}
		.option-letter {
			min-width: 2.35rem;
			min-height: 2.35rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.arena-lights,
		h2,
		.choices button,
		.timer-ring[data-urgent='true'] {
			animation: none;
		}
		.progress div,
		.choices button {
			transition: none;
		}
		.choices button:hover:not(:disabled),
		.choices button:focus-visible:not(:disabled),
		.choices button.selected {
			transform: none;
		}
	}
</style>
