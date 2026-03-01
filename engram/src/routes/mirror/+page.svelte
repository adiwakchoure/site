<script lang="ts">
	import { loopPeopleStore, loopsStore, peopleStore } from '$stores/app';
	import { ageInDays } from '$lib/utils';
	import StatCard from '$components/StatCard.svelte';
	import SectionHeader from '$components/SectionHeader.svelte';
	import Skeleton from '$components/Skeleton.svelte';

	const loops = $derived($loopsStore ?? []);
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

	// 3A: Real weekly throughput — last 4 weeks
	const weeklyThroughput = $derived.by(() => {
		const now = Date.now();
		const week = 7 * 24 * 60 * 60 * 1000;
		const weeks: Array<{ label: string; opened: number; closed: number }> = [];
		for (let i = 3; i >= 0; i--) {
			const start = now - (i + 1) * week;
			const end = now - i * week;
			const weekOpened = loops.filter((l) => {
				const t = +new Date(l.createdAt);
				return t >= start && t < end;
			}).length;
			const weekClosed = closed.filter((l) => {
				const t = +new Date(l.closedAt ?? l.updatedAt);
				return t >= start && t < end;
			}).length;
			const label = i === 0 ? 'This wk' : i === 1 ? 'Last wk' : `${i + 1}w ago`;
			weeks.push({ label, opened: weekOpened, closed: weekClosed });
		}
		return weeks;
	});
	const maxThroughput = $derived(Math.max(1, ...weeklyThroughput.flatMap((w) => [w.opened, w.closed])));

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

	const loading = $derived($loopsStore === null);
</script>

