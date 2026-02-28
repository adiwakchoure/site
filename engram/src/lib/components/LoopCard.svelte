<script lang="ts">
	import { Check, RotateCcw } from 'lucide-svelte';
	import type { Loop } from '$types/models';
	import { ageInDays, isOverdue } from '$lib/utils';
	import Badge from '$components/Badge.svelte';

	let {
		loop,
		ghost = false,
		onSelect,
		onSwipeAction = undefined,
		stagger = 0
	}: {
		loop: Loop;
		ghost?: boolean;
		onSelect: (loopId: string) => void;
		onSwipeAction?: ((loopId: string, action: 'close' | 'reopen') => void) | undefined;
		stagger?: number;
	} = $props();

	let hover = $state(false);
	let press = $state(false);
	let swiping = $state(false);
	let swipeX = $state(0);
	let pointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	let suppressClick = false;
	const overdue = $derived(isOverdue(loop.deadline, loop.closedAt));
	const tone = $derived(loop.priority === 'P0' || overdue ? '#c0453a' : loop.priority === 'P1' ? '#a0714a' : '#8a857f');
	const dueSoon = $derived.by(() => {
		if (!loop.deadline || loop.closedAt || overdue) return false;
		const diff = new Date(loop.deadline).getTime() - Date.now();
		return diff <= 3 * 24 * 60 * 60 * 1000;
	});
	const swipeProgress = $derived(Math.min(1, Math.abs(swipeX) / 96));
	const showCloseAffordance = $derived(loop.state === 'open' && swipeX < 0);
	const showReopenAffordance = $derived(loop.state === 'closed' && swipeX > 0);

	function resetSwipe() {
		swiping = false;
		swipeX = 0;
		pointerId = null;
	}

	function onCardPointerDown(event: PointerEvent) {
		if (ghost || event.button !== 0) return;
		press = true;
		pointerId = event.pointerId;
		startX = event.clientX;
		startY = event.clientY;
		suppressClick = false;
		(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
	}

	function onCardPointerMove(event: PointerEvent) {
		if (pointerId !== event.pointerId) return;
		const dx = event.clientX - startX;
		const dy = event.clientY - startY;
		const horizontalIntent = Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.4;
		if (!swiping && horizontalIntent) {
			swiping = true;
			suppressClick = true;
		}
		if (!swiping) return;
		event.preventDefault();
		const clamp = Math.max(-96, Math.min(96, dx));
		swipeX = clamp;
	}

	function onCardPointerEnd(event: PointerEvent) {
		if (pointerId !== event.pointerId) return;
		press = false;
		if (swiping) {
			const threshold = 62;
			const shouldClose = loop.state === 'open' && swipeX <= -threshold;
			const shouldReopen = loop.state === 'closed' && swipeX >= threshold;
			if (shouldClose || shouldReopen) {
				onSwipeAction?.(loop.id, shouldClose ? 'close' : 'reopen');
			}
		}
		resetSwipe();
	}
</script>

<div
	class="card-shell"
	class:ghost
	class:swiping={!ghost && swiping}
	style={`--tone:${tone}; --swipe-x:${swipeX}px; --stagger:${stagger}ms; --swipe-progress:${swipeProgress};`}
>
	<div
		class="swipe-affordance"
		class:show-close={showCloseAffordance}
		class:show-reopen={showReopenAffordance}
		aria-hidden="true"
	>
		{#if showReopenAffordance}
			<RotateCcw size={15} />
		{:else}
			<Check size={15} />
		{/if}
	</div>
	<button
		type="button"
		class="card"
		class:hover={!ghost && hover}
		class:press={!ghost && press}
		class:swiping={!ghost && swiping}
		onmouseenter={() => (hover = true)}
		onmouseleave={() => {
			hover = false;
			press = false;
			resetSwipe();
		}}
		onpointerdown={onCardPointerDown}
		onpointermove={onCardPointerMove}
		onpointerup={onCardPointerEnd}
		onpointercancel={onCardPointerEnd}
		onlostpointercapture={onCardPointerEnd}
		onclick={() => {
			if (!ghost && !suppressClick) onSelect(loop.id);
			suppressClick = false;
		}}
		disabled={ghost}
		aria-label={loop.title}
	>
		<div class="main">
			<p class="title" class:closed={loop.state === 'closed'}>{loop.title}</p>
			{#if !ghost}
				<div class="meta">
					<Badge label={loop.priority} color={loop.priority === 'P0' ? '#c0453a' : loop.priority === 'P1' ? '#a0714a' : '#8a857f'} />
					<Badge label={loop.energy} color="#6e63a0" />
					{#if overdue}<Badge label="over" color="#c0453a" />{/if}
					{#if dueSoon}<Badge label={`due ${new Date(loop.deadline as string).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`} color="#a07c28" />{/if}
				</div>
			{/if}
		</div>
		{#if !ghost}
			<div class="age" class:overdue-age={overdue}>{ageInDays(loop.createdAt)}d</div>
		{/if}
	</button>
</div>

<style>
	.card-shell {
		position: relative;
		margin-bottom: 8px;
		border-radius: 12px;
	}

	.card {
		width: 100%;
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 10px;
		align-items: start;
		padding: 12px 14px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.5);
		border: 1px solid rgba(0, 0, 0, 0.05);
		box-shadow: var(--shadow-sm);
		transition: all var(--dur-base) var(--ease-spring);
		animation: cardIn 0.24s var(--ease-spring);
		animation-delay: var(--stagger, 0ms);
		text-align: left;
		position: relative;
		overflow: hidden;
		z-index: 2;
		--lift-y: 0px;
		--scale: 1;
		transform: translateX(var(--swipe-x, 0px)) translateY(var(--lift-y)) scale(var(--scale));
		touch-action: pan-y;
	}

	.card::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 22px;
		background: linear-gradient(90deg, color-mix(in srgb, var(--tone) 30%, transparent) 0%, transparent 100%);
		opacity: 0.45;
		pointer-events: none;
		transition: opacity var(--dur-fast) var(--ease);
	}

	.card::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tone) 10%, transparent);
		opacity: 0.55;
		pointer-events: none;
		transition: opacity var(--dur-fast) var(--ease);
	}

	.swipe-affordance {
		position: absolute;
		top: 6px;
		bottom: 6px;
		right: 8px;
		width: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 10px;
		background: color-mix(in srgb, var(--red) 16%, transparent);
		color: var(--red);
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--dur-fast) var(--ease);
	}

	.swipe-affordance.show-reopen {
		left: 8px;
		right: auto;
		background: color-mix(in srgb, var(--green) 16%, transparent);
		color: var(--green);
	}

	.main {
		min-width: 0;
	}

	.title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 15px;
		font-weight: var(--weight-normal);
		line-height: var(--leading-tight);
		letter-spacing: var(--tracking-tight);
		color: var(--text);
	}

	.title.closed {
		text-decoration: line-through;
		color: color-mix(in srgb, var(--text4) 40%, transparent);
	}

	.meta {
		margin-top: 6px;
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
		align-items: center;
	}

	.age {
		font-size: 11px;
		font-family: var(--font-mono);
		color: var(--text3);
	}

	.overdue-age {
		color: var(--red);
	}

	.card.hover {
		background: rgba(255, 255, 255, 0.8);
		border-color: rgba(0, 0, 0, 0.08);
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.03);
		--lift-y: -1px;
		--scale: 1.003;
	}

	.card.hover::before,
	.card.press::before {
		opacity: 0.75;
	}

	.card.hover::after,
	.card.press::after {
		opacity: 1;
	}

	.card.press {
		background: rgba(255, 255, 255, 0.8);
		border-color: rgba(0, 0, 0, 0.08);
		box-shadow: var(--shadow-sm);
		--lift-y: 0px;
		--scale: 0.988;
	}

	.card.swiping {
		transition: transform var(--dur-fast) var(--ease);
	}

	.card-shell.swiping .swipe-affordance {
		opacity: max(0.12, var(--swipe-progress));
	}

	.card-shell.ghost .card {
		opacity: 0.25;
		border-color: rgba(0, 0, 0, 0.03);
	}

	.card-shell.ghost .card::before {
		opacity: 0.2;
	}

	.card:focus-visible {
		outline: none;
		box-shadow:
			var(--shadow-md),
			0 0 0 2px color-mix(in srgb, var(--tone) 22%, transparent);
	}
</style>
