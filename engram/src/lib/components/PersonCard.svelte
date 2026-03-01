<script lang="ts">
	import { fly, fade } from 'svelte/transition';
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
	<div class="stats" aria-label="open loops">
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
		background: var(--surface-1);
		border: 1px solid var(--border-soft);
		border-radius: var(--radius-md);
		padding: 12px;
		box-shadow: var(--shadow-sm);
		transition: all var(--dur-base) var(--ease-spring);
		text-align: left;
	}

	.card.hover {
		background: var(--surface-2);
		border-color: var(--border-strong);
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
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: var(--weight-normal);
		line-height: var(--leading-tight);
		letter-spacing: var(--tracking-tight);
	}

	.title span {
		color: var(--text4);
		font-size: var(--text-sm);
		font-weight: var(--weight-light);
	}

	.stats {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.count {
		font-size: 16px;
		color: var(--accent);
		font-family: var(--font-mono);
	}

	.label {
		font-size: var(--text-xs);
		color: var(--text4);
	}

	.card.hover :global(svg) {
		transform: translateX(2px);
	}

	:global(svg) {
		transition: transform var(--dur-fast) var(--ease);
	}
</style>
