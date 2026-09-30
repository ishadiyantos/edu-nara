<script lang="ts">
	let {
		seconds = 0,
		totalSeconds = 30,
		running = false,
		paused = false,
		expired = false
	} = $props<{
		seconds?: number;
		totalSeconds?: number;
		running?: boolean;
		paused?: boolean;
		expired?: boolean;
	}>();

	const isWarning = $derived(running && seconds > 0 && seconds <= 5);
	const state = $derived(
		expired ? 'expired' : isWarning ? 'warning' : running ? 'running' : paused ? 'paused' : 'ready'
	);
	const percentage = $derived(
		totalSeconds > 0 ? Math.max(0, Math.min(100, (seconds / totalSeconds) * 100)) : 0
	);
</script>

<div class="timer" data-state={state} data-testid="game-show-timer">
	<div
		class="timer-face"
		aria-label={`${seconds} seconds remaining`}
		style:--progress={`${percentage}%`}
	>
		<span>{seconds}</span>
		<small>detik</small>
	</div>
	<div class="timer-copy">
		<span class="timer-label">
			{#if expired}
				Time is up
			{:else if paused}
				Dijeda
			{:else if running}
				{#if isWarning}Hurry!{:else}Time left{/if}
			{:else}
				Siap
			{/if}
		</span>
		<div class="timer-bar" aria-hidden="true">
			<div class="timer-fill" style:width={`${percentage}%`}></div>
		</div>
	</div>
</div>

<style>
	.timer {
		display: inline-flex;
		align-items: center;
		gap: 0.85rem;
		border: 1px solid rgb(148 163 184 / 0.45);
		border-radius: 1.35rem;
		background: rgb(15 23 42 / 0.78);
		padding: 0.55rem 0.8rem 0.55rem 0.55rem;
		color: rgb(203 213 225);
		font-weight: 900;
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / 0.08),
			0 0 28px rgb(34 211 238 / 0.14);
		backdrop-filter: blur(10px);
	}
	.timer-face {
		position: relative;
		display: grid;
		height: 4rem;
		width: 4rem;
		place-items: center;
		align-content: center;
		border-radius: 50%;
		background: conic-gradient(currentColor var(--progress), rgb(255 255 255 / 0.1) 0);
		color: #67e8f9;
		box-shadow: 0 0 24px currentColor;
	}
	.timer-face::after {
		content: '';
		position: absolute;
		height: 3.35rem;
		width: 3.35rem;
		border-radius: 50%;
		background: #0f172a;
	}
	.timer-face span,
	.timer-face small {
		position: relative;
		z-index: 1;
	}
	.timer-face span {
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: 1.4rem;
		line-height: 1;
	}
	.timer-face small {
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.timer-copy {
		min-width: 7rem;
	}
	.timer-copy .timer-bar {
		width: 7rem;
	}
	.timer[data-state='running'] {
		border-color: rgb(34 211 238 / 0.75);
		color: #67e8f9;
		box-shadow: var(--glow-cyan);
	}
	.timer[data-state='warning'] {
		border-color: rgb(251 191 36 / 0.85);
		color: #fcd34d;
		animation: timerPulse 0.8s ease-in-out infinite alternate;
		box-shadow: var(--glow-amber);
	}
	.timer[data-state='expired'] {
		border-color: rgb(244 63 94 / 0.65);
		color: #fb7185;
	}
	.timer-bar {
		height: 0.5rem;
		width: 5rem;
		overflow: hidden;
		border-radius: 999px;
		background: rgb(15 23 42 / 0.9);
	}
	.timer-fill {
		height: 100%;
		border-radius: inherit;
		background: currentColor;
		transition: width 300ms ease;
	}
	.timer-label {
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	@keyframes timerPulse {
		from {
			transform: scale(1);
		}
		to {
			transform: scale(1.04);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.timer[data-state='warning'] {
			animation: none;
		}
		.timer-fill {
			transition: none;
		}
	}
</style>
