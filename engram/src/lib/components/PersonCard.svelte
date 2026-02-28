<script lang="ts">
	import { ChevronRight } from 'lucide-svelte';
	import type { Person } from '$types/models';

	let {
		person,
		openCount,
		overdueCount,
		onSelect
	}: {
		person: Person;
		openCount: number;
		overdueCount: number;
		onSelect: () => void;
	} = $props();

	let hover = $state(false);
	let press = $state(false);
</script>

<button
	type="button"
	class="card"
	class:hover
	class:press
	onclick={onSelect}
	onmouseenter={() => (hover = true)}
	onmouseleave={() => {
		hover = false;
		press = false;
	}}
	onpointerdown={() => (press = true)}
	onpointerup={() => (press = false)}
>
	<div class="title">
		<div>
			<h3>{person.name}</h3>
			<span>{person.rel || 'contact'}</span>
		</div>
		{#if overdueCount > 0}
			<i></i>
		{/if}
	</div>
	<div class="stats" aria-label="open tasks">
		<div class="count">{openCount}</div>
		<div class="label">open</div>
		<ChevronRight size={14} />
	</div>
</button>

<style>
	.card {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: rgba(255, 255, 255, 0.4);
		border: 1px solid rgba(0, 0, 0, 0.06);
		border-radius: 12px;
		padding: 10px 12px;
		box-shadow: var(--shadow-sm);
		transition: all 0.2s var(--ease-spring);
		animation: cardIn 0.26s var(--ease-spring);
		text-align: left;
	}

	.card.hover {
		background: rgba(255, 255, 255, 0.8);
		border-color: rgba(0, 0, 0, 0.08);
		box-shadow: var(--shadow-md);
		transform: translateY(-1px);
	}

	.card.press {
		box-shadow: var(--shadow-sm);
		transform: scale(0.99);
	}

	.title {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	i {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: var(--red);
		display: inline-block;
	}

	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 400;
	}

	.title span {
		color: var(--text4);
		font-size: 11px;
		font-weight: 300;
	}

	.stats {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.count {
		font-size: 16px;
		color: var(--accent);
		font-family: 'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.label {
		font-size: 10px;
		color: var(--text4);
	}

	.card.hover :global(svg) {
		transform: translateX(2px);
	}

	:global(svg) {
		transition: transform 0.15s var(--ease);
	}
</style>
