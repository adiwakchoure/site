<script lang="ts">
	let {
		title,
		color = 'var(--accent)',
		disabled = false,
		children,
		onClick
	}: {
		title: string;
		color?: string;
		disabled?: boolean;
		children?: import('svelte').Snippet;
		onClick?: () => void;
	} = $props();

	let hover = $state(false);
	let press = $state(false);
</script>

<button
	type="button"
	class="action-btn"
	class:hover={hover}
	class:press={press}
	disabled={disabled}
	style={`--btn:${color};`}
	onclick={onClick}
	onmouseenter={() => (hover = true)}
	onmouseleave={() => {
		hover = false;
		press = false;
	}}
	onpointerdown={() => (press = true)}
	onpointerup={() => (press = false)}
>
	{#if children}
		{@render children()}
	{:else}
		{title}
	{/if}
</button>

<style>
	.action-btn {
		border: 0;
		min-height: 40px;
		padding: 8px 14px;
		border-radius: var(--radius-sm);
		background: var(--btn);
		color: #fff;
		font-size: var(--text-sm);
		font-weight: var(--weight-normal);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--btn) 20%, transparent);
		transition: all 0.2s var(--ease-spring);
	}

	.action-btn.hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 14px color-mix(in srgb, var(--btn) 30%, transparent);
	}

	.action-btn.press {
		transform: scale(0.96);
		box-shadow: 0 1px 3px color-mix(in srgb, var(--btn) 30%, transparent);
	}

	.action-btn:disabled {
		background: var(--surface);
		color: var(--text3);
		box-shadow: none;
		transform: none;
		cursor: not-allowed;
	}

	.action-btn:focus-visible {
		outline: none;
		box-shadow: var(--ring-accent);
	}
</style>
