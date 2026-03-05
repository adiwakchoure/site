<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { ChevronLeft, ChevronRight, X } from 'lucide-svelte';
	import Empty from '$components/Empty.svelte';
	import Pill from '$components/Pill.svelte';
	import Skeleton from '$components/Skeleton.svelte';
	import { loopViewsStore, navFilterActiveByRoute, navFilterSheetNonce, tagsStore, tagTypesStore } from '$stores/app';
	import { isOverdue } from '$lib/utils';
	import type { LoopView, Tag, TagType } from '$types/models';

	type TagRow = {
		value: string;
		open: LoopView[];
		closed: LoopView[];
		overdueCount: number;
	};

	const loops = $derived(($loopViewsStore ?? []) as LoopView[]);
	const tags = $derived(($tagsStore ?? []) as Tag[]);
	const tagTypes = $derived(($tagTypesStore ?? []) as TagType[]);

	const hiddenPivots = new Set(['state', 'closed_reason']);
	const pivotOptions = $derived.by(() => {
		const dynamic = tagTypes
			.filter((type) => !hiddenPivots.has(type.slug))
			.map((type) => ({ slug: type.slug, label: type.name || type.slug }));
		const bySlug = new Map(dynamic.map((option) => [option.slug, option]));
		// Keep "People" as a stable first pivot even if type metadata is incomplete.
		if (!bySlug.has('person')) bySlug.set('person', { slug: 'person', label: 'People' });
		const ordered = [...bySlug.values()];
		ordered.sort((a, b) => {
			if (a.slug === 'person') return -1;
			if (b.slug === 'person') return 1;
			return a.label.localeCompare(b.label);
		});
		return ordered;
	});

	let pivot = $state('person');
	let hydratedPivot = $state(false);
	let pivotRailEl = $state<HTMLDivElement | null>(null);
	let showLeftChevron = $state(false);
	let showRightChevron = $state(false);
	let selectedRow = $state<TagRow | null>(null);
	let filterSheetOpen = $state(false);
	let handledNavFilterNonce = $state(0);

	$effect(() => {
		if (!browser || hydratedPivot) return;
		const stored = localStorage.getItem('engram:tags-pivot');
		if (stored && pivotOptions.some((option) => option.slug === stored)) {
			pivot = stored;
		}
		hydratedPivot = true;
	});

	$effect(() => {
		if (pivotOptions.length === 0) return;
		if (!pivotOptions.some((option) => option.slug === pivot)) {
			pivot = 'person';
		}
	});

	$effect(() => {
		if (!browser) return;
		localStorage.setItem('engram:tags-pivot', pivot);
	});

	$effect(() => {
		const nonce = $navFilterSheetNonce;
		if (!$page.url.pathname.startsWith('/tags') || nonce === handledNavFilterNonce) return;
		handledNavFilterNonce = nonce;
		filterSheetOpen = true;
	});

	$effect(() => {
		navFilterActiveByRoute.update((state) => ({
			...state,
			'/tags': pivot !== 'person'
		}));
	});

	function updatePivotOverflow() {
		if (!pivotRailEl) return;
		const maxLeft = Math.max(0, pivotRailEl.scrollWidth - pivotRailEl.clientWidth);
		showLeftChevron = pivotRailEl.scrollLeft > 6;
		showRightChevron = maxLeft - pivotRailEl.scrollLeft > 6;
	}

	function scrollPivotRail(direction: 'left' | 'right') {
		if (!pivotRailEl) return;
		const delta = Math.max(140, Math.round(pivotRailEl.clientWidth * 0.7));
		pivotRailEl.scrollBy({ left: direction === 'right' ? delta : -delta, behavior: 'smooth' });
	}

	$effect(() => {
		if (!browser || !pivotRailEl) return;
		pivotOptions;
		const onScroll = () => updatePivotOverflow();
		const onResize = () => updatePivotOverflow();
		pivotRailEl.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onResize);
		const resizeObserver = new ResizeObserver(() => updatePivotOverflow());
		resizeObserver.observe(pivotRailEl);
		requestAnimationFrame(updatePivotOverflow);
		return () => {
			pivotRailEl?.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onResize);
			resizeObserver.disconnect();
		};
	});

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

	function valuesForPivot(loop: LoopView, slug: string): string[] {
		if (slug === 'person') return loop.people;
		if (slug === 'priority') return [loop.priority];
		if (slug === 'energy') return [loop.energy];
		if (slug === 'deadline') return loop.deadline ? [loop.deadline] : [];
		if (slug === 'project') return loop.project ? [loop.project] : [];
		if (slug === 'parent') return loop.parentId ? [loop.parentId] : [];
		return loopTagMap.get(loop.id)?.get(slug) ?? [];
	}

	const rows = $derived.by<TagRow[]>(() => {
		const grouped = new Map<string, LoopView[]>();
		for (const loop of loops) {
			const values = valuesForPivot(loop, pivot);
			for (const value of values) {
				const list = grouped.get(value) ?? [];
				list.push(loop);
				grouped.set(value, list);
			}
		}
		return [...grouped.entries()]
			.map(([value, related]) => {
				const open = related.filter((loop) => loop.state === 'open');
				const closed = related.filter((loop) => loop.state === 'closed');
				const overdueCount = open.filter((loop) => isOverdue(loop.deadline, loop.closedAt)).length;
				return { value, open, closed, overdueCount };
			})
			.sort((a, b) => b.open.length - a.open.length || b.overdueCount - a.overdueCount || a.value.localeCompare(b.value));
	});

	function hrefForRow(value: string): string {
		const params = new URLSearchParams();
		params.set('filter', 'open');
		params.append('tag', `${pivot}:${value}`);
		return `/loops?${params.toString()}`;
	}

	function openRowDrawer(row: TagRow) {
		selectedRow = row;
	}

	function closeRowDrawer() {
		selectedRow = null;
	}

	const loading = $derived($loopViewsStore === null || $tagTypesStore === null || $tagsStore === null);
