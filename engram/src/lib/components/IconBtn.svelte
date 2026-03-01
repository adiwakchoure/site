<script lang="ts">
	let {
		title,
		active = false,
		size = 40,
		accent = 'var(--accent)',
		disabled = false,
		children,
		onClick
	}: {
		title: string;
		active?: boolean;
		size?: number;
		accent?: string;
		disabled?: boolean;
		children?: import('svelte').Snippet;
		onClick?: () => void;
	} = $props();

	let hover = $state(false);
	let press = $state(false);
</script>

<button
	type="button"
	aria-label={title}
	title={title}
	class="icon-btn"
	class:active
	class:hover={hover}
	class:press={press}
	disabled={disabled}
	style={`--btn-size:${size}px;--btn-accent:${accent};`}
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
	{/if}
</button>

<style>
	.icon-btn {
		width: var(--btn-size);
		height: var(--btn-size);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 10px;
		border: 1px solid rgba(0, 0, 0, 0.06);
		background: transparent;
		color: var(--text4);
		transition: all 0.15s var(--ease-spring);
	}

	.icon-btn.hover {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.08);
		color: var(--text3);
		transform: translateY(-0.5px);
		box-shadow: var(--shadow-sm);
	}

	.icon-btn.press {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.08);
		color: var(--text3);
		transform: scale(0.93);
		box-shadow: none;
	}

	.icon-btn.active {
		background: color-mix(in srgb, var(--btn-accent) 12%, transparent);
		border-color: color-mix(in srgb, var(--btn-accent) 25%, transparent);
		color: var(--btn-accent);
		box-shadow: none;
		transform: none;
	}

	.icon-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.icon-btn:focus-visible {
		outline: none;
		box-shadow: var(--ring-accent);
	}
</style>
