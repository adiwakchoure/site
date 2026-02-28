<script lang="ts">
	import type { Loop, Person } from '$types/models';

	let { person, threads }: { person: Person; threads: Loop[] } = $props();

	const openCount = $derived(threads.filter((thread) => !thread.closedAt).length);
	const overdueCount = $derived(
		threads.filter(
		(thread) => !thread.closedAt && thread.deadline && new Date(thread.deadline).getTime() < Date.now()
		).length
	);
</script>

<article class="card">
	<div class="title">
		<h3>{person.name}</h3>
		<span>{person.rel || 'contact'}</span>
	</div>
	<div class="stats">
		<span>{openCount} open</span>
		<span class:danger={overdueCount > 0}>{overdueCount} overdue</span>
	</div>
</article>

<style>
	.card {
		background: rgba(255, 255, 255, 0.65);
		border: 1px solid rgba(0, 0, 0, 0.06);
		border-radius: 12px;
		padding: 0.8rem;
	}
	.title {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
	}
	h3 {
		margin: 0;
		font-size: 0.95rem;
	}
	.title span {
		color: #8a857f;
		font-size: 0.75rem;
	}
	.stats {
		margin-top: 0.6rem;
		display: flex;
		gap: 0.5rem;
		font-size: 0.78rem;
		color: #5a5651;
	}
	.danger {
		color: #c0453a;
	}
</style>
