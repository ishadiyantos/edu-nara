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
		responses = []
	}: {
		sessionCode: string;
		sessionId: string;
		questions: Question[];
		responses?: Response[];
	} = $props();
	let current = $state(0);
	let value = $state('');
	let sending = $state(false);
	let message = $state('');
	let words = $state<{ word: string; weight: number }[]>([]);
	let saved = $state<Response[]>([]);
	$effect(() => {
		saved = responses;
	});
	const question = $derived(questions[current]);
	const submitted = $derived(saved.filter((item) => item.questionId === question?.id));
	const draftKey = $derived(`edu_wc_${sessionCode}_${question?.id ?? ''}`);
	const maxWords = $derived(question?.wordLimit ?? 3);

	onMount(() => {
		try {
			value = sessionStorage.getItem(draftKey) ?? '';
		} catch {
			/* storage optional */
		}
		const source = new EventSource(`/api/sessions/${encodeURIComponent(sessionId)}/events`);
		const refresh = async () => {
			if (!question) return;
			try {
				const result = await fetch(
					`/api/wordcloud/${encodeURIComponent(sessionCode)}/responses?questionId=${encodeURIComponent(question.id)}`
				);
				if (result.ok) {
					const data = await result.json();
					words = data.words ?? [];
					saved = data.responses ?? saved;
				}
			} catch {
				/* EventSource reconnects */
			}
		};
		void refresh();
		source.addEventListener('snapshot', refresh);
		source.addEventListener('resync', refresh);
		source.addEventListener('session.state', () => {
			void invalidateAll();
		});
		source.addEventListener('wordcloud.snapshot', refresh);
		source.onopen = () => (message = 'Live');
		source.onerror = () => (message = 'Menghubungkan ulang…');
		return () => source.close();
	});

	async function submit() {
		if (!question || !value.trim() || submitted.length >= maxWords || sending) return;
		sending = true;
		message = '';
		try {
			const response = await fetch(`/api/wordcloud/${encodeURIComponent(sessionCode)}/responses`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ questionId: question.id, word: value })
			});
			const result = await response.json();
			if (!response.ok || !result.ok) throw new Error(result.message ?? 'Kiriman gagal.');
			if (!result.alreadySubmitted)
				saved = [...saved, { questionId: question.id, word: result.word, status: result.status }];
			message = result.status === 'approved' ? 'Kiriman tampil.' : 'Kiriman menunggu moderasi.';
			value = '';
			try {
				sessionStorage.removeItem(draftKey);
			} catch {
				/* storage optional */
			}
		} catch (error) {
			message = error instanceof Error ? error.message : 'Kiriman gagal.';
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
	{#if current < questions.length - 1}<button
			type="button"
			class="mt-5 min-h-11 rounded-xl border border-white/20 px-4 text-sm font-black hover:bg-white/10"
			onclick={() => {
				current += 1;
				value = '';
			}}>Pertanyaan berikutnya →</button
		>{/if}
	<div class="mt-6"><WordcloudResults {words} /></div>
</section>
