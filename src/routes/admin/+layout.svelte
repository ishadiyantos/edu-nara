<script lang="ts">
	import '../../app.css';
	import { Container, Button, Badge } from '$components/ui';
	import { page } from '$app/stores';

	let { children } = $props();
	const isLogin = $derived($page.url.pathname === '/admin/login');
</script>

{#if isLogin}
	{@render children()}
{:else}
	<div class="min-h-dvh bg-bg">
		<header class="border-b border-border bg-surface">
			<Container>
				<div class="flex h-16 items-center justify-between">
					<a href="/admin" class="flex items-center gap-2">
						<span
							class="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white"
							aria-hidden="true"
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
								<path
									d="M4 7l8-4 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4"
									stroke="currentColor"
									stroke-width="2"
									stroke-linejoin="round"
								/>
							</svg>
						</span>
						<span class="font-bold">Edu Nara</span>
						<Badge tone="warning">Admin</Badge>
					</a>
					<nav class="flex items-center gap-2">
						<Button variant="ghost" size="sm" href="/admin">Dashboard</Button>
						<Button variant="ghost" size="sm" href="/design">Design</Button>
						<Button variant="ghost" size="sm" href="/admin/login">Keluar</Button>
					</nav>
				</div>
			</Container>
		</header>
		<main class="py-8">
			<Container>
				{@render children()}
			</Container>
		</main>
	</div>
{/if}
