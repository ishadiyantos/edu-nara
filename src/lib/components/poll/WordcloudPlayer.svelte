<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import WordcloudResults from './WordcloudResults.svelte';
	type Question = { id: string; prompt: string; wordLimit: number; showResults: boolean };
	type Response = { questionId: string; word: string; status: 'pending' | 'approved' | 'rejected' };
	let {
		sessionCode,
		sessionId,
		questions,
		activeQuestionId = null,
		responses = [],
		participantName = ''
	}: {
		sessionCode: string;
		sessionId: string;
		questions: Question[];
		activeQuestionId?: string | null;
		responses?: Response[];
		participantName?: string | null;
	} = $props();
	let syncedId = $state<string | null>(null);
	const current = $derived(
		Math.max(
			0,
			questions.findIndex((q) => q.id === (syncedId ?? activeQuestionId))
		)
	);
	const question = $derived(questions[current]);
	let value = $state('');
	let sending = $state(false);
	let message = $state('');
	let words = $state<{ word: string; weight: number }[]>([]);
	let saved = $state<Response[]>([]);
	$effect(() => {
		saved = responses;
	});
	const submitted = $derived(saved.filter((item) => item.questionId === question?.id));
	const draftKey = $derived(`edu_wc_${sessionCode}_${question?.id ?? ''}`);
	const maxWords = $derived(question?.wordLimit ?? 3);
	let revision = 0;
	async function refresh() {
		const id = question?.id;
		const request = ++revision;
		if (!id) return;
		try {
			const response = await fetch(
				`/api/wordcloud/${encodeURIComponent(sessionCode)}/responses?questionId=${encodeURIComponent(id)}`
			);
			if (!response.ok) return;
			const data = await response.json();
			if (request !== revision || question?.id !== id) return;
			words = data.words ?? [];
			saved = data.responses ?? saved;
		} catch {
			/* SSE reconnect retries. */
		}
	}
	$effect(() => {
		const key = draftKey;
		words = [];
		message = '';
		try {
			value = sessionStorage.getItem(key) ?? '';
		} catch {
			value = '';
		}
		void refresh();
	});
	onMount(() => {
		const source = new EventSource(`/api/sessions/${encodeURIComponent(sessionId)}/events`);
		const sync = (event: Event) => {
			const state = JSON.parse((event as MessageEvent).data);
			const next = state.activeQuestionId ?? state.questionId;
			if (next && questions.some((q) => q.id === next)) syncedId = next;
			void refresh();
		};
		for (const name of ['snapshot', 'resync', 'session.question'])
			source.addEventListener(name, sync);
		source.addEventListener('wordcloud.snapshot', () => {
			void refresh();
		});
		source.addEventListener('session.state', () => {
			void invalidateAll();
		});
		source.onopen = () => {
			message = 'Live';
			void refresh();
		};
		source.onerror = () => {
			message = 'Menghubungkan ulang…';
		};
		return () => {
			source.close();
			revision++;
		};
	});
	async function submit() {
		if (!question || !value.trim() || submitted.length >= maxWords || sending) return;
		const id = question.id,
			key = draftKey;
		sending = true;
		message = '';
		try {
			const response = await fetch(`/api/wordcloud/${encodeURIComponent(sessionCode)}/responses`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ questionId: id, word: value })
			});
			const result = await response.json();
			if (!response.ok || !result.ok) throw new Error(result.message ?? 'Kiriman gagal.');
			try {
				sessionStorage.removeItem(key);
			} catch {
				/* Optional storage. */
			}
			if (question?.id !== id) return;
			revision++;
			if (!result.alreadySubmitted)
				saved = [...saved, { questionId: id, word: result.word, status: result.status }];
			message = result.status === 'approved' ? 'Kiriman tampil.' : 'Kiriman menunggu moderasi.';
			value = '';
			void refresh();
		} catch (err) {
			if (question?.id === id) message = err instanceof Error ? err.message : 'Kiriman gagal.';
		} finally {
			sending = false;
		}
	}
</script>

<section
	class="rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur sm:p-8"
	data-testid="wordcloud-player"
>
	<div class="flex items-center justify-between gap-3">
		<p class="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
			Word Cloud · {current + 1}/{questions.length}
		</p>
		<span class="rounded-full bg-white/10 px-3 py-1 text-xs font-bold"
			>{submitted.length}/{maxWords} kiriman</span
		>
	</div>
	<h1 class="mt-4 text-2xl font-black leading-tight sm:text-4xl">{question?.prompt}</h1>
	<form
		class="mt-7 flex flex-col gap-3 sm:flex-row"
		onsubmit={(event) => {
			event.preventDefault();
			void submit();
		}}
	>
		<label class="sr-only" for="wordcloud-input">Kata atau frasa</label>
		<input
			id="wordcloud-input"
			bind:value
			oninput={() => {
				try {
					sessionStorage.setItem(draftKey, value);
				} catch {
					/* storage optional */
				}
			}}
			maxlength="80"
			autocomplete="off"
			placeholder="Tulis kata atau frasa…"
			class="min-h-12 min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950/60 px-4 text-base text-white placeholder-white/45 outline-none focus:border-cyan-300"
			disabled={sending || submitted.length >= maxWords}
		/>
		<button
			class="min-h-12 rounded-xl bg-cyan-400 px-5 font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
			disabled={sending || submitted.length >= maxWords || !value.trim()}
			>{sending ? 'Mengirim…' : 'Kirim'}</button
		>
	</form>
	<p class="mt-3 min-h-6 text-sm font-semibold text-cyan-100" role="status">{message}</p>
	{#if submitted.length}
		<ul class="mt-3 flex flex-wrap gap-2" aria-label="Kiriman Anda">
			{#each submitted as item}<li
					class="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm"
				>
					<span>{item.word}</span>
					<span class="text-white/55"
						>({item.status === 'approved'
							? 'tampil'
							: item.status === 'pending'
								? 'menunggu'
								: 'ditolak'})</span
					>
				</li>{/each}
		</ul>
	{/if}
	<div class="mt-6"><WordcloudResults {words} /></div>
	<nav class="student-nav" aria-label="Navigasi soal">
		<span class="student-nav-name" data-testid="student-floating-name" title="Nama tampilan"
			>👤 {participantName || 'Peserta'}</span
		>
	</nav>
</section>

<style>
	.student-nav {
		position: fixed;
		left: 50%;
		bottom: max(0.75rem, env(safe-area-inset-bottom));
		z-index: 40;
		display: flex;
		width: max-content;
		max-width: calc(100vw - 1.5rem);
		transform: translateX(-50%);
		border: 1px solid rgb(103 232 249 / 0.38);
		border-radius: 999px;
		background: rgb(2 6 23 / 0.86);
		padding: 0.4rem 0.75rem;
		box-shadow:
			0 10px 34px rgb(2 6 23 / 0.5),
			0 0 26px rgb(34 211 238 / 0.2);
		backdrop-filter: blur(16px);
	}
	.student-nav-name {
		max-width: min(12rem, 48vw);
		overflow: hidden;
		padding: 0.45rem 0.7rem;
		color: white;
		font-size: 0.8rem;
		font-weight: 950;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
