<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head><title>AI API Keys — Edu Nara</title></svelte:head>

<section class="page">
	<header>
		<p class="eyebrow">Workspace settings</p>
		<h1>AI API keys</h1>
		<p>
			Create a scoped key for your local AI. Keys can only create Board drafts; they cannot launch
			sessions or read class data.
		</p>
	</header>

	<form method="POST" action="?/create" class="create">
		<label
			>Key label<input
				name="label"
				required
				maxlength="80"
				placeholder="Local teaching assistant"
			/></label
		>
		<label
			>Expires in
			<select name="expiresInDays">
				<option value="30">30 days</option><option value="90" selected>90 days</option><option
					value="180">180 days</option
				><option value="365">365 days</option>
			</select>
		</label>
		<button>Create key</button>
	</form>

	<section class="downloads" aria-labelledby="ai-docs-heading">
		<div>
			<h2 id="ai-docs-heading">AI integration files</h2>
			<p>Download these files and provide them to your local AI with its API key.</p>
		</div>
		<a href="/admin/ai-keys/download/edu-nara-activity-builder.SKILL.md" download>
			Download skill.md
		</a>
		<a href="/admin/ai-keys/download/EDU-NARA-AI-API.md" download> Download API docs </a>
	</section>

	{#if form?.message}<p class="notice" role="status">{form.message}</p>{/if}
	{#if form?.key}
		<div class="secret" role="alert">
			<strong>Copy this key now. It will not be shown again.</strong>
			<code>{form.key.token}</code>
			<p>
				Store it in your local AI environment or secret manager. Do not paste it into chat or commit
				it.
			</p>
		</div>
	{/if}
	{#if form?.message && !form?.ok}<p class="error" role="alert">{form.message}</p>{/if}

	<h2>Existing keys</h2>
	{#if data.keys.length}
		<ul>
			{#each data.keys as key (key.id)}
				<li>
					<div>
						<strong>{key.label}</strong><span
							>{key.active ? 'Active' : 'Expired or revoked'} · expires {new Date(
								key.expiresAt
							).toLocaleDateString()}</span
						>
					</div>
					{#if key.active}
						<form method="POST" action="?/revoke">
							<input type="hidden" name="id" value={key.id} />
							<button class="revoke">Revoke</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}<p>No AI keys yet.</p>{/if}
</section>

<style>
	.page {
		max-width: 850px;
		margin: 0 auto;
		padding: 40px 24px;
		color: #f1f5f9;
	}
	header p:last-child {
		max-width: 650px;
		color: #aeb8c9;
		line-height: 1.6;
	}
	.eyebrow {
		color: #f5cd62;
		text-transform: uppercase;
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.12em;
	}
	h1 {
		margin: 0.25rem 0;
		font-size: 2.2rem;
	}
	h2 {
		margin-top: 36px;
		font-size: 1.3rem;
	}
	.create {
		display: flex;
		align-items: end;
		gap: 14px;
		flex-wrap: wrap;
		margin: 28px 0;
		padding: 20px;
		background: #1c212c;
		border: 1px solid #394150;
		border-radius: 14px;
	}
	.downloads {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		margin: 24px 0;
		padding: 18px;
		border: 1px solid #394150;
		border-radius: 14px;
		background: #151a23;
	}
	.downloads div {
		flex: 1 1 100%;
	}
	.downloads h2 {
		margin: 0;
	}
	.downloads p {
		margin: 6px 0 0;
		color: #aeb8c9;
	}
	.downloads a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 14px;
		border: 1px solid #5b6575;
		border-radius: 9px;
		color: #f1f5f9;
		text-decoration: none;
		font-weight: 700;
	}
	.downloads a:hover {
		background: #293243;
	}
	.downloads a:focus-visible {
		outline: 3px solid #f5cd62;
		outline-offset: 2px;
	}
	.create label {
		display: grid;
		gap: 7px;
		color: #cbd5e1;
		font-weight: 650;
	}
	.create input,
	.create select {
		min-height: 42px;
		padding: 8px 10px;
		border: 1px solid #566174;
		border-radius: 8px;
		background: #11151d;
		color: white;
	}
	.create button,
	.revoke {
		min-height: 42px;
		padding: 8px 16px;
		border: 0;
		border-radius: 8px;
		background: #f5cd62;
		color: #20232b;
		font-weight: 800;
		cursor: pointer;
	}
	.revoke {
		background: #45272c;
		color: #ffb8bf;
	}
	.secret {
		display: grid;
		gap: 10px;
		padding: 18px;
		border: 1px solid #f5cd62;
		border-radius: 12px;
		background: #28251b;
	}
	.secret code {
		overflow-wrap: anywhere;
		padding: 12px;
		background: #11151d;
		border-radius: 8px;
		color: #f5cd62;
	}
	.secret p,
	.notice,
	.error {
		margin: 0;
		color: #cbd5e1;
	}
	.error {
		color: #ffb8bf;
	}
	ul {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 10px;
	}
	li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 14px;
		padding: 16px;
		background: #1c212c;
		border: 1px solid #394150;
		border-radius: 10px;
	}
	li div {
		display: grid;
		gap: 5px;
	}
	li span {
		color: #aeb8c9;
		font-size: 0.9rem;
	}
	@media (max-width: 560px) {
		.page {
			padding: 24px 16px;
		}
		.create {
			align-items: stretch;
			flex-direction: column;
		}
		li {
			align-items: flex-start;
		}
	}
</style>
