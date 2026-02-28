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
		border-radius: 8px;
		padding: 5px 11px;
		font-size: 12px;
		font-weight: 300;
		color: var(--text3);
		transition: all 0.2s var(--ease-spring);
	}

	button.active {
		background: rgba(255, 255, 255, 0.7);
		border-color: rgba(0, 0, 0, 0.08);
		box-shadow: var(--shadow-sm);
		font-weight: 400;
		color: var(--text);
	}
</style>
