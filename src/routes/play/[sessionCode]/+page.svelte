<script lang="ts">
	import { Container, Card, Badge, Button } from '$components/ui';
	import { page } from '$app/stores';
	let code = $derived($page.params.sessionCode?.toUpperCase() ?? 'ABC7XK');
</script>

<svelte:head>
	<title>Menunggu — {code} — Edu Nara</title>
</svelte:head>

<main class="min-h-dvh bg-bg pb-24 pt-10">
	<Container size="narrow">
		<div class="mb-6 flex items-center justify-between">
			<Badge tone="success" dot>Terhubung</Badge>
			<span class="font-mono text-sm font-semibold text-muted">{code}</span>
		</div>

		<Card>
			<div class="flex flex-col items-center gap-4 py-6 text-center">
				<div class="relative">
					<div
						class="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary"
						style="animation: spin 1.4s linear infinite;"
						aria-hidden="true"
					></div>
				</div>
				<div>
					<h1 class="text-xl font-bold">Menunggu dosen memulai…</h1>
					<p class="mt-1 text-muted">Aktivitas akan muncul otomatis di layarmu.</p>
				</div>
			</div>
		</Card>

		<div class="mt-8 space-y-3">
			<h2 class="text-sm font-semibold uppercase tracking-wider text-muted">
				Coba tampilan aktivitas (Fase 0)
			</h2>
			<div class="grid grid-cols-2 gap-3">
				<Button variant="ghost" href="/mock/play/choice" size="sm">Multiple Choice</Button>
				<Button variant="ghost" href="/mock/play/wordcloud" size="sm">Word Cloud</Button>
				<Button variant="ghost" href="/mock/play/board" size="sm">Board</Button>
				<Button variant="ghost" href="/mock/play/crossword" size="sm">Crossword</Button>
			</div>
		</div>
	</Container>
</main>

<style>
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		div[style*='spin'] {
			animation: none !important;
		}
	}
</style>