</script>

{#if loading}
	<Skeleton lines={6} />
{:else}
	<section class="tags-view">
		<header class="tags-head">
			<h2>Tags</h2>
			<div class="pivot-rail-wrap" class:overflowed={showLeftChevron || showRightChevron}>
				{#if showLeftChevron}
					<button type="button" class="pivot-chevron left" aria-label="Scroll tags left" onclick={() => scrollPivotRail('left')}>
						<ChevronLeft size={15} />
					</button>
				{/if}
				<div class="pivot-rail" bind:this={pivotRailEl}>
					{#each pivotOptions as option}
						<Pill label={option.label} active={pivot === option.slug} onClick={() => (pivot = option.slug)} />
					{/each}
				</div>
				{#if showRightChevron}
					<button type="button" class="pivot-chevron right" aria-label="Scroll tags right" onclick={() => scrollPivotRail('right')}>
						<ChevronRight size={15} />
					</button>
				{/if}
			</div>
		</header>

		{#if rows.length === 0}
			<Empty label="No tags yet for this pivot" icon={true} hint="Capture loops and apply tags to see grouped action rows." />
		{:else}
			<div class="list-wrap">
				<div class="rows">
					{#each rows as row}
						<button class="row panel" type="button" onclick={() => openRowDrawer(row)}>
							<div class="row-head">
								<strong class="row-title">{row.value}</strong>
								<small class="row-cta">view</small>
							</div>
							<div class="row-meta">
								<span class="meta-chip">{row.open.length} open</span>
								{#if row.overdueCount > 0}
									<span class="meta-chip risk">{row.overdueCount} overdue</span>
								{/if}
								{#if row.closed.length > 0}
									<span class="meta-chip">{row.closed.length} closed</span>
								{/if}
							</div>
							<div class="preview">
								{#if row.open.length === 0}
									<span>No open loops</span>
								{:else}
									{#each row.open.slice(0, 2) as loop}
										<span>{loop.title}</span>
									{/each}
								{/if}
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</section>
{/if}

{#if selectedRow}
	<div
		class="drawer-overlay"
		role="button"
		tabindex="0"
		aria-label="Close tag drawer"
		onpointerdown={closeRowDrawer}
		onkeydown={(event) => {
			if (event.key === 'Escape') closeRowDrawer();
		}}
	>
		<div
			class="drawer panel"
			role="dialog"
			aria-modal="true"
			aria-label={`Tag ${selectedRow.value}`}
			tabindex="-1"
			onpointerdown={(event) => event.stopPropagation()}
		>
			<header class="drawer-head">
				<div>
					<h3>{selectedRow.value}</h3>
					<p>{selectedRow.open.length} open · {selectedRow.closed.length} closed</p>
				</div>
				<button type="button" class="drawer-close" aria-label="Close drawer" onclick={closeRowDrawer}>
					<X size={14} />
				</button>
			</header>
			<div class="drawer-list">
				{#if selectedRow.open.length === 0}
					<p class="drawer-empty">No open loops in this group.</p>
				{:else}
					{#each selectedRow.open.slice(0, 8) as loop}
						<article class="drawer-item">
							<strong>{loop.title}</strong>
							<div class="drawer-item-meta">
								<span>{loop.priority}</span>
								<span>{loop.energy}</span>
								{#if loop.deadline}<span>due {loop.deadline}</span>{/if}
							</div>
						</article>
					{/each}
				{/if}
			</div>
			<footer class="drawer-foot">
				<a class="open-all" href={hrefForRow(selectedRow.value)}>Open in Loops</a>
			</footer>
		</div>
	</div>
{/if}

{#if filterSheetOpen}
	<div
		class="filter-overlay"
		role="button"
		tabindex="0"
		aria-label="Close tag filters"
		onpointerdown={() => (filterSheetOpen = false)}
		onkeydown={(event) => {
			if (event.key === 'Escape') filterSheetOpen = false;
		}}
	>
		<div
			class="filter-sheet panel"
			role="dialog"
			aria-modal="true"
			aria-label="Tag filters"
			tabindex="-1"
			onpointerdown={(event) => event.stopPropagation()}
		>
			<header class="filter-sheet-head">
				<div>
					<h3>Tag filters</h3>
					<p>Choose how tags are grouped in this view.</p>
				</div>
				<button type="button" class="sheet-close" onclick={() => (filterSheetOpen = false)}>
					<X size={14} />
				</button>
			</header>
			<div class="filter-sheet-list">
				{#each pivotOptions as option}
					<button
						type="button"
						class="sheet-option"
						class:active={pivot === option.slug}
						onclick={() => {
							pivot = option.slug;
							filterSheetOpen = false;
						}}
					>
						<span>{option.label}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.tags-view {
		display: grid;
		gap: 10px;
		min-width: 0;
		overflow-x: hidden;
	}

	.tags-head {
		display: grid;
		gap: 6px;
		position: sticky;
		top: 0;
		padding-top: 2px;
		background: linear-gradient(180deg, color-mix(in srgb, var(--bg) 98%, #fff) 70%, transparent);
		z-index: 12;
		width: min(100%, 40rem);
		margin-inline: auto;
		min-width: 0;
	}

	.tags-head h2 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--text-xl);
	}

	.pivot-rail {
		display: flex;
		gap: 4px;
		overflow-x: auto;
		padding-inline: 2px;
		padding-bottom: 2px;
		scrollbar-width: none;
		-ms-overflow-style: none;
		scroll-behavior: smooth;
	}

	.pivot-rail::-webkit-scrollbar {
		display: none;
	}

	.pivot-rail-wrap {
		position: relative;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		overflow: hidden;
	}

	.pivot-rail-wrap::before,
	.pivot-rail-wrap::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 2px;
		width: 26px;
		pointer-events: none;
		z-index: 2;
		opacity: 0;
		transition: opacity 120ms ease;
	}

	.pivot-rail-wrap.overflowed::before,
	.pivot-rail-wrap.overflowed::after {
		opacity: 1;
	}

	.pivot-rail-wrap::before {
		left: 0;
		background: linear-gradient(90deg, var(--bg), transparent);
	}

	.pivot-rail-wrap::after {
		right: 0;
		background: linear-gradient(270deg, var(--bg), transparent);
	}

	.pivot-chevron {
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

	.pivot-chevron.left {
		left: 0;
	}

	.pivot-chevron.right {
		right: 0;
	}

	.rows {
		display: grid;
		gap: 8px;
		min-width: 0;
		width: 100%;
		overflow-x: hidden;
	}

	.list-wrap {
		width: min(100%, 40rem);
		margin-inline: auto;
		min-width: 0;
		overflow-x: hidden;
	}

	.row {
		text-decoration: none;
		padding: 10px;
		display: grid;
		gap: 6px;
		min-height: 96px;
		min-width: 0;
		width: 100%;
		max-width: 100%;
		transition:
			transform var(--dur-fast) var(--ease),
			box-shadow var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease);
		border: 1px solid var(--border-soft);
		background: var(--surface-1);
		text-align: left;
	}

	.row:active {
		transform: scale(0.988);
	}

	.row-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		min-width: 0;
	}

	.row-title {
		font-family: var(--font-serif);
		font-size: var(--text-md);
		color: var(--text);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row-cta {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--text3);
	}

	.row-meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
	}

	.meta-chip {
		border: 1px solid var(--border-soft);
		background: var(--surface-2);
		border-radius: 999px;
		padding: 1px 8px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text3);
		line-height: 1.6;
	}

	.meta-chip.risk {
		border-color: color-mix(in srgb, var(--red) 22%, transparent);
		background: color-mix(in srgb, var(--red) 8%, transparent);
		color: var(--red);
	}

	.preview {
		display: grid;
		gap: 3px;
		min-width: 0;
	}

	.preview span {
		font-size: var(--text-sm);
		color: var(--text2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.drawer-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.16);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: flex-end;
		z-index: 130;
	}

	.drawer {
		width: min(100%, 40rem);
		margin: 0 auto;
		border-radius: 18px 18px 0 0;
		padding: 10px;
		padding-bottom: calc(10px + var(--safe-bottom));
		display: grid;
		gap: 8px;
	}

	.drawer-head {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 8px;
	}

	.drawer-head h3 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--text-lg);
	}

	.drawer-head p {
		margin: 3px 0 0;
		font-size: var(--text-sm);
		color: var(--text3);
	}

	.drawer-close {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 1px solid var(--border-soft);
		background: var(--surface-2);
		color: var(--text2);
	}

	.drawer-list {
		display: grid;
		gap: 6px;
		max-height: min(52vh, 420px);
		overflow: auto;
	}

	.drawer-item {
		border: 1px solid var(--border-soft);
		background: var(--surface-2);
		border-radius: var(--radius-md);
		padding: 8px;
		display: grid;
		gap: 4px;
	}

	.drawer-item strong {
		font-size: var(--text-md);
		font-family: var(--font-serif);
		font-weight: var(--weight-normal);
	}

	.drawer-item-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}

	.drawer-item-meta span {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text3);
	}

	.drawer-empty {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text3);
		font-style: italic;
	}

	.drawer-foot {
		display: flex;
		justify-content: flex-end;
	}

	.open-all {
		min-height: 38px;
		padding: 0 12px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		color: var(--accent);
		text-decoration: none;
		display: inline-flex;
		align-items: center;
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
		width: min(100%, 40rem);
		margin: 0 auto;
		max-height: min(74vh, 620px);
		border-radius: 18px 18px 0 0;
		border: 1px solid var(--border-soft);
		display: grid;
		grid-template-rows: auto 1fr;
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
		padding: 10px 12px calc(10px + var(--safe-bottom));
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

</style>
