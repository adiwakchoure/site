<script lang="ts">
	import { loopPeopleStore, loopsStore, peopleStore } from '$stores/app';

	$: people = $peopleStore ?? [];
	$: loops = $loopsStore ?? [];
	$: links = $loopPeopleStore ?? [];

	function stats(personId: string) {
		const loopIds = links.filter((link) => link.personId === personId).map((link) => link.loopId);
		const personLoops = loops.filter((loop) => loopIds.includes(loop.id));
		const open = personLoops.filter((loop) => loop.state === 'open');
		const closed = personLoops.filter((loop) => loop.state === 'closed');
		const avgDays = closed.length
			? Math.round(
					closed.reduce((sum, loop) => sum + (+new Date(loop.closedAt ?? loop.updatedAt) - +new Date(loop.createdAt)), 0) /
						closed.length /
						(1000 * 60 * 60 * 24)
				)
			: 0;
		const longest = open.length
			? Math.max(...open.map((loop) => Math.floor((Date.now() - +new Date(loop.createdAt)) / (1000 * 60 * 60 * 24))))
			: 0;
		return { openCount: open.length, closedCount: closed.length, avgDays, longest, openLoops: open, closedLoops: closed };
	}
</script>

{#if people.length === 0}
	<p class="empty">No people yet.</p>
{:else}
	<section class="list">
		{#each people as person (person.id)}
			<article class="person">
				<h3>{person.name}</h3>
				<p>{person.rel || 'contact'}</p>
				<div class="stat-grid">
					<span>open {stats(person.id).openCount}</span>
					<span>closed {stats(person.id).closedCount}</span>
					<span>avg {stats(person.id).avgDays}d</span>
					<span>longest {stats(person.id).longest}d</span>
				</div>
				<div class="loops">
					{#each stats(person.id).openLoops as loop}
						<div class="loop">{loop.title}</div>
					{/each}
				</div>
			</article>
		{/each}
	</section>
{/if}

<style>
	.list {
		display: grid;
		gap: 0.6rem;
	}
	.person {
		background: rgba(255, 255, 255, 0.68);
		border: 1px solid rgba(0, 0, 0, 0.06);
		border-radius: 12px;
		padding: 0.75rem;
	}
	h3 {
		margin: 0;
	}
	p {
		margin: 0.18rem 0 0.5rem;
		color: #8a857f;
		font-size: 0.8rem;
	}
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.35rem;
		font-size: 0.74rem;
		margin-bottom: 0.45rem;
	}
	.stat-grid span {
		background: rgba(0, 0, 0, 0.05);
		padding: 0.2rem 0.35rem;
		border-radius: 8px;
	}
	.loops {
		display: grid;
		gap: 0.22rem;
	}
	.loop {
		font-size: 0.8rem;
	}
	.empty {
		color: #8a857f;
		font-size: 0.9rem;
	}
</style>
