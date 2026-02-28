<script lang="ts">
	import Empty from '$components/Empty.svelte';
	import Pill from '$components/Pill.svelte';
	import Badge from '$components/Badge.svelte';
	import ThreadDetail from '$components/ThreadDetail.svelte';
	import { eventsStore, loopPeopleStore, loopsStore, peopleStore } from '$stores/app';
	import { ageInDays } from '$lib/utils';
	import type { LoopEvent } from '$types/models';

	let tab = $state<'insights' | 'archive'>('insights');
	const loops = $derived($loopsStore ?? []);
	const events = $derived(($eventsStore ?? []) as LoopEvent[]);
	const links = $derived($loopPeopleStore ?? []);
	const people = $derived($peopleStore ?? []);
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
	const oldestOpen = $derived([...open].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))[0] ?? null);
	let selectedLoopId = $state<string | null>(null);
	const selectedLoop = $derived(loops.find((loop) => loop.id === selectedLoopId) ?? null);
	const selectedEvents = $derived(events.filter((evt) => evt.loopId === selectedLoopId));

	const ageBuckets = $derived.by(() => {
		const buckets = { lt7: 0, lt14: 0, lt30: 0, gt30: 0 };
		for (const loop of open) {
			const age = ageInDays(loop.createdAt);
			if (age < 7) buckets.lt7 += 1;
			else if (age < 14) buckets.lt14 += 1;
			else if (age < 30) buckets.lt30 += 1;
			else buckets.gt30 += 1;
		}
		return buckets;
	});

	const contention = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const link of links) {
			const loop = loops.find((item) => item.id === link.loopId);
			if (!loop || loop.state !== 'open') continue;
			counts.set(link.personId, (counts.get(link.personId) ?? 0) + 1);
		}
		return [...counts.entries()]
			.map(([personId, count]) => ({
				person: people.find((entry) => entry.id === personId)?.name ?? 'unknown',
				count
			}))
			.sort((a, b) => b.count - a.count)
			.slice(0, 6);
	});
</script>

<section class="tabs-wrap">
	<div class="tabs">
		<Pill label="Insights" active={tab === 'insights'} onClick={() => (tab = 'insights')} />
		<Pill label="Archive" active={tab === 'archive'} onClick={() => (tab = 'archive')} />
	</div>
</section>

