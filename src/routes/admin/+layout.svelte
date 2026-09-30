<script lang="ts">
	import '../../app.css';
	import { page } from '$app/stores';
	let { children } = $props();
	let drawer = $state<HTMLDialogElement>();
	const bare = $derived(
		$page.url.pathname === '/admin/login' ||
			/^\/admin\/sessions\/[^/]+\/?$/.test($page.url.pathname)
	);
	const links = [
		['/admin', 'My Activities'],
		['/admin/templates', 'Templates'],
		['/admin/sessions', 'Class Sessions']
	];
</script>

{#snippet navigation()}
	<a href="/admin" class="brand" onclick={() => drawer?.close()}
		><span aria-hidden="true">N</span> Edu Nara</a
	>
	<a class="create" href="/admin?create=choice" onclick={() => drawer?.close()}>+ Create activity</a
	>
	<nav aria-label="Workspace">
		{#each links as [href, label]}<a
				{href}
				aria-current={$page.url.pathname === href ? 'page' : undefined}
				onclick={() => drawer?.close()}>{label}</a
			>{/each}
	</nav>
	<div class="account">
		<p>Teacher workspace</p>
		<form method="POST" action="/admin/logout"><button>Log out</button></form>
	</div>
{/snippet}
{#if bare}{@render children()}
{:else}
	<div class="workspace-shell">
		<aside class="sidebar" data-testid="workspace-sidebar">{@render navigation()}</aside>
		<header class="mobile-bar">
			<a href="/admin">Edu Nara</a><button
				onclick={() => drawer?.showModal()}
				aria-label="Open navigation">Menu</button
			>
		</header>
		<dialog bind:this={drawer} class="drawer" aria-label="Workspace navigation">
			<button class="close" onclick={() => drawer?.close()} aria-label="Close navigation"
				>Close ×</button
			>{@render navigation()}
		</dialog>
		<main class="workspace-main">{@render children()}</main>
	</div>
{/if}

<style>
	.workspace-shell {
		min-height: 100dvh;
		background: #151922;
		color: #f1f5f9;
	}
	.sidebar {
		position: fixed;
		inset: 0 auto 0 0;
		width: 232px;
		padding: 24px 18px;
		background: #1c212c;
		border-right: 1px solid #343b48;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 1.25rem;
		font-weight: 850;
	}
	.brand span {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: #f5cd62;
		color: #1c212c;
	}
	.create {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 10px;
		padding: 10px;
		background: #f5cd62;
		color: #20232b;
		font-weight: 750;
	}
	nav {
		display: grid;
		gap: 6px;
	}
	nav a,
	.account button {
		display: flex;
		align-items: center;
		padding: 10px 12px;
		border-radius: 8px;
		color: #cbd5e1;
		font-weight: 650;
	}
	nav a:hover,
	nav a[aria-current] {
		background: #303747;
		color: white;
	}
	.account {
		margin-top: auto;
		border-top: 1px solid #394150;
		padding-top: 16px;
		font-size: 0.875rem;
	}
	.account p {
		color: #aeb9ca;
		padding-left: 12px;
	}
	.account button {
		text-decoration: underline;
	}
	.workspace-main {
		margin-left: 232px;
		padding: 28px;
		min-width: 0;
	}
	.mobile-bar {
		display: none;
	}
	.drawer {
		margin: 0;
		height: 100dvh;
		max-height: 100dvh;
		width: min(300px, calc(100% - 36px));
		padding: 18px;
		border: 1px solid #475569;
		background: #1c212c;
		color: white;
	}
	.drawer[open] {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	.drawer::backdrop {
		background: #020617aa;
	}
	.close {
		align-self: flex-end;
		padding: 8px 12px;
	}
	@media (max-width: 900px) {
		.sidebar {
			display: none;
		}
		.workspace-main {
			margin-left: 0;
			padding: 20px 16px;
		}
		.mobile-bar {
			display: flex;
			align-items: center;
			justify-content: space-between;
			border-bottom: 1px solid #343b48;
			padding: 8px 16px;
			font-weight: 750;
		}
		.mobile-bar button {
			padding: 8px 12px;
			border: 1px solid #475569;
			border-radius: 8px;
		}
	}
</style>
