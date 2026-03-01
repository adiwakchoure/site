<script lang="ts">
	let {
		onEdit,
		onArchive,
		onDelete,
		archived = false,
		canArchive = true
	}: {
		onEdit?: () => void;
		onArchive?: () => void;
		onDelete?: () => void;
		archived?: boolean;
		canArchive?: boolean;
	} = $props();
</script>

<div class="actions">
	{#if onEdit}
		<button type="button" class="action-btn" onclick={onEdit}>Edit</button>
	{/if}
	{#if canArchive && onArchive}
		<button type="button" class="action-btn" onclick={onArchive}>{archived ? 'Unarchive' : 'Archive'}</button>
	{/if}
	{#if onDelete}
		<button type="button" class="action-btn danger" onclick={onDelete}>Delete</button>
	{/if}
</div>

<style>
	.actions {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 6px;
		justify-content: flex-end;
	}

	.action-btn {
		min-height: 34px;
		border-radius: 8px;
		border: 1px solid var(--border-soft);
		background: var(--surface-2);
		color: var(--text2);
		padding: 6px 10px;
		font-size: var(--text-sm);
	}

	.action-btn.danger {
		color: var(--red);
		border-color: color-mix(in srgb, var(--red) 26%, var(--border-soft));
	}
</style>
