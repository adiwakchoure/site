<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { RotateCw, X } from 'lucide-svelte';
	import { addUpdate, closeLoop, reopenLoop, updateLoop, updateLoopTags } from '$db/local';
	import type { ClosedReason, LoopEvent, LoopView } from '$types/models';
	import IconBtn from '$components/IconBtn.svelte';
	import Badge from '$components/Badge.svelte';
	import { showToast } from '$stores/toast';

	type OptimisticTimelineEntry = {
		id: string;
		body: string;
		createdAt: string;
		status: 'pending' | 'failed';
	};

	type TimelineRow = {
		id: string;
		kind: LoopEvent['kind'] | 'optimistic_update';
		body: string;
		createdAt: string;
		status?: 'pending' | 'failed';
	};

	let {
		loop,
		events,
		open = false,
		onClose
	}: {
		loop: LoopView | null;
		events: LoopEvent[];
		open: boolean;
		onClose: () => void;
	} = $props();

	let updateText = $state('');
	let descriptionDraft = $state('');
	let descriptionDirty = $state(false);
	let descriptionLoopId = $state<string | null>(null);
	let optimistic = $state<OptimisticTimelineEntry[]>([]);
	let updateInput = $state<HTMLInputElement | null>(null);
	let dragging = $state(false);
	let dragOffset = $state(0);
	let dragStartY = 0;
	let dragStartAt = 0;
	let dragPointerId: number | null = null;
	let closeMenuOpen = $state(false);

	const isOverdue = $derived(loop ? Boolean(loop.deadline && loop.state === 'open' && new Date(loop.deadline).getTime() < Date.now()) : false);
	const timelineRows = $derived.by(() => {
		const persisted: TimelineRow[] = events
			.filter((evt) => !(evt.kind === 'updated' && (evt.body ?? '').startsWith('body ->')))
			.map((evt) => ({
				id: evt.id,
				kind: evt.kind,
				body: evt.body ?? '',
				createdAt: evt.createdAt
			}));
		const temporary: TimelineRow[] = optimistic.map((entry) => ({
			id: entry.id,
			kind: 'optimistic_update',
			body: entry.body,
			createdAt: entry.createdAt,
			status: entry.status
		}));
		return [...persisted, ...temporary].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
	});

	$effect(() => {
		if (!loop) {
			descriptionLoopId = null;
			descriptionDraft = '';
			descriptionDirty = false;
			return;
		}
		if (descriptionLoopId !== loop.id) {
			descriptionLoopId = loop.id;
			descriptionDraft = loop.content ?? '';
			descriptionDirty = false;
		}
	});

	const timelineText = (row: TimelineRow) => {
		if (row.kind === 'created') return 'Loop opened';
		if (row.kind === 'closed') return 'Loop closed';
		if (row.kind === 'reopened') return 'Loop reopened';
		if (row.kind === 'updated') return 'Details updated';
		return row.body || 'Timeline entry';
	};

	const timelineDotClass = (row: TimelineRow) => {
		if (row.status === 'failed') return 'failed';
		if (row.status === 'pending') return 'pending';
		if (row.kind === 'created') return 'opened';
		if (row.kind === 'closed') return 'closed';
		if (row.kind === 'reopened') return 'reopened';
		return 'entry';
	};

	function relativeAge(value: string) {
		const ms = Date.now() - +new Date(value);
		const minute = 60_000;
		const hour = 60 * minute;
		const day = 24 * hour;
		if (ms < hour) {
			const n = Math.max(1, Math.floor(ms / minute));
			return `${n}m ago`;
		}
		if (ms < day) {
			const n = Math.max(1, Math.floor(ms / hour));
			return `${n}h ago`;
		}
		const n = Math.max(1, Math.floor(ms / day));
		return `${n}d ago`;
	}

	function absoluteStamp(value: string) {
		return new Date(value).toLocaleString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function startDrag(event: PointerEvent) {
		if (!browser) return;
		if (event.button !== 0) return;
		dragging = true;
		dragStartY = event.clientY;
		dragStartAt = performance.now();
		dragPointerId = event.pointerId;
		const target = event.currentTarget as HTMLElement | null;
		target?.setPointerCapture?.(event.pointerId);
		window.addEventListener('pointermove', onDragMove);
		window.addEventListener('pointerup', onDragEnd);
		window.addEventListener('pointercancel', onDragEnd);
	}

	function onDragMove(event: PointerEvent) {
		if (!dragging) return;
		dragOffset = Math.max(0, event.clientY - dragStartY);
	}

	function onDragEnd(event: PointerEvent) {
		if (!dragging || (dragPointerId !== null && event.pointerId !== dragPointerId)) return;
		const elapsed = Math.max(1, performance.now() - dragStartAt);
		const velocity = dragOffset / elapsed;
		const shouldClose = dragOffset > 120 || velocity > 0.9;
		dragging = false;
		dragPointerId = null;
		window.removeEventListener('pointermove', onDragMove);
		window.removeEventListener('pointerup', onDragEnd);
		window.removeEventListener('pointercancel', onDragEnd);
		if (shouldClose) {
			dragOffset = 0;
			onClose();
			return;
		}
		dragOffset = 0;
	}

	const overlayAlpha = $derived(Math.max(0.06, 0.2 * (1 - Math.min(dragOffset, 220) / 220)));
	const sheetTransform = $derived(`translateY(${dragOffset}px)`);

	async function submitUpdate() {
		if (!loop || !updateText.trim()) return;
		const body = updateText.trim();
		updateText = '';
		updateInput?.focus();
		const optimisticId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
		const createdAt = new Date().toISOString();
		optimistic = [...optimistic, { id: optimisticId, body, createdAt, status: 'pending' }];
		try {
			await addUpdate(loop.id, body);
			optimistic = optimistic.filter((entry) => entry.id !== optimisticId);
			showToast('Timeline entry saved');
		} catch {
			optimistic = optimistic.map((entry) => (entry.id === optimisticId ? { ...entry, status: 'failed' } : entry));
			showToast('Could not save timeline entry');
		}
	}

	async function retryUpdate(entry: OptimisticTimelineEntry) {
		if (!loop) return;
		optimistic = optimistic.map((row) => (row.id === entry.id ? { ...row, status: 'pending' } : row));
		try {
			await addUpdate(loop.id, entry.body);
			optimistic = optimistic.filter((row) => row.id !== entry.id);
			showToast('Timeline entry saved');
		} catch {
			optimistic = optimistic.map((row) => (row.id === entry.id ? { ...row, status: 'failed' } : row));
			showToast('Retry failed');
		}
	}

	async function saveDescription() {
		if (!loop || !descriptionDirty) return;
		const body = descriptionDraft.trim();
		try {
			await updateLoop(loop.id, { content: body });
			descriptionDirty = false;
			showToast('Description saved');
		} catch {
			showToast('Could not save description');
		}
	}

	async function resolveLoop(reason: ClosedReason = 'done') {
		if (!loop) return;
		try {
			await closeLoop(loop.id, reason);
			showToast(reason === 'done' ? 'Loop closed' : `Loop closed as ${reason}`);
			closeMenuOpen = false;
		} catch {
			showToast('Could not close loop');
		}
	}

	async function reopenCurrentLoop() {
		if (!loop) return;
		try {
			await reopenLoop(loop.id);
			showToast('Loop reopened');
			closeMenuOpen = false;
		} catch {
			showToast('Could not reopen loop');
		}
	}

	async function setDeadlineQuick(value: 'today' | 'tomorrow' | 'clear') {
		if (!loop) return;
		const now = new Date();
		if (value === 'today') {
			await updateLoopTags(loop.id, { deadline: now.toISOString().slice(0, 10) });
			showToast('Deadline set for today');
			return;
		}
		if (value === 'tomorrow') {
			const tomorrow = new Date(now);
			tomorrow.setDate(now.getDate() + 1);
			await updateLoopTags(loop.id, { deadline: tomorrow.toISOString().slice(0, 10) });
			showToast('Deadline set for tomorrow');
			return;
		}
		await updateLoopTags(loop.id, { deadline: null });
		showToast('Deadline cleared');
	}

	async function setEnergyQuick(value: 'active' | 'waiting' | 'someday') {
		if (!loop) return;
		await updateLoopTags(loop.id, { energy: value });
		showToast(`Energy set to ${value}`);
	}

	onDestroy(() => {
		if (!browser) return;
		window.removeEventListener('pointermove', onDragMove);
		window.removeEventListener('pointerup', onDragEnd);
		window.removeEventListener('pointercancel', onDragEnd);
	});
</script>

{#if open && loop}
	<div
		class="overlay"
		role="button"
		tabindex="0"
		aria-label="Close loop details"
		style={`--overlay-alpha:${overlayAlpha};`}
		onpointerdown={onClose}
		onkeydown={(event) => {
			if (event.key === 'Escape') onClose();
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				onClose();
			}
		}}
		transition:fade={{ duration: 180 }}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Loop details"
			tabindex="-1"
			class="sheet"
			class:dragging
			style={`transform:${sheetTransform};`}
			onpointerdown={(event) => event.stopPropagation()}
			in:fly={{ y: 20, duration: 340 }}
			out:fly={{ y: 20, duration: 200 }}
		>
			<div
				class="drag-zone"
				role="button"
				tabindex="0"
				aria-label="Drag to close"
				onpointerdown={startDrag}
				onkeydown={(event) => {
					if (event.key === 'Escape') onClose();
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						onClose();
					}
				}}
			>
				<div class="drag"></div>
			</div>
			<header class="head">
				<div class="head-top">
					<Badge label={loop.priority} color={loop.priority === 'P0' ? '#c0453a' : loop.priority === 'P1' ? '#a0714a' : '#8a857f'} />
					{#if loop.state === 'closed'}
						<Badge label="Closed" color="#3d8a4a" />
					{/if}
					{#if isOverdue}
						<Badge label="Overdue" color="#c0453a" />
					{/if}
					<span class="spacer"></span>
					{#if loop.state === 'open'}
						<div class="close-menu-wrap">
							<button
								class="header-action close-menu-trigger"
								type="button"
								aria-haspopup="menu"
								aria-expanded={closeMenuOpen}
								onclick={() => (closeMenuOpen = !closeMenuOpen)}
							>
								Close as
							</button>
							{#if closeMenuOpen}
								<div class="close-menu panel" role="menu" transition:fade={{ duration: 120 }}>
									<button type="button" role="menuitem" onclick={() => resolveLoop('done')}>Done</button>
									<button type="button" role="menuitem" onclick={() => resolveLoop('delegated')}>Delegated</button>
									<button type="button" role="menuitem" onclick={() => resolveLoop('dropped')}>Dropped</button>
									<button type="button" role="menuitem" onclick={() => resolveLoop('irrelevant')}>Irrelevant</button>
								</div>
							{/if}
						</div>
					{:else}
						<button class="header-action reopen-action" type="button" onclick={reopenCurrentLoop}>Reopen</button>
					{/if}
					<IconBtn title="Close" size={40} onClick={onClose}><X size={14} /></IconBtn>
				</div>
				<h2 class="head-title">{loop.title}</h2>
				<textarea
					class="head-description"
					bind:value={descriptionDraft}
					placeholder="Add a simple description..."
					oninput={() => (descriptionDirty = true)}
					onblur={saveDescription}
					onkeydown={(event) => {
						if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
							event.preventDefault();
							event.stopPropagation();
							saveDescription();
						}
					}}
				></textarea>
				{#if descriptionDirty}
					<p class="description-hint">Unsaved changes</p>
				{/if}
			</header>
			<div class="body">
				<section class="context">
					<div class="meta">
						<p>Opened {new Date(loop.openedAt).toLocaleDateString()}</p>
						{#if loop.deadline}<p>Deadline {new Date(loop.deadline).toLocaleDateString()}</p>{/if}
						{#if loop.closedAt}<p>Closed {new Date(loop.closedAt).toLocaleDateString()} ({loop.closedReason})</p>{/if}
					</div>
					<div class="quick-tag-row">
						<div class="quick-group">
							<span>deadline</span>
							<button type="button" onclick={() => setDeadlineQuick('today')}>today</button>
							<button type="button" onclick={() => setDeadlineQuick('tomorrow')}>tomorrow</button>
							<button type="button" onclick={() => setDeadlineQuick('clear')}>clear</button>
						</div>
						<div class="quick-group">
							<span>energy</span>
							<button type="button" onclick={() => setEnergyQuick('active')}>active</button>
							<button type="button" onclick={() => setEnergyQuick('waiting')}>waiting</button>
							<button type="button" onclick={() => setEnergyQuick('someday')}>someday</button>
						</div>
					</div>
				</section>

				<section class="timeline-section">
					<h4>Loop timeline</h4>
					{#if timelineRows.length === 0}
						<p class="empty">No timeline events yet</p>
					{:else}
						<div class="mini-timeline">
							{#each timelineRows as row (row.id)}
								<div class="timeline-row" class:pending={row.status === 'pending'} class:failed={row.status === 'failed'}>
									<span class={`timeline-dot ${timelineDotClass(row)}`} aria-hidden="true"></span>
									<div class="timeline-content">
										<p>{timelineText(row)}</p>
										<div class="row-meta">
											<span class="info-tag" title={absoluteStamp(row.createdAt)}>{relativeAge(row.createdAt)}</span>
											{#if row.status === 'pending'}
												<span class="info-tag status">syncing</span>
											{/if}
											{#if row.status === 'failed'}
												<button type="button" class="retry" onclick={() => retryUpdate(row as OptimisticTimelineEntry)}>
													<RotateCw size={11} /> retry
												</button>
											{/if}
										</div>
									</div>
								</div>
							{/each}
							{#if loop.state === 'closed'}
								<div class="timeline-end" aria-hidden="true">
									<span class="timeline-dot end"></span>
								</div>
							{/if}
						</div>
					{/if}
					<div class="composer">
						<input
							bind:this={updateInput}
							bind:value={updateText}
							placeholder="Add timeline entry..."
							onkeydown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault();
									event.stopPropagation();
									submitUpdate();
								}
							}}
						/>
					</div>
				</section>
			</div>
			<footer class="sticky-actions">
				{#if loop.state === 'open'}
					<button class="primary-close" type="button" onclick={() => resolveLoop('done')}>Mark done</button>
				{:else}
					<button class="primary-close reopen" type="button" onclick={reopenCurrentLoop}>Reopen loop</button>
				{/if}
			</footer>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, var(--overlay-alpha, 0.2));
		backdrop-filter: blur(8px);
		z-index: 120;
		display: flex;
		align-items: flex-end;
		padding: 0;
	}

	.sheet {
		width: min(100%, 620px);
		margin: 0 auto;
		max-height: 92dvh;
		background: var(--bg);
		border-radius: 20px 20px 0 0;
		box-shadow: var(--shadow-xl);
		display: flex;
		flex-direction: column;
		transition: transform var(--dur-base) var(--ease-spring);
		will-change: transform;
	}

	.sheet.dragging {
		transition: none;
	}

	.drag-zone {
		padding-top: 10px;
		padding-bottom: 4px;
		cursor: grab;
	}

	.drag-zone:active {
		cursor: grabbing;
	}

	.drag {
		width: 36px;
		height: 4px;
		border-radius: 2px;
		background: rgba(0, 0, 0, 0.12);
		margin: 0 auto;
	}

	.head {
		padding: 8px 12px 10px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.04);
		display: grid;
		gap: 8px;
	}

	.head-top {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.spacer {
		flex: 1;
	}

	.header-action {
		min-height: 40px;
		padding: 8px 12px;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.06);
		font-size: 11px;
		font-weight: var(--weight-medium);
		cursor: pointer;
		transition: all 0.15s var(--ease-spring);
	}

	.header-action:active {
		transform: scale(0.96);
	}

	.close-menu-wrap {
		position: relative;
	}

	.close-menu-trigger {
		min-height: 34px;
		padding: 4px 10px;
		border-radius: 999px;
		font-size: 10px;
		letter-spacing: 0.01em;
		background: color-mix(in srgb, var(--surface-2) 88%, #fff);
		border-color: var(--border-soft);
		color: var(--text2);
	}

	.close-menu {
		position: absolute;
		right: 0;
		top: calc(100% + 6px);
		width: 140px;
		padding: 4px;
		display: grid;
		gap: 2px;
		z-index: 8;
	}

	.close-menu button {
		min-height: 34px;
		padding: 0 8px;
		border-radius: 8px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--text2);
		text-align: left;
		font-size: var(--text-sm);
	}

	.close-menu button:active {
		background: color-mix(in srgb, var(--surface-2) 80%, #fff);
	}

	.reopen-action {
		background: rgba(255, 255, 255, 0.7);
		color: var(--text2);
	}

	.head-title {
		margin: 0;
		width: min(100%, 420px);
		justify-self: center;
		font-family: var(--font-serif);
		font-size: clamp(20px, 5vw, 26px);
		font-weight: var(--weight-normal);
		line-height: 1.2;
		letter-spacing: 0;
		text-align: center;
		text-wrap: balance;
		overflow-wrap: anywhere;
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.body {
		padding: 12px;
		overflow: auto;
		display: grid;
		gap: 14px;
	}

	.sticky-actions {
		padding: 10px 12px calc(10px + var(--safe-bottom));
		border-top: 1px solid rgba(0, 0, 0, 0.05);
		background: color-mix(in srgb, var(--bg) 92%, #fff);
	}

	.primary-close {
		width: 100%;
		min-height: 48px;
		border-radius: var(--radius-md);
		border: 1px solid color-mix(in srgb, var(--green) 36%, transparent);
		background: color-mix(in srgb, var(--green) 20%, #fff);
		color: var(--green);
		font-size: var(--text-md);
		font-weight: var(--weight-medium);
	}

	.primary-close.reopen {
		border-color: color-mix(in srgb, var(--accent) 36%, transparent);
		background: color-mix(in srgb, var(--accent) 14%, #fff);
		color: var(--accent);
	}

	.context {
		display: grid;
		gap: 8px;
		padding-bottom: 2px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.04);
	}

	.quick-tag-row {
		display: grid;
		gap: 6px;
	}

	.quick-group {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}

	.quick-group span {
		font-size: var(--text-xs);
		color: var(--text3);
		font-family: var(--font-mono);
		text-transform: uppercase;
	}

	.quick-group button {
		min-height: 32px;
		padding: 5px 8px;
		border-radius: 999px;
		border: 1px solid var(--border-soft);
		background: var(--surface-2);
		color: var(--text2);
		font-size: var(--text-xs);
		font-family: var(--font-mono);
	}

	.timeline-section {
		display: grid;
		gap: 0;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.meta p {
		margin: 0;
		font-size: 11px;
		color: var(--text3);
		font-family: var(--font-mono);
		padding: 3px 7px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.6);
		border: 1px solid rgba(0, 0, 0, 0.04);
	}

	h4 {
		margin: 0 0 8px;
		font-size: 10px;
		letter-spacing: var(--tracking-caps-wide);
		text-transform: uppercase;
		color: var(--text3);
	}

	.timeline-row {
		display: grid;
		grid-template-columns: 16px 1fr;
		column-gap: 10px;
		align-items: start;
		padding: 0;
		animation: rowEnter var(--dur-base) var(--ease-spring);
	}

	.timeline-row.pending {
		opacity: 0.8;
	}

	.timeline-row.failed {
		opacity: 1;
	}

	.mini-timeline {
		position: relative;
		display: grid;
		gap: 0;
		padding-left: 0;
		margin-top: 2px;
	}

	.mini-timeline::before {
		content: '';
		position: absolute;
		left: 7px;
		top: 8px;
		bottom: 8px;
		width: 1px;
		background: rgba(0, 0, 0, 0.12);
	}

	.timeline-dot {
		position: relative;
		top: 8px;
		left: 0;
		margin: 0 auto;
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--accent);
		border: 2px solid color-mix(in srgb, var(--bg) 85%, #fff);
	}

	.timeline-dot.opened {
		background: var(--green);
	}

	.timeline-dot.closed {
		background: var(--text3);
	}

	.timeline-dot.reopened {
		background: var(--accent);
	}

	.timeline-dot.pending {
		background: color-mix(in srgb, var(--accent) 72%, #fff);
	}

	.timeline-dot.failed {
		background: var(--red);
	}

	.timeline-dot.end {
		background: var(--green);
	}

	.timeline-content {
		padding: 0 0 10px;
	}

	.timeline-content p {
		margin: 0 0 3px;
		font-size: 13px;
		font-weight: var(--weight-light);
		line-height: var(--leading-normal);
		color: var(--text);
	}

	.timeline-row:not(:last-of-type) .timeline-content {
		border-bottom: 1px solid rgba(0, 0, 0, 0.05);
		margin-bottom: 8px;
	}

	.timeline-end {
		display: grid;
		grid-template-columns: 16px 1fr;
		column-gap: 10px;
		align-items: center;
		height: 16px;
		margin-top: -2px;
	}

	.timeline-end .timeline-dot.end {
		position: relative;
		top: 0;
		left: 0;
		margin: 0 auto;
	}

	.row-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}

	.info-tag {
		font-size: 10px;
		color: var(--text3);
		font-family: var(--font-mono);
		padding: 1px 5px;
		border-radius: 999px;
		border: 1px solid rgba(0, 0, 0, 0.04);
		background: rgba(255, 255, 255, 0.4);
	}

	.info-tag.status {
		border-color: color-mix(in srgb, var(--amber) 36%, rgba(0, 0, 0, 0.05));
		color: var(--amber);
	}

	.retry {
		border: 0;
		background: rgba(192, 69, 58, 0.08);
		color: var(--red);
		font-size: 10px;
		font-family: var(--font-mono);
		padding: 2px 7px;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		cursor: pointer;
	}

	.composer {
		margin-top: 8px;
	}

	.composer input {
		width: 100%;
		height: 40px;
		border-radius: 12px;
		border: 1px solid rgba(0, 0, 0, 0.05);
		background: rgba(255, 255, 255, 0.75);
		padding: 0 12px;
		font-size: 13px;
		transition:
			border-color var(--dur-fast) var(--ease),
			box-shadow var(--dur-fast) var(--ease);
	}

	.composer input:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--accent) 40%, rgba(0, 0, 0, 0.05));
		box-shadow: var(--ring-accent);
	}

	.head-description {
		width: 100%;
		min-height: 56px;
		max-height: 120px;
		border-radius: 10px;
		border: 1px solid rgba(0, 0, 0, 0.06);
		padding: 8px 10px;
		font-size: 15px;
		font-family: var(--font-serif);
		line-height: 1.35;
		color: var(--text2);
		background: rgba(255, 255, 255, 0.6);
		resize: vertical;
	}

	.head-description:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--accent) 40%, rgba(0, 0, 0, 0.05));
		box-shadow: var(--ring-accent);
		background: rgba(255, 255, 255, 0.78);
	}

	.description-hint {
		margin: 6px 0 0;
		font-size: 11px;
		color: var(--text3);
	}

	.empty {
		margin: 0;
		font-size: 12px;
		font-style: italic;
		color: var(--text3);
	}

	@media (min-width: 1024px) {
		.overlay {
			align-items: center;
			padding: 18px;
		}

		.sheet {
			width: min(100%, 860px);
			max-height: min(86dvh, 780px);
			border-radius: 20px;
		}

		.drag-zone {
			display: none;
		}
	}
</style>
