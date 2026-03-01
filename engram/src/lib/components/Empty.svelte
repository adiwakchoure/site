<script lang="ts">
	import type { Component } from 'svelte';

	let {
		label,
		icon = false,
		hint = '',
		action = undefined,
		actionLabel = ''
	}: {
		label: string;
		icon?: boolean;
		hint?: string;
		action?: (() => void) | undefined;
		actionLabel?: string;
	} = $props();
</script>

<div class="empty">
	{#if icon}
		<div class="ghost-icon" aria-hidden="true">○</div>
	{/if}
	<p>{label}</p>
	{#if hint}
		<p class="hint">{hint}</p>
	{/if}
	{#if action && actionLabel}
		<button class="cta" type="button" onclick={action}>{actionLabel}</button>
	{/if}
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
		text-align: center;
	}

	.hint {
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--text4);
		max-width: 240px;
	}

	.cta {
		margin-top: 4px;
		padding: 6px 16px;
		border-radius: 12px;
		border: 1px solid rgba(0, 0, 0, 0.08);
		background: rgba(255, 255, 255, 0.6);
		font-size: 12px;
		color: var(--accent);
		cursor: pointer;
		transition: all 0.15s var(--ease-spring);
	}

	.cta:active {
		transform: scale(0.97);
	}
</style>
