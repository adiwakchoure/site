<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { ChevronLeft, ChevronRight, Clock, SlidersHorizontal, X } from 'lucide-svelte';
	import LoopCard from '$components/LoopCard.svelte';
	import Pill from '$components/Pill.svelte';
	import LoopDetail from '$components/LoopDetail.svelte';
	import Pulse from '$components/Pulse.svelte';
	import Empty from '$components/Empty.svelte';
	import Skeleton from '$components/Skeleton.svelte';
	import { closeLoop, reopenLoop, updateLoopTags } from '$db/local';
	import { activeFilter, eventsStore, loopViewsStore, tagsStore, tagTypesStore } from '$stores/app';
	import { showToast } from '$stores/toast';
	import { isOverdue } from '$lib/utils';
	import type { LoopEvent, LoopView, Tag, TagType } from '$types/models';

	const filters: Array<'open' | 'overdue' | 'closed' | 'all'> = ['open', 'overdue', 'closed', 'all'];

	let selectedLoopId = $state<string | null>(null);
	let listHost = $state<HTMLDivElement | null>(null);
	let listHeight = $state(360);
	let scrub = $state<{ date: Date; active: number; overdue: number } | null>(null);
	let pulseHint = $state(false);
	let selectedFilterIds = $state<string[]>([]);
	let filterSheetOpen = $state(false);
	let controlsRailEl = $state<HTMLDivElement | null>(null);
	let showControlsLeft = $state(false);
	let showControlsRight = $state(false);

	onMount(() => {
		if (!browser) return;
		const key = 'engram:pulse-hint-shown';
		if (!localStorage.getItem(key)) {
			pulseHint = true;
			localStorage.setItem(key, '1');
			setTimeout(() => { pulseHint = false; }, 4000);
		}
	});

	$effect(() => {
		if (!browser) return;
		const params = $page.url.searchParams;
		const requestedFilter = params.get('filter');
		if (requestedFilter === 'open' || requestedFilter === 'overdue' || requestedFilter === 'closed' || requestedFilter === 'all') {
			activeFilter.set(requestedFilter);
		}
		const fromTagParam = params
			.getAll('tag')
			.map((value) => value.trim())
			.filter((value) => value.includes(':'));
		const fromPairParams = (() => {
			const slug = params.get('tagSlug');
			const value = params.get('tagValue');
			return slug && value ? [`${slug}:${value}`] : [];
		})();
		const nextFilters = [...new Set([...fromTagParam, ...fromPairParams])];
		if (nextFilters.length > 0) {
			selectedFilterIds = nextFilters;
		}
	});

	const loops = $derived(($loopViewsStore ?? []) as LoopView[]);
	const tags = $derived(($tagsStore ?? []) as Tag[]);
	const tagTypes = $derived(($tagTypesStore ?? []) as TagType[]);
	const tagSlugByTypeId = $derived(new Map(tagTypes.map((type) => [type.id, type.slug])));
	const loopTagMap = $derived.by(() => {
		const map = new Map<string, Map<string, string[]>>();
		for (const tag of tags) {
			const slug = tagSlugByTypeId.get(tag.tagTypeId);
			if (!slug) continue;
			const value = tag.valueText ?? tag.valueDate ?? (tag.valueNumber != null ? String(tag.valueNumber) : null);
			if (!value) continue;
			const loopMap = map.get(tag.loopId) ?? new Map<string, string[]>();
			const values = loopMap.get(slug) ?? [];
			if (!values.includes(value)) values.push(value);
			loopMap.set(slug, values);
			map.set(tag.loopId, loopMap);
		}
		return map;
	});

	type QuickFilter = { id: string; label: string; slug?: string; value?: string; count?: number };
	const systemSlugs = new Set(['state', 'closed_reason', 'priority', 'energy', 'deadline', 'project', 'person', 'parent']);
	const availableFilters = $derived.by<QuickFilter[]>(() => {
		const filters: QuickFilter[] = [
			{ id: 'priority:P0', label: 'P0' },
			{ id: 'priority:P1', label: 'P1' },
			{ id: 'energy:waiting', label: 'Waiting' },
			{ id: 'energy:active', label: 'Active' },
			{ id: 'deadline:today', label: 'Due today' }
		];
		const customCounts = new Map<string, number>();
		for (const [loopId, loopTags] of loopTagMap.entries()) {
			const loop = loops.find((entry) => entry.id === loopId);
			if (!loop || loop.state !== 'open') continue;
			for (const [slug, values] of loopTags.entries()) {
				if (systemSlugs.has(slug)) continue;
				for (const value of values) {
					const key = `${slug}:${value}`;
					customCounts.set(key, (customCounts.get(key) ?? 0) + 1);
				}
			}
		}
		const topCustom = [...customCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 20)
			.map(([key, count]) => {
				const [slug, ...rest] = key.split(':');
				const value = rest.join(':');
				return { id: key, label: `${slug}:${value}`, slug, value, count };
			});
		return [...filters, ...topCustom];
	});
	const filterById = $derived(new Map(availableFilters.map((entry) => [entry.id, entry])));
	const selectedFilters = $derived(
		selectedFilterIds.map((id) => filterById.get(id)).filter((entry): entry is QuickFilter => Boolean(entry))
	);
	const quickRailFilters = $derived.by(() => {
		return selectedFilters;
	});

	function toggleFilter(id: string) {
		selectedFilterIds = selectedFilterIds.includes(id) ? selectedFilterIds.filter((item) => item !== id) : [...selectedFilterIds, id];
	}

	function clearAllFilters() {
		selectedFilterIds = [];
	}

	function updateRailOverflow(rail: HTMLDivElement | null) {
		if (!rail) return;
		const maxLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
		const left = rail.scrollLeft > 6;
		const right = maxLeft - rail.scrollLeft > 6;
		showControlsLeft = left;
		showControlsRight = right;
	}

	function scrollRail(rail: HTMLDivElement | null, direction: 'left' | 'right') {
		if (!rail) return;
		const step = Math.max(140, Math.round(rail.clientWidth * 0.7));
		rail.scrollBy({ left: direction === 'right' ? step : -step, behavior: 'smooth' });
	}

	function loopMatchesTagFilters(loop: LoopView): boolean {
		if (selectedFilterIds.length === 0) return true;
		const tagBag = loopTagMap.get(loop.id) ?? new Map<string, string[]>();
		return selectedFilterIds.every((token) => {
			const [slug, ...rest] = token.split(':');
			const value = rest.join(':');
			if (slug === 'priority') return loop.priority === value;
			if (slug === 'energy') return loop.energy === value;
			if (slug === 'deadline' && value === 'today') {
				return Boolean(loop.deadline && loop.deadline === new Date().toISOString().slice(0, 10));
			}
			const values = tagBag.get(slug) ?? [];
			return values.includes(value);
		});
	}
	const rankedOpen = $derived.by(() =>
		loops
			.filter((loop) => loop.state === 'open')
			.map((loop) => {
				const ageDays = Math.max(1, Math.floor((Date.now() - +new Date(loop.openedAt)) / (1000 * 60 * 60 * 24)));
				const overdueWeight = loop.deadline && +new Date(loop.deadline) < Date.now() ? 3 : 0;
				const priorityWeight = loop.priority === 'P0' ? 3 : loop.priority === 'P1' ? 2 : 1;
				return { loop, score: priorityWeight * 3 + overdueWeight * 4 + Math.min(ageDays, 14) };
			})
			.sort((a, b) => b.score - a.score)
			.map((row) => row.loop)
	);
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
		base = base.filter((loop) => loopMatchesTagFilters(loop));

		return base.sort((a, b) => {
		const score = (loop: LoopView) => {
			if (loop.state !== 'open') return -999;
			const ageDays = Math.max(1, Math.floor((Date.now() - +new Date(loop.openedAt)) / (1000 * 60 * 60 * 24)));
			const overdueWeight = loop.deadline && +new Date(loop.deadline) < Date.now() ? 3 : 0;
			const priorityWeight = loop.priority === 'P0' ? 3 : loop.priority === 'P1' ? 2 : 1;
			const waitingPenalty = loop.energy === 'waiting' ? 1 : 0;
			return priorityWeight * 3 + overdueWeight * 4 + Math.min(ageDays, 14) - waitingPenalty;
		};
		if (a.state === 'open' && b.state === 'open') return score(b) - score(a);
		if (a.state !== b.state) return a.state === 'open' ? -1 : 1;
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

	async function onSwipeAction(loopId: string, action: 'close' | 'reopen' | 'snooze') {
		try {
			if (action === 'close') {
				await closeLoop(loopId, 'done');
				showToast('Loop closed');
				return;
			}
			if (action === 'snooze') {
				const tomorrow = new Date();
				tomorrow.setDate(tomorrow.getDate() + 1);
				await updateLoopTags(loopId, { deadline: tomorrow.toISOString().slice(0, 10) });
				showToast('Snoozed to tomorrow');
				return;
			}
			await reopenLoop(loopId);
			showToast('Loop reopened');
		} catch {
			showToast(action === 'close' ? 'Could not close loop' : action === 'snooze' ? 'Could not snooze loop' : 'Could not reopen loop');
		}
	}

	const loading = $derived($loopViewsStore === null);

	$effect(() => {
		if (!browser || !controlsRailEl) return;
		const onScroll = () => updateRailOverflow(controlsRailEl);
		const onResize = () => updateRailOverflow(controlsRailEl);
		controlsRailEl.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onResize);
		const resizeObserver = new ResizeObserver(() => updateRailOverflow(controlsRailEl));
		resizeObserver.observe(controlsRailEl);
		requestAnimationFrame(() => updateRailOverflow(controlsRailEl));
		return () => {
			controlsRailEl?.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onResize);
			resizeObserver.disconnect();
		};
	});

	$effect(() => {
		openCount;
		overdueCount;
		closedCount;
		requestAnimationFrame(() => updateRailOverflow(controlsRailEl));
	});

	$effect(() => {
		selectedFilterIds;
		quickRailFilters;
		requestAnimationFrame(() => updateRailOverflow(controlsRailEl));
	});
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
			<div class="rail-shell" class:overflowed={showControlsLeft || showControlsRight}>
				{#if showControlsLeft}
					<button type="button" class="rail-chevron left" aria-label="Scroll controls left" onclick={() => scrollRail(controlsRailEl, 'left')}>
						<ChevronLeft size={15} />
					</button>
				{/if}
				<div class="control-rail" bind:this={controlsRailEl}>
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
					<button type="button" class="filter-launch" onclick={() => (filterSheetOpen = true)}>
						<SlidersHorizontal size={13} />
						<span>Filters{selectedFilterIds.length ? ` (${selectedFilterIds.length})` : ''}</span>
					</button>
					{#if selectedFilterIds.length > 0}
						<button type="button" class="filter-clear" onclick={clearAllFilters}>Clear</button>
					{/if}
					{#each quickRailFilters as quick}
						<Pill label={quick.label} active={selectedFilterIds.includes(quick.id)} onClick={() => toggleFilter(quick.id)} />
					{/each}
				</div>
				{#if showControlsRight}
					<button type="button" class="rail-chevron right" aria-label="Scroll controls right" onclick={() => scrollRail(controlsRailEl, 'right')}>
						<ChevronRight size={15} />
					</button>
				{/if}
			</div>
		{/if}
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

{#if filterSheetOpen}
	<div
		class="filter-overlay"
		role="button"
		tabindex="0"
		aria-label="Close filters"
		onpointerdown={() => (filterSheetOpen = false)}
		onkeydown={(event) => {
			if (event.key === 'Escape') filterSheetOpen = false;
		}}
	>
		<div
			class="filter-sheet"
			role="dialog"
			aria-modal="true"
			aria-label="Filter loops"
			tabindex="-1"
			onpointerdown={(event) => event.stopPropagation()}
		>
			<header class="filter-sheet-head">
				<div>
					<h3>Tag filters</h3>
					<p>Filter loops by typed tags, including custom tags.</p>
				</div>
				<button type="button" class="sheet-close" onclick={() => (filterSheetOpen = false)}>
					<X size={14} />
				</button>
			</header>
			<div class="filter-sheet-list">
				{#each availableFilters as option}
					<button type="button" class="sheet-option" class:active={selectedFilterIds.includes(option.id)} onclick={() => toggleFilter(option.id)}>
						<span>{option.label}</span>
						{#if option.count}
							<small>{option.count}</small>
						{/if}
					</button>
				{/each}
			</div>
			<footer class="filter-sheet-footer">
				<button type="button" class="sheet-clear" onclick={clearAllFilters}>Clear filters</button>
				<button type="button" class="sheet-done" onclick={() => (filterSheetOpen = false)}>Done</button>
			</footer>
		</div>
	</div>
{/if}
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
		grid-template-columns: 1fr;
		gap: 6px;
		align-items: start;
		margin-bottom: 6px;
		position: sticky;
		top: 0;
		z-index: 20;
		padding-top: 2px;
		background: linear-gradient(180deg, color-mix(in srgb, var(--bg) 98%, #fff) 68%, transparent);
		backdrop-filter: blur(6px);
	}

	.control-rail {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px;
		border-radius: 10px;
		background: rgba(0, 0, 0, 0.025);
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.02);
		overflow-x: auto;
		scrollbar-width: none;
		-ms-overflow-style: none;
		scroll-behavior: smooth;
	}

	.control-rail::-webkit-scrollbar {
		display: none;
	}

	.rail-shell {
		position: relative;
	}

	.rail-shell::before,
	.rail-shell::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		width: 24px;
		pointer-events: none;
		z-index: 2;
		opacity: 0;
		transition: opacity 120ms ease;
	}

	.rail-shell::before {
		left: 0;
		background: linear-gradient(90deg, var(--bg), transparent);
	}

	.rail-shell::after {
		right: 0;
		background: linear-gradient(270deg, var(--bg), transparent);
	}

	.rail-shell.overflowed::before,
	.rail-shell.overflowed::after {
		opacity: 1;
	}

	.rail-chevron {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 28px;
		height: 28px;
		border-radius: 999px;
		border: 1px solid var(--border-soft);
		background: color-mix(in srgb, var(--bg) 88%, #fff);
		color: var(--text2);
		display: grid;
		place-items: center;
		z-index: 3;
	}

	.rail-chevron.left {
		left: 0;
	}

	.rail-chevron.right {
		right: 0;
	}

	.filter-launch {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: var(--text-sm);
		font-family: var(--font-mono);
		color: var(--text2);
		padding: 0 10px;
		min-height: 36px;
		border-radius: 999px;
		border: 1px solid var(--border-soft);
		background: var(--surface-2);
		flex-shrink: 0;
	}

	.filter-clear {
		min-height: 36px;
		padding: 0 10px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--red) 24%, transparent);
		background: color-mix(in srgb, var(--red) 10%, transparent);
		color: var(--red);
		font-size: var(--text-sm);
		font-family: var(--font-mono);
		flex-shrink: 0;
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
		grid-template-columns: 1fr;
		gap: 8px;
		min-height: 0;
		height: 100%;
	}

	.list-wrap {
		min-height: 0;
		overflow: auto;
		padding-right: 0;
		display: grid;
		gap: 10px;
		width: min(100%, 40rem);
		margin-inline: auto;
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
			gap: 6px;
		}

		.pulse-wrap {
			display: none;
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

		.list-wrap {
			padding-right: 6px;
		}
	}

	@media (min-width: 1024px) {
		.layout {
			grid-template-columns: 1fr 64px;
			gap: 10px;
		}

		.list-wrap {
			padding-right: 10px;
			width: min(100%, 41rem);
		}
	}

	.filter-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.2);
		backdrop-filter: blur(6px);
		display: flex;
		align-items: flex-end;
		z-index: 140;
	}

	.filter-sheet {
		width: 100%;
		max-height: min(74vh, 620px);
		background: var(--bg);
		border-radius: 18px 18px 0 0;
		border: 1px solid var(--border-soft);
		box-shadow: var(--shadow-lg);
		display: grid;
		grid-template-rows: auto 1fr auto;
	}

	.filter-sheet-head {
		padding: 12px;
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 10px;
		border-bottom: 1px solid var(--border-soft);
	}

	.filter-sheet-head h3 {
		margin: 0;
		font-size: var(--text-lg);
		font-family: var(--font-serif);
	}

	.filter-sheet-head p {
		margin: 4px 0 0;
		font-size: var(--text-sm);
		color: var(--text3);
	}

	.sheet-close {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 1px solid var(--border-soft);
		background: var(--surface-2);
		color: var(--text2);
	}

	.filter-sheet-list {
		overflow: auto;
		padding: 10px 12px;
		display: grid;
		gap: 6px;
	}

	.sheet-option {
		min-height: 44px;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-soft);
		background: var(--surface-1);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 10px;
		font-size: var(--text-md);
		color: var(--text2);
	}

	.sheet-option.active {
		border-color: color-mix(in srgb, var(--accent) 28%, transparent);
		background: color-mix(in srgb, var(--accent) 8%, var(--surface-2));
		color: var(--text);
	}

	.sheet-option small {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text3);
	}

	.filter-sheet-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 10px 12px calc(10px + var(--safe-bottom));
		border-top: 1px solid var(--border-soft);
	}

	.sheet-clear,
	.sheet-done {
		min-height: 44px;
		padding: 0 14px;
		border-radius: var(--radius-md);
	}

	.sheet-clear {
		border: 1px solid var(--border-soft);
		background: var(--surface-2);
		color: var(--text2);
	}

	.sheet-done {
		border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
		background: color-mix(in srgb, var(--accent) 14%, #fff);
		color: var(--accent);
		font-weight: var(--weight-medium);
	}
</style>
