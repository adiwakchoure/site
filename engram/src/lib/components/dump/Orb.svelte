<script lang="ts">
	let {
		mode
	}: {
		mode: 'resting' | 'text' | 'voice' | 'processing' | 'suggestions' | 'quickcreate';
	} = $props();
</script>

{#if mode === 'processing'}
	<span class="orb-dots" aria-hidden="true">
		<span class="dot" style="animation-delay:0ms"></span>
		<span class="dot" style="animation-delay:150ms"></span>
		<span class="dot" style="animation-delay:300ms"></span>
	</span>
{:else}
	<span
		class="orb"
		class:voice={mode === 'voice'}
		class:dim={mode === 'text'}
		aria-hidden="true"
	></span>
{/if}

<style>
	.orb {
		display: block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		opacity: 0.6;
		pointer-events: none;
		flex-shrink: 0;
		animation: orbPulse 3s ease-in-out infinite;
		transition:
			width 0.2s var(--ease-spring),
			height 0.2s var(--ease-spring),
			opacity 0.2s var(--ease-spring),
			box-shadow 0.2s var(--ease-spring);
	}

	.orb.dim {
		opacity: 0.3;
		animation: none;
	}

	.orb.voice {
		width: 10px;
		height: 10px;
		opacity: 0.85;
		animation: orbPulse 1.5s ease-in-out infinite;
		box-shadow: 0 0 10px rgba(160, 113, 74, 0.4);
	}

	.orb-dots {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		pointer-events: none;
		flex-shrink: 0;
	}

	.dot {
		display: block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
		opacity: 0.7;
		animation: orbBounce 0.6s ease-in-out infinite;
	}
</style>
