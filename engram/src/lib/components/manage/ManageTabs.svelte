<script lang="ts">
	let {
		tabs,
		active,
		onChange
	}: {
		tabs: Array<{ id: string; label: string }>;
		active: string;
		onChange: (id: string) => void;
	} = $props();
</script>

<nav class="manage-tabs" aria-label="Management sections">
	{#each tabs as tab}
		<button
			type="button"
			class="tab"
			class:active={tab.id === active}
			onclick={() => onChange(tab.id)}
		>
			{tab.label}
		</button>
	{/each}
</nav>

<style>
	.manage-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 4px;
		border-radius: var(--radius-md);
		background: rgba(0, 0, 0, 0.03);
		border: 1px solid var(--border-soft);
	}

	.tab {
		border: 1px solid transparent;
		background: transparent;
		color: var(--text3);
		border-radius: 10px;
		padding: 8px 12px;
		min-height: 40px;
		font-size: var(--text-sm);
		transition:
			background var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease);
	}

	.tab.active {
		background: var(--surface-3);
		border-color: var(--border-soft);
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}
</style>
