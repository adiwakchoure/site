<script lang="ts">
	import type { Loop } from '$types/models';
	import { ageInDays, isOverdue } from '$lib/utils';

	let { loop, onClose, onSelect }: { loop: Loop; onClose: (loopId: string) => void; onSelect: (loopId: string) => void } = $props();
</script>

<article class="card" style={`--tone:${loop.priority === 'P0' ? '#c0453a' : loop.priority === 'P1' ? '#a0714a' : '#6e63a0'}`}>
	<div class="row">
		<button type="button" class="title" onclick={() => onSelect(loop.id)}>{loop.title}</button>
		{#if loop.state === 'open'}
			<button type="button" class="resolve" onclick={() => onClose(loop.id)}>Resolve</button>
		{/if}
	</div>
	<div class="meta">
		<span class="badge">{loop.priority}</span>
		<span class="badge">{loop.energy}</span>
		<span class="mono">{ageInDays(loop.createdAt)}d</span>
		{#if isOverdue(loop.deadline, loop.closedAt)}
			<span class="mono overdue">overdue</span>
		{/if}
	</div>
</article>

<style>
	.card {
		background: rgba(255, 255, 255, 0.68);
		border: 1px solid rgba(0, 0, 0, 0.05);
		border-left: 4px solid var(--tone);
		border-radius: 12px;
		padding: 0.75rem;
	}
	.row {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.title {
		border: 0;
		background: transparent;
		padding: 0;
		font: inherit;
		text-align: left;
	}
	.resolve {
		border: 0;
		background: rgba(160, 113, 74, 0.14);
		color: #6b472d;
		padding: 0.3rem 0.55rem;
		border-radius: 999px;
	}
	.meta {
		margin-top: 0.5rem;
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}
	.badge {
		font-size: 0.7rem;
		padding: 0.14rem 0.45rem;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.06);
	}
	.mono {
		font-size: 0.72rem;
		font-family: 'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
		color: #5a5651;
	}
	.overdue {
		color: #c0453a;
	}
</style>
