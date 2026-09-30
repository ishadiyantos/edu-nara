<script lang="ts">
	import { activityTemplates, activityTypes } from '$lib/activity-templates';
	import ActivityArt from '$lib/components/activity/ActivityArt.svelte';
</script>

<svelte:head><title>Templates — Edu Nara</title></svelte:head>
<h1>Templates</h1>
<p class="intro">Ready-to-edit starters. Your copy belongs to you.</p>
<div class="templates">
	{#each activityTemplates as template}
		<article>
			<div class="art"><ActivityArt type={template.type} /></div>
			<div class="body">
				<p class="kind">{activityTypes[template.type].label}</p>
				<h2>{template.title}</h2>
				<p>{template.description}</p>
				<p class="summary">
					{template.columns
						? template.columns.join(' · ')
						: `${template.questions?.length} editable questions`}
				</p>
				<details>
					<summary>Preview content</summary>
					<ul>
						{#each template.questions ?? [] as q}<li>
								{q.prompt}
							</li>{/each}{#each template.columns ?? [] as column}<li>{column}</li>{/each}
					</ul>
				</details>
				<a href={`/admin?create=${template.type}&template=${template.id}`}>Use template</a>
			</div>
		</article>
	{/each}
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
	.templates {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 18px;
	}
	article {
		min-width: 0;
		border: 1px solid #414a5a;
		border-radius: 12px;
		background: #222935;
		overflow: hidden;
	}
	.art {
		height: 135px;
		background: #303747;
		padding: 12px;
	}
	.body {
		padding: 20px;
		display: grid;
		gap: 12px;
	}
	.kind {
		font-size: 0.75rem;
		color: #c4b5fd;
		font-weight: 750;
	}
	h2 {
		font-weight: 750;
		font-size: 1.1rem;
	}
	.body > p:not(.kind) {
		font-size: 0.875rem;
		color: #cbd5e1;
	}
	.summary {
		font-weight: 650;
	}
	summary {
		cursor: pointer;
		min-height: 44px;
		display: flex;
		align-items: center;
		font-size: 0.875rem;
		text-decoration: underline;
	}
	li {
		font-size: 0.85rem;
		padding: 6px 0;
	}
	a {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		padding: 10px 14px;
		color: #20232b;
		background: #f5cd62;
		font-weight: 750;
	}
	@media (max-width: 1100px) {
		.templates {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 600px) {
		.templates {
			grid-template-columns: 1fr;
		}
	}
</style>
