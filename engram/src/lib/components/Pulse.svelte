<script lang="ts">
	import type { Loop } from '$types/models';

	let {
		loops,
		height = 300,
		onScrub
	}: {
		loops: Loop[];
		height?: number;
		onScrub: (value: { date: Date; active: number; overdue: number } | null) => void;
	} = $props();

	let host: HTMLDivElement | null = null;
	let dragging = $state(false);
	let scrubY = $state(0);
	const width = 44;
	const innerWidth = 38;

	const series = $derived.by(() => {
		const dates = [...new Set(loops.map((loop) => new Date(loop.createdAt).toISOString()))]
			.sort((a, b) => +new Date(a) - +new Date(b))
			.map((iso) => new Date(iso));
		const base = dates.length > 0 ? dates : [new Date()];
		return base.map((date) => {
			const at = +date;
			const active = loops.filter((loop) => {
				const created = new Date(loop.createdAt).getTime();
				const closed = loop.closedAt ? new Date(loop.closedAt).getTime() : Number.POSITIVE_INFINITY;
				return created <= at && closed > at;
			}).length;
			const overdue = loops.filter((loop) => {
				if (!loop.deadline) return false;
				const deadline = new Date(loop.deadline).getTime();
				const created = new Date(loop.createdAt).getTime();
				const closed = loop.closedAt ? new Date(loop.closedAt).getTime() : Number.POSITIVE_INFINITY;
				return created <= at && closed > at && deadline < at;
			}).length;
			return { date, active, overdue };
		});
	});
	const pointsCount = $derived(series.length);

	const maxVal = $derived(Math.max(1, ...series.map((entry) => entry.active)));
	const activePath = $derived.by(() =>
		series
			.map((entry, i) => {
				const y = (i / Math.max(1, pointsCount - 1)) * height;
				const x = Math.min(innerWidth, Math.max(0, (entry.active / maxVal) * innerWidth));
				return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
			})
			.join(' ')
	);
	const areaPath = $derived(`${activePath} L 0 ${height} L 0 0 Z`);

	const overduePath = $derived.by(() =>
		series
			.map((entry, i) => {
				const y = (i / Math.max(1, pointsCount - 1)) * height;
				const x = Math.min(innerWidth, Math.max(0, (entry.overdue / maxVal) * innerWidth));
				return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
			})
			.join(' ')
	);
	const overdueArea = $derived(`${overduePath} L 0 ${height} L 0 0 Z`);

	const pointAtScrub = $derived.by(() => {
		const ratio = Math.min(1, Math.max(0, scrubY / height));
		const idx = Math.min(pointsCount - 1, Math.max(0, Math.round(ratio * Math.max(1, pointsCount - 1))));
		return { idx, ...series[idx] };
	});

	function yToLocal(y: number) {
		if (!host) return 0;
		const rect = host.getBoundingClientRect();
		return Math.min(height, Math.max(0, y - rect.top));
	}

	function start(event: PointerEvent) {
		dragging = true;
		(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
		scrubY = yToLocal(event.clientY);
		onScrub({ date: pointAtScrub.date, active: pointAtScrub.active, overdue: pointAtScrub.overdue });
	}

	function move(event: PointerEvent) {
		if (!dragging) return;
		scrubY = yToLocal(event.clientY);
		onScrub({ date: pointAtScrub.date, active: pointAtScrub.active, overdue: pointAtScrub.overdue });
	}

	function end() {
		if (!dragging) return;
		dragging = false;
		onScrub(null);
	}

	function onKeydown(event: KeyboardEvent) {
		const step = 12;
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			dragging = true;
			scrubY = Math.max(0, scrubY - step);
			onScrub({ date: pointAtScrub.date, active: pointAtScrub.active, overdue: pointAtScrub.overdue });
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			dragging = true;
			scrubY = Math.min(height, scrubY + step);
			onScrub({ date: pointAtScrub.date, active: pointAtScrub.active, overdue: pointAtScrub.overdue });
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			end();
		}
	}
</script>

<div
	class="pulse"
	role="slider"
	aria-label="Pulse timeline"
	aria-valuemin="0"
	aria-valuemax={height}
	aria-valuenow={Math.round(scrubY)}
	tabindex="0"
	bind:this={host}
	style={`height:${height}px;`}
	onpointerdown={start}
	onpointermove={move}
	onpointerup={end}
	onpointercancel={end}
	onlostpointercapture={end}
	onkeydown={onKeydown}
