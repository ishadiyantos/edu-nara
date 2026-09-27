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
	<div
		class="min-h-dvh bg-gradient-to-br from-[#0b1120] via-[#111827] to-[#0b1120] text-white relative overflow-hidden flex flex-col"
	>
		<!-- Background ambient game glow -->
		<div
			class="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl"
			aria-hidden="true"
		></div>
		<div
			class="pointer-events-none absolute -right-24 top-1/4 h-96 w-96 rounded-full bg-purple-600/15 blur-3xl"
			aria-hidden="true"
		></div>
		<div
			class="pointer-events-none absolute left-1/3 bottom-0 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl"
			aria-hidden="true"
		></div>

		<header
			class="sticky top-0 z-40 border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-xl shadow-lg"
		>
			<Container>
				<div class="flex h-16 min-w-0 items-center justify-between gap-3">
					<a href="/admin" class="flex shrink-0 items-center gap-2.5 group">
						<span
							class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-400 text-slate-950 font-black shadow-[0_3px_0_#b45309] group-hover:scale-105 transition-transform"
							aria-hidden="true"
						>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
								<path
									d="M4 7l8-4 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linejoin="round"
								/>
							</svg>
						</span>
						<span class="hidden font-black text-lg tracking-tight sm:inline text-white"
							>Edu Nara</span
						>
						<span class="hidden sm:inline">
							<Badge
								tone="warning"
								class="bg-amber-400/20 text-amber-300 border border-amber-400/30 font-black text-[10px] tracking-wider uppercase"
								>Admin</Badge
							>
						</span>
					</a>
					<nav class="flex shrink-0 items-center gap-2 overflow-x-auto">
						<Button
							variant="ghost"
							size="sm"
							href="/admin"
							class="text-white/80 hover:text-white hover:bg-white/10 font-bold rounded-xl"
							>Dashboard</Button
						>
						<Button
							variant="ghost"
							size="sm"
							href="/design"
							class="hidden sm:inline-flex text-white/80 hover:text-white hover:bg-white/10 font-bold rounded-xl"
							>Design</Button
						>
						<form method="POST" action="/admin/logout">
							<Button
								variant="ghost"
								size="sm"
								type="submit"
								class="text-rose-300 hover:text-rose-200 hover:bg-rose-500/20 font-bold rounded-xl"
								>Keluar</Button
							>
						</form>
					</nav>
				</div>
			</Container>
		</header>
		<main class="py-8 relative z-10 flex-1">
			<Container>
				{@render children()}
			</Container>
		</main>
	</div>
{/if}
