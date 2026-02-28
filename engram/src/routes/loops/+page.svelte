<script lang="ts">
	import { Clock } from 'lucide-svelte';
	import LoopCard from '$components/LoopCard.svelte';
	import Pill from '$components/Pill.svelte';
	import TaskDetail from '$components/TaskDetail.svelte';
	import Pulse from '$components/Pulse.svelte';
	import Empty from '$components/Empty.svelte';
	import { activeFilter, eventsStore, loopSort, loopsStore } from '$stores/app';
	import { isOverdue } from '$lib/utils';
	import type { Loop, LoopEvent } from '$types/models';

	const filters: Array<'open' | 'overdue' | 'all'> = ['open', 'overdue', 'all'];

	let selectedTaskId = $state<string | null>(null);
	let listHost: HTMLDivElement | null = null;
	let listHeight = $state(360);
	let scrub = $state<{ date: Date; active: number; overdue: number } | null>(null);

	const loops = $derived(($loopsStore ?? []) as Loop[]);

	const sorted = $derived.by(() => {
		const at = scrub?.date?.getTime() ?? null;
		let base = [...loops];
		if (at !== null) {
			base = base
				.filter((loop) => new Date(loop.createdAt).getTime() <= at)
				.filter((loop) => {
					if ($activeFilter === 'all') return true;
					const closedAt = loop.closedAt ? new Date(loop.closedAt).getTime() : Number.POSITIVE_INFINITY;
					const openAt = closedAt > at;
					if ($activeFilter === 'open') return openAt;
					if ($activeFilter === 'overdue') {
						if (!openAt) return false;
						return Boolean(loop.deadline && new Date(loop.deadline).getTime() < at);
					}
					return true;
				});
		} else {
			base = base.filter((loop) => {
				if ($activeFilter === 'open') return loop.state === 'open';
				if ($activeFilter === 'overdue') return loop.state === 'open' && isOverdue(loop.deadline, loop.closedAt);
				return true;
			});
		}

		return base.sort((a, b) => {
		if ($loopSort === 'priority') return a.priority.localeCompare(b.priority);
		if ($loopSort === 'deadline') return (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');
			return +new Date(b.updatedAt) - +new Date(a.updatedAt);
		});
	});

	const selectedTask = $derived(sorted.find((loop) => loop.id === selectedTaskId) ?? null);
	const selectedEvents = $derived((($eventsStore ?? []) as LoopEvent[]).filter((evt) => evt.loopId === selectedTaskId));
	const openCount = $derived(loops.filter((loop) => loop.state === 'open').length);
	const overdueCount = $derived(loops.filter((loop) => isOverdue(loop.deadline, loop.closedAt)).length);

	$effect(() => {
		if (!listHost) return;
		const observer = new ResizeObserver(() => {
			listHeight = listHost?.clientHeight ?? 360;
		});
		observer.observe(listHost);
		return () => observer.disconnect();
	});
</script>

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
					label={filter === 'open' ? `Open (${openCount})` : filter === 'overdue' ? `Overdue (${overdueCount})` : 'All'}
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
				<Empty label="No loops in this view" icon={true} />
			{:else}
				{#each sorted as loop (loop.id)}
					<LoopCard
						loop={loop}
						ghost={Boolean(scrub && loop.closedAt && new Date(loop.closedAt).getTime() <= scrub.date.getTime())}
						onSelect={(id) => (selectedTaskId = id)}
					/>
				{/each}
			{/if}
		</div>
	</div>
	<Pulse loops={loops} height={listHeight} onScrub={(value) => (scrub = value)} />
</section>

<TaskDetail task={selectedTask} events={selectedEvents} open={Boolean(selectedTask)} onClose={() => (selectedTaskId = null)} />

<style>
	.head-controls {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 8px;
		align-items: center;
		margin-bottom: 10px;
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
		background: transparent;
		border-radius: 6px;
		padding: 4px 7px;
		font-size: 11px;
		font-weight: 300;
		color: var(--text4);
		transition: all 0.15s var(--ease);
	}

	.sorts button.active {
		background: rgba(0, 0, 0, 0.04);
		color: var(--text2);
		font-weight: 400;
	}

	.travel-banner {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 10px;
		border-radius: 12px;
		background: rgba(110, 99, 160, 0.06);
		border: 1px solid rgba(110, 99, 160, 0.12);
		box-shadow: 0 1px 4px rgba(110, 99, 160, 0.06);
		animation: fadeUp 0.2s var(--ease-spring);
	}

	.travel-banner span,
	.travel-banner strong {
		font-size: 10px;
		font-family: 'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
		color: var(--purple);
	}

	.layout {
		display: grid;
		grid-template-columns: 1fr 48px;
		gap: 4px;
		min-height: 0;
		height: calc(100% - 44px);
	}

	.list-wrap {
		min-height: 0;
		overflow: auto;
		padding-right: 6px;
	}

	.list {
		min-height: 100%;
	}
</style>
