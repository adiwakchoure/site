<script lang="ts">
	let {
		lines = 3
	}: {
		lines?: number;
	} = $props();
</script>

<div class="skeleton-wrap">
	{#each Array(lines) as _, i}
		<div class="bone" style={`--w:${70 + (i % 3) * 15}%; animation-delay:${i * 80}ms`}></div>
	{/each}
</div>

<style>
	.skeleton-wrap {
		display: grid;
		gap: 10px;
		padding: 16px 0;
	}

	.bone {
		height: 14px;
		width: var(--w, 80%);
		border-radius: 6px;
		background: linear-gradient(90deg, rgba(0, 0, 0, 0.04) 25%, rgba(0, 0, 0, 0.07) 50%, rgba(0, 0, 0, 0.04) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.6s ease-in-out infinite;
	}
</style>
