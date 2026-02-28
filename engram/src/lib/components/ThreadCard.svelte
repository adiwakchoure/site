<script lang="ts">
	import { CalendarClock, CircleDashed, CircleDot, CircleSlash } from 'lucide-svelte';
	import type { Loop } from '$types/models';
	import { ageInDays, isOverdue } from '$lib/utils';

	const priorityTone = {
		P0: '#c0453a',
		P1: '#a0714a',
		P2: '#6e63a0'
	} as const;

	let { thread, onResolve }: { thread: Loop; onResolve: (threadId: string) => void } = $props();
</script>

<article class="card" style={`--tone:${priorityTone[thread.priority]};`}>
	<div class="row">
		<h3>{thread.title}</h3>
		<button type="button" class="resolve" onclick={() => onResolve(thread.id)}>Resolve</button>
	</div>
	<div class="meta">
		<span class="badge">{thread.priority}</span>
		<span class="badge">{thread.energy}</span>
		<span class="mono">{ageInDays(thread.createdAt)}d open</span>
		{#if thread.deadline}
			<span class:overdue={isOverdue(thread.deadline, thread.closedAt)} class="mono">
				<CalendarClock size={12} /> {new Date(thread.deadline).toLocaleDateString()}
			</span>
		{/if}
		{#if thread.closedAt}
			<span class="mono"><CircleSlash size={12} /> closed</span>
		{:else}
			<span class="mono">
				{#if isOverdue(thread.deadline, thread.closedAt)}
					<CircleDashed size={12} /> overdue
				{:else}
					<CircleDot size={12} /> open
				{/if}
			</span>
		{/if}
	</div>
</article>

<style>
	.card {
		background: rgba(255, 255, 255, 0.6);
		border: 1px solid rgba(0, 0, 0, 0.06);
		border-left: 4px solid var(--tone);
		border-radius: 12px;
		padding: 0.85rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}
	.row {
		display: flex;
		gap: 0.75rem;
		justify-content: space-between;
		align-items: center;
	}
	h3 {
		font-size: 0.95rem;
		margin: 0;
		font-weight: 500;
	}
	.resolve {
		border: 0;
		background: rgba(160, 113, 74, 0.12);
		color: #6b472d;
		padding: 0.35rem 0.6rem;
		border-radius: 999px;
	}
	.meta {
		margin-top: 0.55rem;
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		align-items: center;
	}
	.badge {
		font-size: 0.7rem;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.06);
	}
	.mono {
		font-family: 'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: #5a5651;
	}
	.overdue {
		color: #c0453a;
	}
</style>