{#if loading}
	<Skeleton lines={6} />
{:else}
<!-- 3B: Hero stat — open count prominent -->
<section class="hero">
	<article class="hero-card">
		<h3>Open loops</h3>
		<p class="hero-number">{open.length}</p>
	</article>
</section>

<section class="supporting-stats">
	<StatCard label="Overdue" value={overdue.length} color="var(--red)" />
	<StatCard label="Completion" value="{keptRate}%" color="var(--green)" />
	<StatCard label="Avg age" value="{avgLifetime}d" color="var(--purple)" />
</section>

{#if oldestOpen}
	<article class="oldest">
		<SectionHeader label="Oldest open" color="var(--amber)" />
		<strong>{oldestOpen.title}</strong>
		<span>{ageInDays(oldestOpen.createdAt)}d</span>
	</article>
{/if}

<section class="charts">
	<article class="chart-card">
		<SectionHeader label="Age distribution" />
		<div class="bars">
			<div style={`--h:${(ageBuckets.lt7 / Math.max(1, open.length)) * 100}%`}><span>&lt;7d</span></div>
			<div style={`--h:${(ageBuckets.lt14 / Math.max(1, open.length)) * 100}%`}><span>7-14</span></div>
			<div style={`--h:${(ageBuckets.lt30 / Math.max(1, open.length)) * 100}%`}><span>14-30</span></div>
			<div style={`--h:${(ageBuckets.gt30 / Math.max(1, open.length)) * 100}%`}><span>30+</span></div>
		</div>
	</article>

	<!-- 3A: Real weekly throughput bars -->
	<article class="chart-card">
		<SectionHeader label="Weekly velocity" />
		<div class="throughput">
			{#each weeklyThroughput as week}
				<div class="week-col">
					<div class="week-bars">
						<div class="week-bar opened" style={`--h:${(week.opened / maxThroughput) * 100}%`}></div>
						<div class="week-bar closed" style={`--h:${(week.closed / maxThroughput) * 100}%`}></div>
					</div>
					<span class="week-label">{week.label}</span>
				</div>
			{/each}
			<div class="throughput-legend">
				<span class="legend-dot opened"></span><span>opened</span>
				<span class="legend-dot closed"></span><span>closed</span>
			</div>
		</div>
	</article>
</section>

<article class="chart-card contention-card">
	<SectionHeader label="Contended resources" />
	{#if contention.length === 0}
		<p class="empty-inline">No contention yet.</p>
	{:else}
		{#each contention as row}
			<div class="resource-row">
				<span class="resource-name" title={row.person}>{row.person}</span>
				<div class="track"><div style={`width:${(row.count / contention[0].count) * 100}%`}></div></div>
				<small>{row.count}</small>
			</div>
		{/each}
	{/if}
</article>
{/if}

<style>
	/* 3B: Hero card */
	.hero {
		display: flex;
		justify-content: center;
		margin-bottom: 12px;
	}

	.hero-card {
		flex: 1;
		padding: 20px 16px;
		border-radius: 16px;
		border: 1px solid rgba(0, 0, 0, 0.05);
		background: rgba(255, 255, 255, 0.5);
		box-shadow: var(--shadow-md);
		text-align: center;
		animation: cardIn 0.24s var(--ease-spring);
	}

	.hero-card h3 {
		margin: 0;
		font-size: 9px;
		color: var(--text3);
		text-transform: uppercase;
		letter-spacing: var(--tracking-caps-wide);
	}

	.hero-number {
		margin: 6px 0 0;
		font-family: var(--font-serif);
		font-size: 36px;
		font-weight: var(--weight-normal);
		color: var(--accent);
		line-height: 1;
	}

	/* Supporting stats row */
	.supporting-stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-bottom: 12px;
	}

	.oldest {
		border-radius: 12px;
		border: 1px solid rgba(0, 0, 0, 0.05);
		border-left: 3px solid var(--amber);
		background: rgba(255, 255, 255, 0.5);
		box-shadow: var(--shadow-sm);
		padding: 12px;
		margin-bottom: 12px;
	}

	.oldest strong {
		display: block;
		font-family: var(--font-serif);
		font-size: 15px;
		font-weight: var(--weight-normal);
		line-height: var(--leading-tight);
		letter-spacing: var(--tracking-tight);
	}

	.oldest span {
		font-size: 10.5px;
		color: var(--text3);
		font-family: var(--font-mono);
	}

	.charts {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
		margin-bottom: 12px;
	}

	.chart-card {
		padding: 12px;
		border-radius: 12px;
		border: 1px solid rgba(0, 0, 0, 0.05);
		background: rgba(255, 255, 255, 0.5);
		box-shadow: var(--shadow-sm);
	}

	.contention-card {
		margin-bottom: 12px;
	}

	/* Age distribution bars */
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
		font-family: var(--font-mono);
	}

	/* 3A: Weekly throughput bars */
	.throughput {
		height: 100px;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
		align-items: end;
		position: relative;
	}

	.week-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		height: 100%;
	}

	.week-bars {
		flex: 1;
		display: flex;
		gap: 2px;
		align-items: end;
		width: 100%;
	}

	.week-bar {
		flex: 1;
		min-height: 4px;
		height: var(--h);
		border-radius: 2px 2px 0 0;
		transition: height 0.3s var(--ease-spring);
	}

	.week-bar.opened {
		background: var(--accent);
		opacity: 0.7;
	}

	.week-bar.closed {
		background: var(--green);
		opacity: 0.7;
	}

	.week-label {
		font-size: 7px;
		color: var(--text4);
		font-family: var(--font-mono);
		text-align: center;
	}

	.throughput-legend {
		position: absolute;
		top: -2px;
		right: 0;
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: 7px;
		color: var(--text4);
		font-family: var(--font-mono);
	}

	.legend-dot {
		width: 5px;
		height: 5px;
		border-radius: 1px;
	}

	.legend-dot.opened {
		background: var(--accent);
	}

	.legend-dot.closed {
		background: var(--green);
	}

	/* 3C: Contention — wider name column */
	.resource-row {
		display: grid;
		grid-template-columns: 72px 1fr auto;
		align-items: center;
		gap: 6px;
		margin-bottom: 5px;
	}

	.resource-name {
		margin: 0;
		font-size: 11px;
		font-weight: 300;
		color: var(--text3);
		text-align: right;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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

	.empty-inline {
		margin: 0;
		font-size: 12px;
		color: var(--text3);
	}
</style>
