<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { Clock } from 'lucide-svelte';
	import LoopCard from '$components/LoopCard.svelte';
	import Pill from '$components/Pill.svelte';
	import LoopDetail from '$components/LoopDetail.svelte';
	import Pulse from '$components/Pulse.svelte';
	import Empty from '$components/Empty.svelte';
	import Skeleton from '$components/Skeleton.svelte';
	import { closeLoop, reopenLoop } from '$db/local';
	import { activeFilter, eventsStore, loopSort, loopViewsStore } from '$stores/app';
	import { showToast } from '$stores/toast';
	import { isOverdue } from '$lib/utils';
	import type { LoopEvent, LoopView } from '$types/models';

	const filters: Array<'open' | 'overdue' | 'closed' | 'all'> = ['open', 'overdue', 'closed', 'all'];

	let selectedLoopId = $state<string | null>(null);
	let listHost = $state<HTMLDivElement | null>(null);
	let listHeight = $state(360);
	let scrub = $state<{ date: Date; active: number; overdue: number } | null>(null);
	let pulseHint = $state(false);

	onMount(() => {
		if (!browser) return;
		const key = 'engram:pulse-hint-shown';
		if (!localStorage.getItem(key)) {
			pulseHint = true;
			localStorage.setItem(key, '1');
			setTimeout(() => { pulseHint = false; }, 4000);
		}
	});

	const loops = $derived(($loopViewsStore ?? []) as LoopView[]);

	const sorted = $derived.by(() => {
		const at = scrub?.date?.getTime() ?? null;
		let base = [...loops];
		if (at !== null) {
			base = base
				.filter((loop) => new Date(loop.openedAt).getTime() <= at)
				.filter((loop) => {
					if ($activeFilter === 'all') return true;
					const closedAt = loop.closedAt ? new Date(loop.closedAt).getTime() : Number.POSITIVE_INFINITY;
					const openAt = closedAt > at;
					if ($activeFilter === 'open') return openAt;
					if ($activeFilter === 'overdue') {
						if (!openAt) return false;
						return Boolean(loop.deadline && new Date(loop.deadline).getTime() < at);
					}
					if ($activeFilter === 'closed') return !openAt;
					return true;
				});
		} else {
			base = base.filter((loop) => {
				if ($activeFilter === 'open') return loop.state === 'open';
				if ($activeFilter === 'overdue') return loop.state === 'open' && isOverdue(loop.deadline, loop.closedAt);
				if ($activeFilter === 'closed') return loop.state === 'closed';
				return true;
			});
		}

		return base.sort((a, b) => {
		if ($loopSort === 'priority') return a.priority.localeCompare(b.priority);
		if ($loopSort === 'deadline') return (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');
			return +new Date(b.updatedAt) - +new Date(a.updatedAt);
		});
	});

	const selectedLoop = $derived(sorted.find((loop) => loop.id === selectedLoopId) ?? null);
	const selectedEvents = $derived((($eventsStore ?? []) as LoopEvent[]).filter((evt) => evt.loopId === selectedLoopId));
	const openCount = $derived(loops.filter((loop) => loop.state === 'open').length);
	const overdueCount = $derived(loops.filter((loop) => isOverdue(loop.deadline, loop.closedAt)).length);
	const closedCount = $derived(loops.filter((loop) => loop.state === 'closed').length);

	$effect(() => {
		if (!listHost) return;
		const observer = new ResizeObserver(() => {
			listHeight = listHost?.clientHeight ?? 360;
		});
		observer.observe(listHost);
		return () => observer.disconnect();
	});

	async function onSwipeAction(loopId: string, action: 'close' | 'reopen') {
		try {
			if (action === 'close') {
				await closeLoop(loopId, 'done');
				showToast('Loop closed');
				return;
			}
			await reopenLoop(loopId);
			showToast('Loop reopened');
		} catch {
			showToast(action === 'close' ? 'Could not close loop' : 'Could not reopen loop');
		}
	}

	const loading = $derived($loopViewsStore === null);
</script>

{#if loading}
	<Skeleton lines={5} />
{:else}
<div class="loops-page">
	<section class="head-controls">
		{#if scrub}
			<div class="travel-banner">
				<Clock size={14} />
				<span>{scrub.date.toLocaleDateString()}</span>
				<strong>{scrub.active} active</strong>
			</div>
		{:else}
			<div class="filter-wrap">
				{#each filters as filter}
					<Pill
						label={
							filter === 'open'
								? `Open (${openCount})`
								: filter === 'overdue'
									? `Overdue (${overdueCount})`
									: filter === 'closed'
										? `Closed (${closedCount})`
										: 'All'
						}
						active={$activeFilter === filter}
						onClick={() => activeFilter.set(filter)}
					/>
				{/each}
			</div>
		{/if}
		<div class="sorts">
			<button type="button" class:active={$loopSort === 'age'} onclick={() => loopSort.set('age')}>age</button>
			<button type="button" class:active={$loopSort === 'priority'} onclick={() => loopSort.set('priority')}>priority</button>
			<button type="button" class:active={$loopSort === 'deadline'} onclick={() => loopSort.set('deadline')}>deadline</button>
		</div>
	</section>

	<section class="layout">
		<div class="list-wrap" bind:this={listHost}>
			<div class="list">
				{#if sorted.length === 0}
					<Empty label="No loops in this view" icon={true} hint="Use the dump bar below to capture what's on your mind" />
				{:else}
					{#each sorted as loop, index (loop.id)}
						<LoopCard
							loop={loop}
							ghost={Boolean(scrub && loop.closedAt && new Date(loop.closedAt).getTime() <= scrub.date.getTime())}
							stagger={Math.min(index * 18, 180)}
							onSelect={(id) => (selectedLoopId = id)}
							onSwipeAction={onSwipeAction}
						/>
					{/each}
				{/if}
			</div>
		</div>
		<div class="pulse-wrap">
			<Pulse loops={loops} height={listHeight} onScrub={(value) => (scrub = value)} />
			{#if pulseHint}
				<div class="pulse-hint">Drag to time-travel</div>
			{/if}
		</div>
	</section>
</div>

<LoopDetail loop={selectedLoop} events={selectedEvents} open={Boolean(selectedLoop)} onClose={() => (selectedLoopId = null)} />
{/if}

<style>
	.loops-page {
		display: grid;
		grid-template-rows: auto 1fr;
		gap: var(--space-3);
		min-height: 100%;
	}

	.head-controls {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 8px;
		align-items: center;
		margin-bottom: 12px;
	}

	.filter-wrap {
		display: inline-flex;
		gap: 2px;
		padding: 2px;
		border-radius: 10px;
		background: rgba(0, 0, 0, 0.025);
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.02);
	}

	.sorts {
		display: inline-flex;
		gap: 4px;
	}

	.sorts button {
		border: 0;
		background: var(--surface-1);
		border-radius: var(--radius-sm);
		padding: 4px 7px;
		font-size: var(--text-sm);
		font-weight: var(--weight-light);
		color: var(--text4);
		transition: all 0.18s var(--ease-spring);
	}

	.sorts button.active {
		background: var(--surface-3);
		color: var(--text2);
		font-weight: var(--weight-normal);
		box-shadow: var(--shadow-sm);
		transform: translateY(-1px);
	}

	.sorts button:hover {
		background: var(--surface-2);
		color: var(--text2);
	}

	.travel-banner {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 10px;
		border-radius: var(--radius-md);
		background: rgba(110, 99, 160, 0.06);
		border: 1px solid rgba(110, 99, 160, 0.12);
		box-shadow: 0 1px 4px rgba(110, 99, 160, 0.06);
		animation: fadeUp 0.2s var(--ease-spring);
	}

	.travel-banner span,
	.travel-banner strong {
		font-size: var(--text-xs);
		font-family: var(--font-mono);
		color: var(--purple);
	}

	.layout {
		display: grid;
		grid-template-columns: 1fr 48px;
		gap: 4px;
		min-height: 0;
		height: 100%;
	}

	.list-wrap {
		min-height: 0;
		overflow: auto;
		padding-right: 6px;
	}

	.list {
		min-height: 100%;
	}

	.pulse-wrap {
		position: relative;
		opacity: 0.72;
		filter: saturate(0.8);
		transition: opacity var(--dur-base) var(--ease);
	}

	.pulse-wrap:hover {
		opacity: 0.82;
	}

	.pulse-hint {
		position: absolute;
		bottom: 16px;
		right: -4px;
		background: rgba(26, 26, 26, 0.88);
		backdrop-filter: blur(10px);
		color: #f2f0ed;
		font-size: 9px;
		font-family: var(--font-mono);
		padding: 4px 8px;
		border-radius: 6px;
		white-space: nowrap;
		pointer-events: none;
		animation: fadeUp 0.3s var(--ease-spring), fadeIn 0.3s var(--ease);
	}

	@media (max-width: 560px) {
		.head-controls {
			grid-template-columns: 1fr;
			gap: 6px;
		}

		.sorts {
			justify-content: flex-start;
		}
	}

	@media (min-width: 768px) {
		.loops-page {
			gap: 12px;
		}

		.layout {
			grid-template-columns: 1fr 56px;
			gap: 8px;
		}
	}

	@media (min-width: 1024px) {
		.layout {
			grid-template-columns: 1fr 64px;
			gap: 10px;
		}

		.list-wrap {
			padding-right: 10px;
		}
	}
</style>
