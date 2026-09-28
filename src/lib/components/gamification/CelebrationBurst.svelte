<script lang="ts">
	let {
		active = false,
		variant = 'neutral',
		label = '',
		emojis = []
	} = $props<{
		active?: boolean;
		variant?: 'neutral' | 'correct' | 'leaderboard';
		label?: string;
		emojis?: string[];
	}>();

	let items = $state<{ id: number; emoji: string; left: number; delay: number; scale: number }[]>([]);

	const defaultEmojis: Record<string, string[]> = {
		neutral: ['✨', '⭐', '🌟', '💫', '🎉'],
		correct: ['🎉', '✨', '👏', '🚀', '🌟'],
		leaderboard: ['👑', '🏆', '🥇', '🥈', '🥉', '🎉', '✨']
	};

	$effect(() => {
		if (active) {
			const pool = emojis.length > 0 ? emojis : defaultEmojis[variant] ?? defaultEmojis.neutral;
			const count = variant === 'leaderboard' ? 14 : 8;
			items = Array.from({ length: count }, (_, i) => ({
				id: i,
				emoji: pool[Math.floor(Math.random() * pool.length)],
				left: 10 + Math.random() * 80,
				delay: Math.random() * 200,
				scale: 0.8 + Math.random() * 0.6
			}));

			const timer = setTimeout(() => {
				items = [];
			}, 1500);

			return () => clearTimeout(timer);
		} else {
			items = [];
		}
	});
</script>

{#if items.length > 0}
	<div
		class="pointer-events-none fixed inset-0 z-50 overflow-hidden"
		aria-live="polite"
		data-testid="celebration-burst"
	>
		<span class="sr-only">{label || 'Celebration'}</span>
		{#each items as item (item.id)}
			<span
				class="absolute bottom-10 animate-burst-up text-2xl sm:text-4xl motion-reduce:animate-none"
				aria-hidden="true"
				style:left="{item.left}%"
				style:animation-delay="{item.delay}ms"
				style:transform="scale({item.scale})"
			>
				{item.emoji}
			</span>
		{/each}
	</div>
{/if}

<style>
	@keyframes burstUp {
		0% {
			opacity: 0;
			transform: translateY(0) scale(0.5);
		}
		20% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(-120px) scale(1.2);
		}
	}
	.animate-burst-up {
		animation: burstUp 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
	}
</style>
