<script lang="ts">
	import { browser } from '$app/environment';

	let {
		analyser,
		active
	}: {
		analyser: AnalyserNode | null;
		active: boolean;
	} = $props();

	const BAR_COUNT = 24;
	let bars = $state<number[]>(Array.from({ length: BAR_COUNT }, () => 0));
	let rafId: number | null = null;

	function tick() {
		if (!analyser) return;
		const fft = new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(fft);
		const activeBins = Array.from(fft).slice(2, 90);
		const bucket = Math.floor(activeBins.length / BAR_COUNT);
		const next: number[] = [];
		const center = (BAR_COUNT - 1) / 2;
		for (let i = 0; i < BAR_COUNT; i++) {
			const start = i * bucket;
			const chunk = activeBins.slice(start, start + bucket);
			const mean = chunk.reduce((s, v) => s + v, 0) / Math.max(1, chunk.length);
			const normalized = Math.max(0, Math.min(1, mean / 200));
			const edgeDistance = Math.abs(i - center) / center;
			// Keep a softer envelope by tapering energy toward both edges.
			const edgeTaper = 1 - edgeDistance * 0.55;
			next.push(normalized * edgeTaper);
		}
		bars = next;
		rafId = requestAnimationFrame(tick);
	}

	$effect(() => {
		if (!browser) return;
		if (active && analyser) {
			tick();
		} else {
			if (rafId !== null) cancelAnimationFrame(rafId);
			rafId = null;
			bars = Array.from({ length: BAR_COUNT }, () => 0);
		}
		return () => {
			if (rafId !== null) cancelAnimationFrame(rafId);
			rafId = null;
		};
	});
</script>

{#if active}
	<div class="wave-container">
		{#each bars as bar, i (`bar-${i}`)}
			<span
				class="bar"
				style={`height:${4 + bar * 36}px`}
			></span>
		{/each}
	</div>
{/if}

<style>
	.wave-container {
		display: flex;
		align-items: end;
		justify-content: center;
		gap: 2px;
		max-width: 250px;
		width: min(100%, 250px);
		margin: 0 auto;
		height: 40px;
		overflow: hidden;
		animation: waveScaleIn 0.2s var(--ease-spring);
		transform-origin: center;
		-webkit-mask-image: linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%);
		mask-image: linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%);
	}

	.bar {
		width: 3px;
		min-height: 4px;
		max-height: 40px;
		border-radius: 1.5px;
		background: linear-gradient(to top, rgba(160, 113, 74, 0.4), rgba(160, 113, 74, 0.9));
		transition: height 80ms linear;
	}

</style>
