<script lang="ts">
	let {
		label,
		color = '#8a857f',
		onClick
	}: {
		label: string;
		color?: string;
		onClick?: (() => void) | undefined;
	} = $props();
</script>

{#if onClick}
	<button type="button" class="bd as-button" style={`--bd:${color}`} onclick={onClick}>
		{label}
	</button>
{:else}
	<span class="bd" style={`--bd:${color}`}>{label}</span>
{/if}

<style>
	.bd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 3px;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		font-size: var(--text-xs);
		font-weight: 400;
		letter-spacing: 0.01em;
		background: color-mix(in srgb, var(--bd) 6%, transparent);
		border: 1px solid color-mix(in srgb, var(--bd) 10%, var(--border-soft));
		color: var(--bd);
		transition: all 0.15s var(--ease);
	}

	.as-button {
		cursor: pointer;
	}
</style>
