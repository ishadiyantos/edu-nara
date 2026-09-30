<script lang="ts">
	let { data } = $props();
	const labels = { draft: 'Lobby', open: 'Open', closed: 'Closed', ended: 'Ended' };
</script>

<svelte:head><title>Class Sessions — Edu Nara</title></svelte:head>
<h1>Class Sessions</h1>
<p class="intro">{data.sessions.length} saved sessions. Open a session to manage or review it.</p>
<div class="sessions">
	{#each data.sessions as session}<a href={`/admin/sessions/${session.id}`}
			><span
				><strong>{session.title}</strong><small
					>{session.code} · Created {new Date(session.createdAt).toLocaleDateString('en-US', {
						timeZone: 'UTC'
					})}</small
				></span
			><span class="state">{labels[session.state]}</span></a
		>{:else}<p>
			No sessions yet. <a href="/admin">Launch an activity from your library.</a>
		</p>{/each}
</div>

<style>
	h1 {
		font-size: 1.7rem;
		font-weight: 800;
	}
	.intro {
		color: #bac5d5;
		margin: 6px 0 24px;
	}
	.sessions {
		display: grid;
		gap: 12px;
	}
	.sessions > a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		border: 1px solid #414a5a;
		border-radius: 12px;
		padding: 18px;
		background: #222935;
	}
	strong {
		overflow-wrap: anywhere;
	}
	small {
		display: block;
		color: #bac5d5;
		margin-top: 6px;
	}
	.state {
		color: #fde68a;
	}
	.sessions > p {
		padding: 24px;
	}
	.sessions > p a {
		text-decoration: underline;
	}
</style>
