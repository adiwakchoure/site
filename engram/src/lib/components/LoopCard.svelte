<script lang="ts">
	import type { Loop } from '$types/models';
	import { ageInDays, isOverdue } from '$lib/utils';
	import Badge from '$components/Badge.svelte';

	let {
		loop,
		ghost = false,
		onSelect
	}: {
		loop: Loop;
		ghost?: boolean;
		onSelect: (loopId: string) => void;
	} = $props();

	let hover = $state(false);
	let press = $state(false);
	const overdue = $derived(isOverdue(loop.deadline, loop.closedAt));
	const tone = $derived(loop.priority === 'P0' || overdue ? '#c0453a' : loop.priority === 'P1' ? '#a0714a' : '#8a857f');
	const dueSoon = $derived.by(() => {
		if (!loop.deadline || loop.closedAt || overdue) return false;
		const diff = new Date(loop.deadline).getTime() - Date.now();
		return diff <= 3 * 24 * 60 * 60 * 1000;
	});
</script>

<button
	type="button"
	class="card"
	class:ghost
	class:hover={!ghost && hover}
	class:press={!ghost && press}
	style={`--tone:${tone};`}
	onmouseenter={() => (hover = true)}
	onmouseleave={() => {
		hover = false;
		press = false;
	}}
	onpointerdown={() => (press = true)}
	onpointerup={() => (press = false)}
	onclick={() => !ghost && onSelect(loop.id)}
	disabled={ghost}
>
	<div class="left"></div>
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

<style>
	.card {
		width: 100%;
		display: grid;
		grid-template-columns: 3px 1fr auto;
		gap: 10px;
		align-items: start;
		margin-bottom: 6px;
		padding: 12px 14px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.45);
		border: 1px solid rgba(0, 0, 0, 0.05);
		box-shadow: var(--shadow-sm);
		transition: all 0.2s var(--ease-spring);
		animation: cardIn 0.24s var(--ease-spring);
		text-align: left;
	}

	.left {
		width: 3px;
		height: 100%;
		border-radius: 99px;
		background: color-mix(in srgb, var(--tone) 40%, transparent);
		transition: background 0.2s var(--ease);
	}

	.main {
		min-width: 0;
	}

	.title {
		margin: 0;
		font-size: 13.5px;
		font-weight: 400;
		line-height: 1.3;
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
		font-family: 'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
		color: var(--text3);
	}

	.overdue-age {
		color: var(--red);
	}

	.card.hover {
		background: rgba(255, 255, 255, 0.8);
		border-color: rgba(0, 0, 0, 0.08);
		box-shadow: var(--shadow-md);
		transform: translateY(-1px);
	}

	.card.hover .left,
	.card.press .left {
		background: color-mix(in srgb, var(--tone) 70%, transparent);
	}

	.card.press {
		background: rgba(255, 255, 255, 0.8);
		border-color: rgba(0, 0, 0, 0.08);
		box-shadow: var(--shadow-sm);
		transform: scale(0.99);
	}

	.card.ghost {
		opacity: 0.25;
		border-color: rgba(0, 0, 0, 0.03);
		pointer-events: none;
	}

	.card.ghost .left {
		background: color-mix(in srgb, var(--tone) 20%, transparent);
	}
</style>
