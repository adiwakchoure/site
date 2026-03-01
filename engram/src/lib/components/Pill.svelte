<script lang="ts">
	let {
		label,
		active = false,
		onClick
	}: {
		label: string;
		active?: boolean;
		onClick: () => void;
	} = $props();
</script>

<button type="button" class:active onclick={onClick}>{label}</button>

<style>
	button {
		border: 1px solid transparent;
		background: transparent;
		border-radius: var(--radius-sm);
		min-height: 40px;
		padding: 8px 12px;
		font-size: var(--text-sm);
		font-weight: var(--weight-light);
		color: var(--text3);
		transition: all 0.2s var(--ease-spring);
	}

	button.active {
		background: var(--surface-2);
		border-color: var(--border-strong);
		box-shadow: var(--shadow-sm);
		font-weight: var(--weight-normal);
		color: var(--text);
	}

	button:focus-visible {
		outline: none;
		box-shadow: var(--ring-accent);
	}
</style>
