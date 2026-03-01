<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { Clock } from 'lucide-svelte';
	import LoopCard from '$components/LoopCard.svelte';
	import Pill from '$components/Pill.svelte';
	import TaskDetail from '$components/TaskDetail.svelte';
	import Pulse from '$components/Pulse.svelte';
	import Empty from '$components/Empty.svelte';
	import Skeleton from '$components/Skeleton.svelte';
	import { closeLoop, reopenLoop } from '$db/local';
	import { activeFilter, eventsStore, loopSort, loopsStore } from '$stores/app';
	import { showToast } from '$stores/toast';
	import { isOverdue } from '$lib/utils';
	import type { Loop, LoopEvent } from '$types/models';

	const filters: Array<'open' | 'overdue' | 'closed' | 'all'> = ['open', 'overdue', 'closed', 'all'];

	let selectedTaskId = $state<string | null>(null);
	let listHost: HTMLDivElement | null = null;
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

	const selectedTask = $derived(sorted.find((loop) => loop.id === selectedTaskId) ?? null);
	const selectedEvents = $derived((($eventsStore ?? []) as LoopEvent[]).filter((evt) => evt.loopId === selectedTaskId));
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

	const loading = $derived($loopsStore === null);
</script>

{#if loading}
	<Skeleton lines={5} />
{:else}
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
						onSelect={(id) => (selectedTaskId = id)}
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

<TaskDetail task={selectedTask} events={selectedEvents} open={Boolean(selectedTask)} onClose={() => (selectedTaskId = null)} />
{/if}

<style>
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
		background: rgba(255, 255, 255, 0.35);
		border-radius: 6px;
		padding: 4px 7px;
		font-size: var(--text-xs);
		font-weight: var(--weight-light);
		color: var(--text4);
		transition: all 0.18s var(--ease-spring);
	}

	.sorts button.active {
		background: rgba(255, 255, 255, 0.92);
		color: var(--text2);
		font-weight: var(--weight-normal);
		box-shadow: var(--shadow-sm);
		transform: translateY(-1px);
	}

	.sorts button:hover {
		background: rgba(255, 255, 255, 0.8);
		color: var(--text2);
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
		font-family: var(--font-mono);
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
</style>
