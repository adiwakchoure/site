<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Clock, X } from 'lucide-svelte';
	import LoopCard from '$components/LoopCard.svelte';
	import LoopDetail from '$components/LoopDetail.svelte';
	import Pulse from '$components/Pulse.svelte';
	import Empty from '$components/Empty.svelte';
	import Skeleton from '$components/Skeleton.svelte';
	import { closeLoop, reopenLoop, updateLoopTags } from '$db/local';
	import { activeFilter, eventsStore, loopViewsStore, navFilterActiveByRoute, navFilterSheetNonce, tagsStore, tagTypesStore } from '$stores/app';
	import { showToast } from '$stores/toast';
	import { isOverdue } from '$lib/utils';
	import type { LoopEvent, LoopView, Tag, TagType } from '$types/models';

	let selectedLoopId = $state<string | null>(null);
	let listHost = $state<HTMLDivElement | null>(null);
	let listHeight = $state(360);
	let scrub = $state<{ date: Date; active: number; overdue: number } | null>(null);
	let pulseHint = $state(false);
	let selectedFilterIds = $state<string[]>([]);
	let filterSheetOpen = $state(false);
	let handledNavFilterNonce = $state(0);

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
		selectedFilterIds = nextFilters;
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
	const quickFilterLabels = new Map<string, string>([
		['priority:P0', 'P0'],
		['priority:P1', 'P1'],
		['energy:waiting', 'Waiting'],
		['energy:active', 'Active'],
		['deadline:today', 'Due today']
	]);
	const quickFilterOrder = ['priority:P0', 'priority:P1', 'energy:waiting', 'energy:active', 'deadline:today'];

	function parseToken(token: string): { slug: string; value: string } {
		const [slug, ...rest] = token.split(':');
		return { slug, value: rest.join(':') };
	}

	function formatFilterLabel(token: string): string {
		const quick = quickFilterLabels.get(token);
		if (quick) return quick;
		const { slug, value } = parseToken(token);
		return `${slug}:${value}`;
	}

	function filterTokensForLoop(loop: LoopView, tagBag: Map<string, string[]>): string[] {
		const tokens = new Set<string>();
		tokens.add(`priority:${loop.priority}`);
		tokens.add(`energy:${loop.energy}`);
		if (loop.deadline) {
			tokens.add(`deadline:${loop.deadline}`);
			if (loop.deadline === new Date().toISOString().slice(0, 10)) tokens.add('deadline:today');
		}
		if (loop.project) tokens.add(`project:${loop.project}`);
		if (loop.parentId) tokens.add(`parent:${loop.parentId}`);
		for (const person of loop.people) {
			tokens.add(`person:${person}`);
		}
		for (const [slug, values] of tagBag.entries()) {
			for (const value of values) {
				tokens.add(`${slug}:${value}`);
			}
		}
		return [...tokens.values()];
	}

	const availableFilters = $derived.by<QuickFilter[]>(() => {
		const counts = new Map<string, number>();
		for (const loop of loops) {
			const tagBag = loopTagMap.get(loop.id) ?? new Map<string, string[]>();
			for (const token of filterTokensForLoop(loop, tagBag)) {
				counts.set(token, (counts.get(token) ?? 0) + 1);
			}
		}
		for (const token of selectedFilterIds) {
			if (!counts.has(token)) counts.set(token, 0);
		}

		const quick = quickFilterOrder
			.filter((token) => counts.has(token))
			.map((token) => {
				const { slug, value } = parseToken(token);
				return { id: token, label: formatFilterLabel(token), slug, value, count: counts.get(token) ?? 0 };
			});
		const quickSet = new Set(quick.map((item) => item.id));
		const dynamic = [...counts.entries()]
			.filter(([token]) => !quickSet.has(token))
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.map(([token, count]) => {
				const { slug, value } = parseToken(token);
				return { id: token, label: formatFilterLabel(token), slug, value, count };
			});
		return [...quick, ...dynamic];
	});
	const hasActiveFilters = $derived(selectedFilterIds.length > 0 || $activeFilter !== 'open');

	function toggleFilter(id: string) {
		selectedFilterIds = selectedFilterIds.includes(id) ? selectedFilterIds.filter((item) => item !== id) : [...selectedFilterIds, id];
	}

	function clearAllFilters() {
		selectedFilterIds = [];
	}

	function setStatusFilter(filter: 'open' | 'overdue' | 'closed' | 'all') {
		activeFilter.set(filter);
	}

	function loopMatchesTagFilters(loop: LoopView): boolean {
		if (selectedFilterIds.length === 0) return true;
		const tagBag = loopTagMap.get(loop.id) ?? new Map<string, string[]>();
		return selectedFilterIds.every((token) => {
			const [slug, ...rest] = token.split(':');
			const value = rest.join(':');
			if (slug === 'priority') return loop.priority === value;
			if (slug === 'energy') return loop.energy === value;
			if (slug === 'deadline' && value === 'today') return Boolean(loop.deadline && loop.deadline === new Date().toISOString().slice(0, 10));
			if (slug === 'deadline') return loop.deadline === value;
			if (slug === 'project') return loop.project === value;
			if (slug === 'parent') return loop.parentId === value;
			if (slug === 'person') return loop.people.includes(value);
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
		const nonce = $navFilterSheetNonce;
		if (!$page.url.pathname.startsWith('/loops') || nonce === handledNavFilterNonce) return;
		handledNavFilterNonce = nonce;
		filterSheetOpen = true;
	});

	$effect(() => {
		navFilterActiveByRoute.update((state) => ({
			...state,
			'/loops': hasActiveFilters
		}));
	});
</script>

{#if loading}
	<Skeleton lines={5} />
{:else}
<div class="loops-page">
	{#if scrub}
		<section class="head-controls">
			<div class="travel-banner">
				<Clock size={14} />
				<span>{scrub.date.toLocaleDateString()}</span>
				<strong>{scrub.active} active</strong>
			</div>
		</section>
	{/if}

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
					<h3>Filters</h3>
					<p>Choose status and tag filters in one place.</p>
				</div>
				<button type="button" class="sheet-close" onclick={() => (filterSheetOpen = false)}>
					<X size={14} />
				</button>
			</header>
			<div class="filter-sheet-list">
				<div class="sheet-section-title">Status</div>
				<button type="button" class="sheet-option" class:active={$activeFilter === 'open'} onclick={() => setStatusFilter('open')}>
					<span>Open</span>
					<small>{openCount}</small>
				</button>
				<button type="button" class="sheet-option" class:active={$activeFilter === 'overdue'} onclick={() => setStatusFilter('overdue')}>
					<span>Overdue</span>
					<small>{overdueCount}</small>
				</button>
				<button type="button" class="sheet-option" class:active={$activeFilter === 'closed'} onclick={() => setStatusFilter('closed')}>
					<span>Closed</span>
					<small>{closedCount}</small>
				</button>
				<button type="button" class="sheet-option" class:active={$activeFilter === 'all'} onclick={() => setStatusFilter('all')}>
					<span>All loops</span>
				</button>

				<div class="sheet-section-title tags">Tags</div>
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

	.sheet-section-title {
		margin-top: 4px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: var(--tracking-caps);
		color: var(--text3);
		text-transform: uppercase;
	}

	.sheet-section-title.tags {
		margin-top: 10px;
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
