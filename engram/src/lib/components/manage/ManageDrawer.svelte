<script lang="ts">
	let {
		open = false,
		title,
		onClose,
		children
	}: {
		open: boolean;
		title: string;
		onClose: () => void;
		children?: import('svelte').Snippet;
	} = $props();
</script>

{#if open}
	<div class="overlay" role="button" tabindex="0" aria-label="Close panel" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()}>
		<div class="drawer panel" role="dialog" aria-modal="true" aria-label={title} tabindex="-1" onpointerdown={(e) => e.stopPropagation()}>
			<header class="drawer-head">
				<h3>{title}</h3>
				<button type="button" class="close-btn" onclick={onClose}>Close</button>
			</header>
			<div class="drawer-body">
				{#if children}
					{@render children()}
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.2);
		backdrop-filter: blur(6px);
		z-index: 220;
		display: flex;
		align-items: flex-end;
		justify-content: stretch;
	}

	.drawer {
		width: 100%;
		border-radius: 18px 18px 0 0;
		max-height: 88dvh;
		display: grid;
		grid-template-rows: auto 1fr;
	}

	.drawer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 12px 14px;
		border-bottom: 1px solid var(--border-soft);
	}

	h3 {
		margin: 0;
		font-size: var(--text-lg);
		font-family: var(--font-serif);
		font-weight: var(--weight-normal);
	}

	.close-btn {
		min-height: 40px;
		border: 1px solid var(--border-soft);
		background: var(--surface-2);
		color: var(--text2);
		border-radius: 10px;
		padding: 8px 12px;
		font-size: var(--text-sm);
	}

	.drawer-body {
		padding: 12px 14px 16px;
		overflow: auto;
	}

	@media (min-width: 1024px) {
		.overlay {
			align-items: stretch;
			justify-content: flex-end;
		}

		.drawer {
			width: min(440px, 92vw);
			height: 100dvh;
			max-height: none;
			border-radius: 0;
		}
	}
</style>
