<script lang="ts">
	let {
		label,
		icon = false
	}: {
		label: string;
		icon?: boolean;
	} = $props();
</script>

<div class="empty">
	{#if icon}
		<div class="ghost-icon" aria-hidden="true">○</div>
	{/if}
	<p>{label}</p>
</div>

<style>
	.empty {
		padding: 56px 16px;
		display: grid;
		justify-items: center;
		gap: 8px;
	}

	.ghost-icon {
		font-size: 18px;
		opacity: 0.12;
		color: var(--text3);
	}

	p {
		margin: 0;
		font-family: 'Instrument Serif', 'Times New Roman', serif;
		font-size: 14px;
		font-weight: 300;
		color: var(--text3);
	}
</style>
