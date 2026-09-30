<script lang="ts">
	import { onMount, untrack } from 'svelte';
	let { snapshot } = $props<{
		snapshot: { id: string; code: string; title: string; state: string; count: number };
	}>();
	let live = $state(untrack(() => snapshot));
	let connection = $state('Connecting…');
	const labels: Record<string, string> = {
		draft: 'Waiting for the teacher to open the session',
		open: 'Session open',
		closed: 'Session closed',
		ended: 'Session ended'
	};
	const messages: Record<string, string> = {
		draft: 'Get ready. Questions will appear automatically when the teacher opens the session.',
		open: 'Session in progress. Questions appear automatically when the round starts.',
		closed: 'Session closed. Contact your teacher if you have not joined yet.',
		ended: 'Session ended. Thank you for taking part.'
	};
	onMount(() => {
		const stream = new EventSource(`/api/sessions/${snapshot.id}/events`);
		const full = (event: MessageEvent) => {
			const next = JSON.parse(event.data);
			if (snapshot.state !== 'open' && next.state === 'open') window.location.reload();
			live = next;
		};
		stream.addEventListener('snapshot', full);
		stream.addEventListener('resync', full);
		stream.addEventListener('participant.count', (event) => {
			live = { ...live, count: JSON.parse(event.data).count };
		});
		stream.addEventListener('session.state', (event) => {
			const next = JSON.parse(event.data).state;
			if (snapshot.state !== 'open' && next === 'open') window.location.reload();
			live = { ...live, state: next };
		});
		stream.onopen = () => (connection = 'Connected');
		stream.onerror = () => (connection = 'Connection lost. Reconnecting…');
		return () => stream.close();
	});
</script>

<section class="waiting-room" data-testid="waiting-room" aria-live="polite">
	<div class="waiting-orbit" aria-hidden="true">
		<span>✨</span>
		<span>🚀</span>
		<span>⚡</span>
	</div>
	<p class="status-chip" data-testid="connection">
		<span aria-hidden="true"></span>{connection}
	</p>
	<p data-testid="session-state" class="state-title">{labels[live.state]}</p>
	<p class="state-copy">{messages[live.state]}</p>
	<div class="participant-card">
		<span aria-hidden="true">👥</span>
		<div>
			<p>Total participants</p>
			<strong data-testid="participant-count">{live.count}</strong>
		</div>
	</div>
</section>
<noscript>JavaScript is disabled. Reload to update the status.</noscript>

<style>
	.waiting-room {
		position: relative;
		overflow: hidden;
		border: 1px solid rgb(34 211 238 / 0.28);
		border-radius: 2rem;
		background:
			radial-gradient(circle at 18% 16%, rgb(34 211 238 / 0.24), transparent 30%),
			radial-gradient(circle at 82% 8%, rgb(244 114 182 / 0.2), transparent 28%),
			linear-gradient(135deg, rgb(15 23 42 / 0.9), rgb(49 46 129 / 0.72));
		padding: clamp(1.25rem, 5vw, 3rem);
		color: white;
		text-align: center;
		box-shadow:
			0 24px 80px rgb(2 6 23 / 0.42),
			inset 0 1px 0 rgb(255 255 255 / 0.12);
		isolation: isolate;
	}
	.waiting-room::before {
		content: '';
		position: absolute;
		inset: auto -10% 0;
		height: 42%;
		z-index: -1;
		background:
			linear-gradient(rgb(34 211 238 / 0.1) 1px, transparent 1px),
			linear-gradient(90deg, rgb(34 211 238 / 0.1) 1px, transparent 1px);
		background-size: 36px 36px;
		mask-image: linear-gradient(to top, black, transparent);
		transform: perspective(420px) rotateX(58deg) scale(1.25);
		transform-origin: bottom;
		animation: waitingGrid 8s linear infinite;
	}
	.waiting-orbit {
		position: relative;
		display: grid;
		height: 8rem;
		width: 8rem;
		place-items: center;
		margin: 0 auto 1.25rem;
		border: 1px solid rgb(251 191 36 / 0.35);
		border-radius: 999px;
		background: rgb(2 6 23 / 0.35);
		box-shadow:
			0 0 45px rgb(34 211 238 / 0.24),
			inset 0 0 30px rgb(168 85 247 / 0.18);
	}
	.waiting-orbit span {
		position: absolute;
		font-size: 2rem;
		filter: drop-shadow(0 0 16px rgb(251 191 36 / 0.7));
		animation: orbit 4s linear infinite;
	}
	.waiting-orbit span:nth-child(2) {
		animation-delay: -1.35s;
	}
	.waiting-orbit span:nth-child(3) {
		animation-delay: -2.7s;
	}
	.status-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		border: 1px solid rgb(255 255 255 / 0.16);
		border-radius: 999px;
		background: rgb(255 255 255 / 0.1);
		padding: 0.55rem 0.85rem;
		font-size: 0.78rem;
		font-weight: 950;
		color: rgb(255 255 255 / 0.8);
		backdrop-filter: blur(12px);
	}
	.status-chip span {
		height: 0.6rem;
		width: 0.6rem;
		border-radius: 999px;
		background: #34d399;
		box-shadow: 0 0 14px rgb(52 211 153 / 0.8);
	}
	.state-title {
		margin: 1rem auto 0;
		max-width: 15ch;
		font-size: clamp(2rem, 8vw, 4rem);
		font-weight: 1000;
		letter-spacing: -0.06em;
		line-height: 0.95;
		text-shadow: 0 0 34px rgb(168 85 247 / 0.42);
	}
	.state-copy {
		max-width: 38rem;
		margin: 1rem auto 0;
		color: rgb(226 232 240 / 0.82);
		font-weight: 800;
	}
	.participant-card {
		display: inline-flex;
		align-items: center;
		gap: 0.9rem;
		margin-top: 1.5rem;
		border: 1px solid rgb(251 191 36 / 0.28);
		border-radius: 1.25rem;
		background: rgb(251 191 36 / 0.1);
		padding: 0.85rem 1.1rem;
		text-align: left;
	}
	.participant-card > span {
		font-size: 2rem;
	}
	.participant-card p {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 950;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #fde68a;
	}
	.participant-card strong {
		display: block;
		font-size: 2rem;
		line-height: 1;
	}
	@keyframes orbit {
		from {
			transform: rotate(0deg) translateX(3rem) rotate(0deg);
		}
		to {
			transform: rotate(360deg) translateX(3rem) rotate(-360deg);
		}
	}
	@keyframes waitingGrid {
		to {
			background-position:
				0 36px,
				36px 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.waiting-room::before,
		.waiting-orbit span {
			animation: none;
		}
	}
</style>