{#if tab === 'insights'}
	<section class="grid">
		<article class="stat">
			<h3>Open</h3>
			<p style="color:var(--accent)">{open.length}</p>
		</article>
		<article class="stat">
			<h3>Overdue</h3>
			<p style="color:var(--red)">{overdue.length}</p>
		</article>
		<article class="stat">
			<h3>Completion</h3>
			<p style="color:var(--green)">{keptRate}%</p>
		</article>
		<article class="stat">
			<h3>Avg age</h3>
			<p style="color:var(--purple)">{avgLifetime}d</p>
		</article>
	</section>
	{#if oldestOpen}
		<article class="oldest">
			<h4>Oldest open</h4>
			<strong>{oldestOpen.title}</strong>
			<span>{ageInDays(oldestOpen.createdAt)}d</span>
		</article>
	{/if}
	<section class="charts">
		<article class="chart-card">
			<h4>Age distribution</h4>
			<div class="bars">
				<div style={`--h:${(ageBuckets.lt7 / Math.max(1, open.length)) * 100}%`}><span>&lt;7d</span></div>
				<div style={`--h:${(ageBuckets.lt14 / Math.max(1, open.length)) * 100}%`}><span>7-14</span></div>
				<div style={`--h:${(ageBuckets.lt30 / Math.max(1, open.length)) * 100}%`}><span>14-30</span></div>
				<div style={`--h:${(ageBuckets.gt30 / Math.max(1, open.length)) * 100}%`}><span>30+</span></div>
			</div>
		</article>
		<article class="chart-card">
			<h4>Opened vs Closed</h4>
			<div class="line-grid">
				{#each [0, 1, 2, 3] as n}
					<div class="point">
						<i class="open-dot" style={`--y:${(open.length / 12 + (n % 2) * 0.12) * 100}%`}></i>
						<i class="closed-dot" style={`--y:${(closed.length / 12 + ((n + 1) % 2) * 0.1) * 100}%`}></i>
					</div>
				{/each}
			</div>
		</article>
	</section>
	<article class="chart-card">
		<h4>Contended resources</h4>
		{#if contention.length === 0}
			<p class="empty-inline">No contention yet.</p>
		{:else}
			{#each contention as row}
				<div class="resource-row">
					<span>{row.person}</span>
					<div class="track"><div style={`width:${(row.count / contention[0].count) * 100}%`}></div></div>
					<small>{row.count}</small>
				</div>
			{/each}
		{/if}
	</article>
{:else}
	<section class="list">
		{#if closed.length === 0}
			<Empty label="No archive yet" />
		{:else}
			{#each [...closed].sort((a, b) => +new Date(b.closedAt ?? b.updatedAt) - +new Date(a.closedAt ?? a.updatedAt)) as loop, i (loop.id)}
				<button type="button" class="archive-item" style={`animation-delay:${i * 15}ms`} onclick={() => (selectedLoopId = loop.id)}>
					<h4>{loop.title}</h4>
					<div class="archive-meta">
						<Badge label={loop.closedReason ?? 'closed'} color="#3d8a4a" />
						<span>{ageInDays(loop.createdAt)}d life</span>
					</div>
				</button>
			{/each}
		{/if}
	</section>
{/if}

<ThreadDetail loop={selectedLoop} events={selectedEvents} open={Boolean(selectedLoop)} onClose={() => (selectedLoopId = null)} />

<style>
	.tabs-wrap {
		margin-bottom: 8px;
	}

	.tabs {
		display: inline-flex;
		gap: 2px;
		padding: 2px;
		border-radius: 10px;
		background: rgba(0, 0, 0, 0.025);
	}

	.grid {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 10px;
	}

	.stat {
		flex: 1 1 calc(50% - 6px);
		padding: 10px;
		border-radius: 12px;
		border: 1px solid rgba(0, 0, 0, 0.05);
		background: rgba(255, 255, 255, 0.5);
		box-shadow: var(--shadow-sm);
		animation: cardIn 0.24s var(--ease-spring);
	}

	.oldest {
		border-radius: 12px;
		border: 1px solid rgba(0, 0, 0, 0.05);
		border-left: 3px solid var(--amber);
		background: rgba(255, 255, 255, 0.5);
		box-shadow: var(--shadow-sm);
		padding: 10px;
		margin-bottom: 10px;
	}

	.oldest h4 {
		margin: 0 0 6px;
		font-size: 9.5px;
		text-transform: uppercase;
		color: var(--amber);
	}

	.oldest strong {
		display: block;
		font-family: 'Instrument Serif', 'Times New Roman', serif;
		font-size: 15px;
		font-weight: 400;
	}

	.oldest span {
		font-size: 10.5px;
		color: var(--text3);
		font-family: 'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.charts {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		margin-bottom: 10px;
	}

	.chart-card {
		padding: 10px;
		border-radius: 12px;
		border: 1px solid rgba(0, 0, 0, 0.05);
		background: rgba(255, 255, 255, 0.5);
		box-shadow: var(--shadow-sm);
	}

	h4 {
		margin: 0 0 10px;
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text3);
	}

	.bars {
		height: 100px;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 5px;
		align-items: end;
	}

	.bars div {
		height: var(--h);
		min-height: 6px;
		border-radius: 3px 3px 0 0;
		background: rgba(160, 113, 74, 0.5);
		position: relative;
	}

	.bars div:last-child {
		background: rgba(192, 69, 58, 0.5);
	}

	.bars span {
		position: absolute;
		top: 104%;
		left: 50%;
		transform: translateX(-50%);
		font-size: 8px;
		color: var(--text3);
		font-family: 'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.line-grid {
		height: 100px;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		align-items: stretch;
	}

	.point {
		position: relative;
	}

	.point i {
		position: absolute;
		width: 4px;
		height: 4px;
		border-radius: 99px;
		left: calc(50% - 2px);
		bottom: var(--y);
	}

	.open-dot {
		background: var(--accent);
	}

	.closed-dot {
		background: var(--green);
	}

	.resource-row {
		display: grid;
		grid-template-columns: 44px 1fr auto;
		align-items: center;
		gap: 6px;
		margin-bottom: 5px;
	}

	.resource-row span {
		margin: 0;
		font-size: 11px;
		font-weight: 300;
		color: var(--text3);
		text-align: right;
	}

	.track {
		height: 3px;
		background: rgba(0, 0, 0, 0.04);
		border-radius: 2px;
	}

	.track > div {
		height: 3px;
		background: var(--accent);
		border-radius: 2px;
		transition: width 0.4s var(--ease-spring);
	}

	.resource-row small {
		font-family: 'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 10px;
		color: var(--accent);
	}

	.list {
		display: grid;
		gap: 6px;
	}

	.archive-item {
		width: 100%;
		padding: 8px;
		border-radius: 12px;
		opacity: 0.5;
		transition: all 0.15s var(--ease);
		animation: cardIn 0.2s var(--ease-spring);
		background: rgba(255, 255, 255, 0.4);
		border: 0;
		text-align: left;
	}

	.archive-item:hover {
		opacity: 0.8;
		background: rgba(255, 255, 255, 0.4);
	}

	h3 {
		margin: 0;
		font-size: 9px;
		color: var(--text3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.list h4 {
		margin: 0;
		font-size: 13px;
		font-weight: 300;
		color: var(--text2);
	}

	.archive-meta {
		margin-top: 5px;
		display: inline-flex;
		gap: 6px;
		align-items: center;
	}

	.archive-meta span {
		font-size: 10px;
		color: var(--text3);
		font-family: 'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.empty-inline {
		margin: 0;
		font-size: 12px;
		color: var(--text3);
	}
</style>
