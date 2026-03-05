<script lang="ts">
	import Skeleton from '$components/Skeleton.svelte';
	import { eventsStore, loopViewsStore } from '$stores/app';
	import type { LoopEvent, LoopView } from '$types/models';

	type BlockerSignal = { label: string; href: string };
	type DayStat = { day: Date; opened: number; closed: number };

	const loops = $derived(($loopViewsStore ?? []) as LoopView[]);
	const events = $derived(($eventsStore ?? []) as LoopEvent[]);
	const loading = $derived($loopViewsStore === null);
	const naHint = 'N/A until enough data exists.';
	const hasAnyLoops = $derived(loops.length > 0);
	const openLoops = $derived(loops.filter((loop) => loop.state === 'open'));

	const todayClosed = $derived.by(() => {
		const now = new Date();
		return loops.filter((loop) => {
			if (loop.state !== 'closed' || !loop.closedAt) return false;
			const closedAt = new Date(loop.closedAt);
			return (
				closedAt.getFullYear() === now.getFullYear() &&
				closedAt.getMonth() === now.getMonth() &&
				closedAt.getDate() === now.getDate()
			);
		});
	});
	const todayClosedCount = $derived(todayClosed.length);

	const sevenDayStats = $derived.by<DayStat[]>(() => {
		const days: DayStat[] = [];
		const now = new Date();
		for (let i = 6; i >= 0; i -= 1) {
			const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
			const year = day.getFullYear();
			const month = day.getMonth();
			const date = day.getDate();
			const opened = loops.filter((loop) => {
				const openedAt = new Date(loop.openedAt);
				return openedAt.getFullYear() === year && openedAt.getMonth() === month && openedAt.getDate() === date;
			}).length;
			const closed = loops.filter((loop) => {
				if (!loop.closedAt) return false;
				const closedAt = new Date(loop.closedAt);
				return closedAt.getFullYear() === year && closedAt.getMonth() === month && closedAt.getDate() === date;
			}).length;
			days.push({ day, opened, closed });
		}
		return days;
	});
	const opened7d = $derived(sevenDayStats.map((entry) => entry.opened));
	const closed7d = $derived(sevenDayStats.map((entry) => entry.closed));
	const openedTotal7d = $derived(opened7d.reduce((acc, n) => acc + n, 0));
	const closedTotal7d = $derived(closed7d.reduce((acc, n) => acc + n, 0));
	const hasSevenDayData = $derived(openedTotal7d + closedTotal7d > 0);
	const netClosed7d = $derived(closedTotal7d - openedTotal7d);
	const closeRate7d = $derived.by<number | null>(() => {
		if (!hasSevenDayData) return null;
		if (openedTotal7d > 0) return Math.round((closedTotal7d / openedTotal7d) * 100);
		return 100;
	});

	const carryoverCount = $derived.by(() => {
		const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
		return openLoops.filter((loop) => +new Date(loop.openedAt) <= cutoff).length;
	});
	const reopened7dCount = $derived.by(() => {
		const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
		return events.filter((event) => event.kind === 'reopened' && +new Date(event.createdAt) >= cutoff).length;
	});

	function median(values: number[]) {
		if (values.length === 0) return null;
		const sorted = [...values].sort((a, b) => a - b);
		const mid = Math.floor(sorted.length / 2);
		if (sorted.length % 2 === 0) {
			return (sorted[mid - 1] + sorted[mid]) / 2;
		}
		return sorted[mid];
	}

	const medianCloseDays14d = $derived.by(() => {
		const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
		const closeDays = loops
			.filter((loop) => loop.closedAt && +new Date(loop.closedAt) >= cutoff)
			.map((loop) => (+new Date(loop.closedAt as string) - +new Date(loop.openedAt)) / (1000 * 60 * 60 * 24))
			.filter((value) => value >= 0);
		const result = median(closeDays);
		return result === null ? null : Math.round(result * 10) / 10;
	});

	const overdue7d = $derived.by(() =>
		sevenDayStats.map((entry) => {
			const at = new Date(entry.day.getFullYear(), entry.day.getMonth(), entry.day.getDate(), 23, 59, 59, 999).getTime();
			return loops.filter((loop) => {
				if (!loop.deadline) return false;
				const openedAt = +new Date(loop.openedAt);
				const closedAt = loop.closedAt ? +new Date(loop.closedAt) : Number.POSITIVE_INFINITY;
				const deadlineAt = +new Date(loop.deadline);
				return openedAt <= at && closedAt > at && deadlineAt < at;
			}).length;
		})
	);
	const overdueDelta7d = $derived(overdue7d[overdue7d.length - 1] - overdue7d[0]);
	const hasDeadlineData = $derived(loops.some((loop) => Boolean(loop.deadline)));

	const topBlockerTag = $derived.by<BlockerSignal>(() => {
		const counts = new Map<string, { label: string; href: string; count: number }>();
		for (const loop of openLoops) {
			if (loop.project) {
				const key = `project:${loop.project}`;
				const entry = counts.get(key) ?? {
					label: `project:${loop.project}`,
					href: `/loops?filter=open&tag=project:${encodeURIComponent(loop.project)}`,
					count: 0
				};
				entry.count += 1;
				counts.set(key, entry);
			}
			for (const person of loop.people) {
				const key = `person:${person}`;
				const entry = counts.get(key) ?? {
					label: `person:${person}`,
					href: `/loops?filter=open&tag=person:${encodeURIComponent(person)}`,
					count: 0
				};
				entry.count += 1;
				counts.set(key, entry);
			}
		}
		const top = [...counts.values()].sort((a, b) => b.count - a.count)[0];
		if (!top) return { label: 'none', href: '/loops?filter=open' };
		return { label: `${top.label} (${top.count})`, href: top.href };
	});

	const sparkline = $derived.by(() => {
		const width = 140;
		const height = 32;
		const maxValue = Math.max(1, ...opened7d, ...closed7d);
		const createPath = (values: number[]) =>
			values
				.map((value, idx) => {
					const x = (idx / Math.max(1, values.length - 1)) * width;
					const y = height - (value / maxValue) * height;
					return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
				})
				.join(' ');
		return {
			width,
			height,
			openedPath: createPath(opened7d),
			closedPath: createPath(closed7d)
		};
	});
	const overdueSparkline = $derived.by(() => {
		const width = 140;
		const height = 28;
		const maxValue = Math.max(1, ...overdue7d);
		const path = overdue7d
			.map((value, idx) => {
				const x = (idx / Math.max(1, overdue7d.length - 1)) * width;
				const y = height - (value / maxValue) * height;
				return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
			})
			.join(' ');
		return { width, height, path };
	});

