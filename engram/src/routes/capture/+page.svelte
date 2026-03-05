<script lang="ts">
	import Skeleton from '$components/Skeleton.svelte';
	import Empty from '$components/Empty.svelte';
	import { dumpsStore, suggestionRecordsStore, transcriptStore } from '$stores/app';
	import type { Dump, SuggestionRecord } from '$types/models';

	const dumps = $derived(($dumpsStore ?? []) as Dump[]);
	const suggestions = $derived(($suggestionRecordsStore ?? []) as SuggestionRecord[]);
	const recentDumps = $derived(
		[...dumps]
			.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
			.slice(0, 8)
	);
	const pendingSuggestions = $derived(suggestions.filter((entry) => entry.status === 'pending').length);
	const loading = $derived($dumpsStore === null || $suggestionRecordsStore === null);
</script>

{#if loading}
	<Skeleton lines={5} />
{:else}
	<section class="capture-page">
		<header class="capture-hero">
			<h2>Voice-first capture</h2>
			<p>Speak naturally. AI drafts loop actions. Confirm with a tap.</p>
			<div class="hero-meta">
				<span>{pendingSuggestions} pending action{pendingSuggestions === 1 ? '' : 's'}</span>
				{#if $transcriptStore}
					<span>last transcript: {$transcriptStore.source}</span>
				{/if}
			</div>
		</header>

		<section class="capture-list panel">
			<h3>Recent captures</h3>
			{#if recentDumps.length === 0}
				<Empty label="No captures yet" icon={true} hint="Use the capture bar below to start with voice or text." />
			{:else}
				<div class="rows">
					{#each recentDumps as dump}
						<article class="row">
							<div>
								<p class="row-main">{dump.transcript?.trim() || dump.raw}</p>
								<p class="row-sub">{new Date(dump.createdAt).toLocaleString()}</p>
							</div>
							<span class="chip">{dump.source}</span>
						</article>
					{/each}
				</div>
			{/if}
		</section>
	</section>
{/if}

<style>
	.capture-page {
		display: grid;
		gap: var(--space-3);
	}

	.capture-hero {
		border: 1px solid var(--border-soft);
		background: var(--surface-1);
		border-radius: var(--radius-lg);
		padding: 14px;
		display: grid;
		gap: 8px;
	}

	.capture-hero h2 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--text-xl);
	}

	.capture-hero p {
		margin: 0;
		color: var(--text2);
	}

	.hero-meta {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 6px;
		font-size: var(--text-sm);
		color: var(--text3);
		font-family: var(--font-mono);
	}

	.capture-list {
		padding: 12px;
		display: grid;
		gap: 8px;
	}

	.capture-list h3 {
		margin: 0;
		font-size: var(--text-sm);
		letter-spacing: var(--tracking-caps);
		text-transform: uppercase;
		color: var(--text3);
	}

	.rows {
		display: grid;
		gap: 8px;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		border: 1px solid var(--border-soft);
		background: var(--surface-2);
		border-radius: var(--radius-md);
		padding: 10px;
	}

	.row-main {
		margin: 0;
		font-size: var(--text-md);
		color: var(--text);
	}

	.row-sub {
		margin: 4px 0 0;
		font-size: var(--text-xs);
		color: var(--text3);
		font-family: var(--font-mono);
	}

	.chip {
		flex-shrink: 0;
		font-size: var(--text-xs);
		font-family: var(--font-mono);
		color: var(--accent);
		border: 1px solid color-mix(in srgb, var(--accent) 32%, transparent);
		border-radius: 999px;
		padding: 4px 8px;
		text-transform: uppercase;
	}
</style>