>
	<svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-label="Pulse chart">
		<defs>
			<linearGradient id="af" x1="0" y1="0" x2="1" y2="0">
				<stop offset="0%" stop-color="rgba(160,113,74,0.02)" />
				<stop offset="100%" stop-color="rgba(160,113,74,0.15)" />
			</linearGradient>
			<linearGradient id="of" x1="0" y1="0" x2="1" y2="0">
				<stop offset="0%" stop-color="rgba(192,69,58,0.02)" />
				<stop offset="100%" stop-color="rgba(192,69,58,0.18)" />
			</linearGradient>
		</defs>
		<linearGradient id="sf" x1="0" y1="0" x2="1" y2="0">
			<stop offset="0%" stop-color="rgba(110,99,160,0.02)" />
			<stop offset="100%" stop-color="rgba(110,99,160,0.2)" />
		</linearGradient>
		<line x1="0.5" y1="0" x2="0.5" y2={height} stroke="rgba(0,0,0,0.16)" stroke-width="0.5" />
		<path d={areaPath} fill="url(#af)" opacity={dragging ? 0.25 : 1} />
		<path d={overdueArea} fill="url(#of)" opacity={dragging ? 0.2 : 1} />
		<path d={activePath} fill="none" stroke="#a0714a" stroke-width="0.9" opacity={dragging ? 0.22 : 0.42} />
		{#if dragging}
			<clipPath id="scrubWindow">
				<rect x="0" y={Math.max(0, scrubY - 30)} width={width} height="60" rx="6" />
			</clipPath>
			<path d={areaPath} fill="url(#sf)" clip-path="url(#scrubWindow)" opacity="0.75" />
		{/if}
		<circle cx="2.5" cy={height - 4} r="2.3" fill="#a0714a" opacity="0.46" />
		<circle class="pulse-ring" cx="2.5" cy={height - 4} r="5" fill="rgba(160,113,74,0.08)" />
		{#if dragging}
			<line x1="0" y1={scrubY} x2={width} y2={scrubY} stroke="#6e63a0" stroke-width="1.2" opacity="0.7" />
			<circle cx={Math.min(innerWidth, Math.max(0, (pointAtScrub.active / maxVal) * innerWidth))} cy={scrubY} r="3.5" fill="none" stroke="#6e63a0" />
			<circle cx={Math.min(innerWidth, Math.max(0, (pointAtScrub.active / maxVal) * innerWidth))} cy={scrubY} r="1.5" fill="#6e63a0" />
		{/if}
	</svg>
	{#if dragging}
		<div class="tooltip" style={`top:${Math.min(height - 10, Math.max(10, scrubY))}px`}>
			<div>{pointAtScrub.date.toLocaleDateString()}</div>
			<strong>{pointAtScrub.active}</strong>
			{#if pointAtScrub.overdue > 0}
				<span>{pointAtScrub.overdue} overdue</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.pulse {
		position: relative;
		width: 52px;
		min-height: 44px;
		cursor: ns-resize;
		touch-action: none;
		user-select: none;
	}

	.pulse-ring {
		animation: playhead-pulse 2s ease-in-out infinite;
		transform-origin: center;
	}

	.tooltip {
		position: absolute;
		right: calc(100% + 8px);
		transform: translateY(-50%);
		background: rgba(26, 26, 26, 0.9);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.06);
		box-shadow: var(--shadow-lg);
		border-radius: 10px;
		padding: 6px 8px;
		animation: fadeIn 0.1s var(--ease);
		pointer-events: none;
		z-index: 3;
		max-width: 160px;
	}

	.tooltip div,
	.tooltip span {
		font-size: 9px;
		color: #f2f0ed;
		font-family: var(--font-mono);
		white-space: nowrap;
	}

	.tooltip strong {
		display: block;
		font-family: var(--font-serif);
		font-size: 20px;
		color: #a0714a;
		font-weight: 400;
		line-height: 1;
	}

	.tooltip span {
		color: #c0453a;
	}

	@media (min-width: 1024px) {
		.pulse {
			width: 62px;
		}

		.tooltip {
			right: calc(100% + 12px);
		}
	}
</style>