</script>

{#if loading}
	<Skeleton lines={8} />
{:else}
	<section class="wins-signal">
		<section class="panel hero">
			<p class="hero-count">
				<strong>{todayClosedCount}</strong>
				<span>loops closed today</span>
			</p>

			{#if todayClosedCount === 0}
				<div class="empty">
					<p>Nothing closed yet today</p>
					<a href="/loops?filter=open">Open Loops</a>
				</div>
			{:else}
				<div class="hero-summary">
					<p>Keep up the momentum.</p>
					<a href="/loops?filter=open">Continue in Open Loops</a>
				</div>
			{/if}
		</section>

		<section class="panel signals">
			<header class="section-head sticky">
				<h2>Signals</h2>
			</header>

			<div class="signal-cards">
				<a class="signal-card" href={netClosed7d < 0 ? '/loops?filter=open' : '/loops?filter=all'}>
					<div class="card-top">
						<span>Opened vs Closed (7d)</span>
						<strong>{hasSevenDayData ? `${closedTotal7d} / ${openedTotal7d}` : 'N/A'}</strong>
					</div>
					{#if hasSevenDayData}
						<svg viewBox={`0 0 ${sparkline.width} ${sparkline.height}`} aria-hidden="true">
							<path d={sparkline.openedPath} fill="none" stroke="var(--amber)" stroke-width="2" opacity="0.65" />
							<path d={sparkline.closedPath} fill="none" stroke="var(--green)" stroke-width="2" />
						</svg>
						<small>{netClosed7d >= 0 ? `+${netClosed7d}` : netClosed7d} net closed</small>
					{:else}
						<small>{naHint}</small>
					{/if}
				</a>

				<a class="signal-card" href="/loops?filter=open">
					<div class="card-top">
						<span>Carryover (open &gt; 7 days)</span>
						<strong>{carryoverCount}</strong>
					</div>
					<small>Review stale open loops.</small>
				</a>

				<a class="signal-card" href={topBlockerTag.href}>
					<div class="card-top">
						<span>Top blocker tag</span>
						<strong>{openLoops.length > 0 ? topBlockerTag.label : 'N/A'}</strong>
					</div>
					<small>{openLoops.length > 0 ? 'Tap to open filtered loops.' : naHint}</small>
				</a>
			</div>

			<div class="signals-more">
				<a class="signal-mini" href="/loops?filter=all">
					<span>Close rate (7d)</span>
					<strong>{closeRate7d === null ? 'N/A' : `${closeRate7d}%`}</strong>
					<small>{hasSevenDayData ? `${closedTotal7d} closed / ${openedTotal7d} opened` : naHint}</small>
				</a>
				<a class="signal-mini" href="/loops?filter=closed">
					<span>Median time-to-close (14d)</span>
					<strong>{medianCloseDays14d === null ? 'N/A' : `${medianCloseDays14d}d`}</strong>
					<small>{medianCloseDays14d === null ? naHint : 'Lower is faster loop flow'}</small>
				</a>
				<a class="signal-mini" href="/loops?filter=all">
					<span>Reopened (7d)</span>
					<strong>{hasAnyLoops ? reopened7dCount : 'N/A'}</strong>
					<small>{hasAnyLoops ? 'How often loops are bouncing back open' : naHint}</small>
				</a>
				<a class="signal-mini" href="/loops?filter=open">
					<span>Overdue delta (7d)</span>
					<strong>{hasDeadlineData ? (overdueDelta7d >= 0 ? `+${overdueDelta7d}` : overdueDelta7d) : 'N/A'}</strong>
					{#if hasDeadlineData}
						<svg viewBox={`0 0 ${overdueSparkline.width} ${overdueSparkline.height}`} aria-hidden="true">
							<path d={overdueSparkline.path} fill="none" stroke="var(--red)" stroke-width="2" />
						</svg>
						<small>Change in overdue open loops across 7 days</small>
					{:else}
						<small>{naHint}</small>
					{/if}
				</a>
				<a class="signal-mini" href="/loops?filter=open">
					<span>Current open loops</span>
					<strong>{hasAnyLoops ? openLoops.length : 'N/A'}</strong>
					<small>{hasAnyLoops ? 'Active queue right now' : naHint}</small>
				</a>
			</div>
		</section>
	</section>
{/if}

<style>
	.wins-signal {
		display: grid;
		gap: 12px;
	}

	.panel {
		border: 1px solid var(--border-soft);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
		padding: 10px;
	}

	.hero {
		min-height: 0;
		display: grid;
		grid-template-rows: auto auto auto;
		gap: 10px;
		align-content: start;
	}

	.section-head {
		position: sticky;
		top: 0;
		z-index: 2;
		background: color-mix(in srgb, var(--surface-1) 92%, transparent);
		backdrop-filter: blur(4px);
		padding: 4px 0 8px;
	}

	.section-head h2 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--text-xl);
	}

	.section-head p {
		margin: 4px 0 0;
		color: var(--text2);
		font-size: var(--text-sm);
	}

	.hero-count {
		margin: 0;
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-family: var(--font-serif);
	}

	.hero-count strong {
		font-size: clamp(38px, 9vw, 56px);
		line-height: 0.95;
		color: var(--green);
	}

	.hero-count span {
		font-size: var(--text-md);
		color: var(--text2);
	}

	.empty {
		border: 1px dashed var(--border-soft);
		border-radius: var(--radius-md);
		padding: 14px;
		display: grid;
		gap: 10px;
	}

	.empty p {
		margin: 0;
		color: var(--text2);
	}

	.empty a {
		text-decoration: none;
		border: 1px solid var(--border-soft);
		border-radius: var(--radius-sm);
		padding: 8px 10px;
		width: fit-content;
		color: var(--text);
	}

	.hero-summary {
		border: 1px solid var(--border-soft);
		border-radius: var(--radius-md);
		padding: 14px;
		display: grid;
		gap: 10px;
		align-content: start;
	}

	.hero-summary p {
		margin: 0;
		color: var(--text2);
	}

	.hero-summary a {
		border: 1px solid var(--border-soft);
		background: color-mix(in srgb, var(--surface-2) 80%, transparent);
		border-radius: var(--radius-sm);
		padding: 7px 10px;
		font-size: var(--text-xs);
		font-family: var(--font-mono);
		color: var(--text);
		text-decoration: none;
		width: fit-content;
	}

	.signals {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		gap: 10px;
		min-height: clamp(54vh, 62vh, 72vh);
	}

	.signal-cards {
		display: grid;
		gap: 8px;
	}

	.signal-card {
		text-decoration: none;
		border: 1px solid var(--border-soft);
		border-radius: var(--radius-md);
		padding: 10px;
		display: grid;
		gap: 6px;
		color: var(--text);
	}

	.card-top {
		display: flex;
		gap: 8px;
		justify-content: space-between;
		align-items: baseline;
	}

	.card-top span {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text2);
	}

	.card-top strong {
		font-family: var(--font-serif);
		font-size: var(--text-lg);
		line-height: 1;
		text-align: right;
	}

	.signal-card svg {
		width: 100%;
		height: 32px;
	}

	.signal-card small {
		color: var(--text3);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}

	.signals-more {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}

	.signal-mini {
		text-decoration: none;
		color: var(--text);
		border: 1px solid var(--border-soft);
		border-radius: var(--radius-sm);
		padding: 8px;
		display: grid;
		gap: 4px;
	}

	.signal-mini span {
		color: var(--text3);
		font-size: var(--text-xs);
		font-family: var(--font-mono);
	}

	.signal-mini strong {
		font-size: var(--text-md);
		font-family: var(--font-serif);
	}

	.signal-mini small {
		color: var(--text3);
		font-size: var(--text-xs);
		font-family: var(--font-mono);
	}

	.signal-mini svg {
		width: 100%;
		height: 28px;
	}

	@media (max-width: 640px) {
		.signals {
			min-height: 60vh;
		}

		.signals-more {
			grid-template-columns: 1fr;
		}
	}
</style>
