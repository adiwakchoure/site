<script lang="ts">
	import type { SuggestedAction } from '$types/models';

	let {
		item,
		onAccept,
		onDismiss
	}: {
		item: SuggestedAction;
		onAccept: (item: SuggestedAction) => void;
		onDismiss: (item: SuggestedAction) => void;
	} = $props();

	const label = $derived(
		item.action === 'open_loop'
			? 'Open'
			: item.action === 'close_loop'
				? `Close${item.reason ? ` - ${item.reason}` : ''}`
				: item.action === 'add_note'
					? 'Note'
					: item.action === 'update_loop'
						? 'Update'
						: item.action === 'create_person'
							? 'New person'
							: 'New project'
	);
</script>

<article class="suggestion">
	<div class="row">
		<strong>{label}</strong>
		<small>{item.confidence ?? 'medium'}</small>
	</div>
	<p>{item.title ?? item.text ?? item.name ?? 'Untitled suggestion'}</p>
	{#if item.people?.length}
		<div class="chips">
			{#each item.people as person}
				<span>{person.name}</span>
			{/each}
		</div>
	{/if}
	<div class="actions">
		<button type="button" onclick={() => onDismiss(item)}>Dismiss</button>
		<button type="button" class="accept" onclick={() => onAccept(item)}>Accept</button>
	</div>
</article>

<style>
	.suggestion {
		background: rgba(255, 255, 255, 0.75);
		border: 1px solid rgba(0, 0, 0, 0.05);
		border-radius: 12px;
		padding: 0.75rem;
		transition:
			transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1),
			background 220ms ease;
		animation: cardIn 260ms cubic-bezier(0.16, 1, 0.3, 1);
	}
	.suggestion:hover {
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
		background: rgba(255, 255, 255, 0.88);
	}
	.row {
		display: flex;
		justify-content: space-between;
		font-size: 0.73rem;
		color: #8a857f;
	}
	p {
		margin: 0.45rem 0 0.7rem;
		font-size: 0.9rem;
	}
	.chips {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
		margin-bottom: 0.55rem;
	}
	.chips span {
		font-size: 0.72rem;
		padding: 0.14rem 0.45rem;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.06);
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}
	button {
		border: 0;
		padding: 0.3rem 0.55rem;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.06);
	}
	.accept {
		background: rgba(61, 138, 74, 0.18);
		color: #25592e;
	}
	@keyframes cardIn {
		from {
			opacity: 0;
			transform: translateY(5px) scale(0.985);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
</style>
