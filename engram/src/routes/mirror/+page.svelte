<script lang="ts">
	import { dumpsStore, loopsStore } from '$stores/app';

	let tab = $state<'insights' | 'archive' | 'dump_log'>('insights');
	const loops = $derived($loopsStore ?? []);
	const dumps = $derived($dumpsStore ?? []);
	const closed = $derived(loops.filter((loop) => loop.state === 'closed'));
	const keptRate = $derived(loops.length ? Math.round((closed.filter((l) => l.closedReason === 'done').length / loops.length) * 100) : 0);
	const open = $derived(loops.filter((loop) => loop.state === 'open'));
	const overdue = $derived(open.filter((loop) => loop.deadline && +new Date(loop.deadline) < Date.now()));
	const avgLifetime = $derived(closed.length
		? Math.round(
				closed.reduce((sum, loop) => sum + (+new Date(loop.closedAt ?? loop.updatedAt) - +new Date(loop.createdAt)), 0) /
					closed.length /
					(1000 * 60 * 60 * 24)
			)
		: 0);
</script>

<section class="tabs">
	<button type="button" class:active={tab === 'insights'} onclick={() => (tab = 'insights')}>Insights</button>
	<button type="button" class:active={tab === 'archive'} onclick={() => (tab = 'archive')}>Archive</button>
	<button type="button" class:active={tab === 'dump_log'} onclick={() => (tab = 'dump_log')}>Dump Log</button>
</section>

{#if tab === 'insights'}
	<section class="grid">
		<article>
			<h3>Open</h3>
			<p>{open.length}</p>
		</article>
		<article>
			<h3>Overdue</h3>
			<p>{overdue.length}</p>
		</article>
		<article>
			<h3>Kept rate</h3>
			<p>{keptRate}%</p>
		</article>
		<article>
			<h3>Avg lifetime</h3>
			<p>{avgLifetime}d</p>
		</article>
	</section>
{:else if tab === 'archive'}
	<section class="list">
		{#if closed.length === 0}
			<p class="empty">No closed loops yet.</p>
		{:else}
			{#each closed as loop (loop.id)}
				<article>
					<h4>{loop.title}</h4>
					<span>{loop.closedReason ?? 'closed'}</span>
				</article>
			{/each}
		{/if}
	</section>
{:else}
	<section class="list">
		{#if dumps.length === 0}
			<p class="empty">No dumps yet.</p>
		{:else}
			{#each [...dumps].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)) as dump (dump.id)}
				<article>
					<h4>{new Date(dump.createdAt).toLocaleString()}</h4>
					<span>{dump.raw}</span>
				</article>
			{/each}
		{/if}
	</section>
{/if}

<style>
	.tabs {
		display: flex;
		gap: 0.4rem;
	}
	.tabs button {
		border: 0;
		border-radius: 999px;
		padding: 0.28rem 0.55rem;
		background: rgba(0, 0, 0, 0.06);
	}
	.tabs button.active {
		background: rgba(160, 113, 74, 0.2);
		color: #6b472d;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.65rem;
	}
	article {
		padding: 0.8rem;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.65);
		border: 1px solid rgba(0, 0, 0, 0.06);
	}
	h3 {
		margin: 0;
		font-size: 0.74rem;
		color: #8a857f;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	p {
		margin: 0.4rem 0 0;
		font-family: 'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 1.35rem;
	}
	.list {
		display: grid;
		gap: 0.45rem;
	}
	.list article {
		border: 1px solid rgba(0, 0, 0, 0.06);
		border-radius: 10px;
		padding: 0.6rem;
		background: rgba(255, 255, 255, 0.68);
	}
	h4 {
		margin: 0;
		font-size: 0.86rem;
	}
	.list span {
		font-size: 0.78rem;
		color: #5a5651;
	}
	.empty {
		color: #8a857f;
	}
</style>
