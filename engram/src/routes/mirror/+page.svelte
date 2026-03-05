<script lang="ts">
	import { loopViewsStore } from '$stores/app';
	import Skeleton from '$components/Skeleton.svelte';
	import Empty from '$components/Empty.svelte';
	import type { LoopView } from '$types/models';

	type DecisionCard = {
		label: string;
		value: number;
		note: string;
		href: string;
		tone: 'risk' | 'focus' | 'waiting' | 'win';
	};

	const loops = $derived(($loopViewsStore ?? []) as LoopView[]);
	const openLoops = $derived(loops.filter((loop) => loop.state === 'open'));
	const overdue = $derived(openLoops.filter((loop) => loop.deadline && +new Date(loop.deadline) < Date.now()));
	const stale = $derived(openLoops.filter((loop) => Date.now() - +new Date(loop.updatedAt) > 7 * 24 * 60 * 60 * 1000));
	const waiting = $derived(openLoops.filter((loop) => loop.energy === 'waiting'));
	const quickWins = $derived(openLoops.filter((loop) => loop.priority !== 'P0' && !loop.deadline).slice(0, 5));
	const highPriority = $derived(openLoops.filter((loop) => loop.priority === 'P0' || loop.priority === 'P1'));
	const loading = $derived($loopViewsStore === null);

	const cards = $derived<DecisionCard[]>([
		{
			label: 'Overdue now',
			value: overdue.length,
			note: 'Close or replan due commitments.',
			href: '/loops?filter=overdue&sort=deadline',
			tone: 'risk'
		},
		{
			label: 'Stale > 7 days',
			value: stale.length,
			note: 'Either close or redefine the next step.',
			href: '/loops?filter=open&sort=age',
			tone: 'focus'
		},
		{
			label: 'Waiting loops',
			value: waiting.length,
			note: 'Nudge people and unblock flow.',
			href: '/loops?filter=open&sort=priority',
			tone: 'waiting'
		},
		{
			label: 'Quick wins',
			value: quickWins.length,
			note: 'Clear easy loops to build momentum.',
			href: '/loops?filter=open&sort=age',
			tone: 'win'
		},
		{
			label: 'High priority',
			value: highPriority.length,
			note: 'Protect focus on high-leverage loops.',
			href: '/loops?filter=open&sort=priority',
			tone: 'focus'
		}
	]);
</script>

{#if loading}
	<Skeleton lines={6} />
{:else if openLoops.length === 0}
	<Empty label="No open loops yet" icon={true} hint="Capture one loop and return here for decision shortcuts." />
{:else}
	<section class="review">
		<header class="review-head">
			<h2>Decision Board</h2>
			<p>Pick one lane and move loops to closed state now.</p>
		</header>

		<div class="decision-grid">
			{#each cards as card}
				<a class={`decision-card ${card.tone}`} href={card.href}>
					<div class="card-top">
						<span>{card.label}</span>
						<strong>{card.value}</strong>
					</div>
					<p>{card.note}</p>
					<small>Open filtered loops</small>
				</a>
			{/each}
		</div>
	</section>
{/if}

<style>
	.review {
		display: grid;
		gap: 12px;
	}

	.review-head {
		padding: 12px;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-soft);
		background: var(--surface-1);
	}

	.review-head h2 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--text-xl);
	}

	.review-head p {
		margin: 6px 0 0;
		color: var(--text2);
	}

	.decision-grid {
		display: grid;
		gap: 8px;
		grid-template-columns: 1fr;
	}

	.decision-card {
		text-decoration: none;
		border: 1px solid var(--border-soft);
		background: var(--surface-1);
		border-radius: var(--radius-md);
		padding: 12px;
		display: grid;
		gap: 6px;
		min-height: 110px;
		box-shadow: var(--shadow-sm);
		transition: transform var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
	}

	.decision-card:active {
		transform: scale(0.985);
	}

	.card-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}

	.card-top span {
		font-size: var(--text-sm);
		font-family: var(--font-mono);
		color: var(--text2);
	}

	.card-top strong {
		font-family: var(--font-serif);
		font-size: 28px;
		color: var(--text);
		line-height: 1;
	}

	.decision-card p {
		margin: 0;
		font-size: var(--text-md);
		color: var(--text2);
	}

	.decision-card small {
		font-size: var(--text-xs);
		font-family: var(--font-mono);
		color: var(--text3);
	}

	.decision-card.risk {
		border-left: 3px solid var(--red);
	}

	.decision-card.focus {
		border-left: 3px solid var(--accent);
	}

	.decision-card.waiting {
		border-left: 3px solid var(--purple);
	}

	.decision-card.win {
		border-left: 3px solid var(--green);
	}

	@media (min-width: 768px) {
		.decision-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
