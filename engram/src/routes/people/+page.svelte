<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';
	import Empty from '$components/Empty.svelte';
	import LoopCard from '$components/LoopCard.svelte';
	import Badge from '$components/Badge.svelte';
	import PersonCard from '$components/PersonCard.svelte';
	import { loopPeopleStore, loopsStore, peopleStore } from '$stores/app';
	import { ageInDays, isOverdue } from '$lib/utils';
	import type { Loop, Person } from '$types/models';

	const people = $derived(($peopleStore ?? []) as Person[]);
	const loops = $derived(($loopsStore ?? []) as Loop[]);
	const links = $derived($loopPeopleStore ?? []);
	let selectedPersonId = $state<string | null>(null);

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
		return { openCount: open.length, closedCount: closed.length, avgDays, longest, openLoops: open as Loop[], closedLoops: closed as Loop[] };
	}

	const selectedPerson = $derived((people as Person[]).find((person) => person.id === selectedPersonId) ?? null);
</script>

{#if people.length === 0}
	<Empty label="No people yet" icon={true} />
{:else}
	{#if !selectedPerson}
		<section class="list">
			{#each people as person, i (person.id)}
				<div style={`animation-delay:${i * 40}ms`}>
					<PersonCard
						person={person}
						openCount={stats(person.id).openCount}
						overdueCount={stats(person.id).openLoops.filter((loop) => isOverdue(loop.deadline, loop.closedAt)).length}
						onSelect={() => (selectedPersonId = person.id)}
					/>
				</div>
			{/each}
		</section>
	{:else}
		<section class="detail">
			<button class="back" type="button" onclick={() => (selectedPersonId = null)}>
				<ChevronDown size={13} />
				Back
			</button>
			<header>
				<h2>{selectedPerson.name}</h2>
				<p>{selectedPerson.rel || 'contact'}</p>
			</header>
			<div class="stat-grid">
				<article><strong>{stats(selectedPerson.id).openCount}</strong><span>Open</span></article>
				<article><strong>{stats(selectedPerson.id).closedCount}</strong><span>Closed</span></article>
				<article><strong>{stats(selectedPerson.id).avgDays}d</strong><span>Avg</span></article>
				<article><strong>{stats(selectedPerson.id).longest}d</strong><span>Longest</span></article>
			</div>
			<section>
				<h4>Open tasks</h4>
				{#if stats(selectedPerson.id).openLoops.length === 0}
					<p class="empty-inline">No open tasks.</p>
				{:else}
					{#each stats(selectedPerson.id).openLoops as loop (loop.id)}
						<LoopCard loop={loop} onSelect={() => {}} />
					{/each}
				{/if}
			</section>
			<section>
				<h4>Resolved</h4>
				<div class="resolved">
					{#each stats(selectedPerson.id).closedLoops as loop (loop.id)}
						<div class="resolved-item">
							<div>{loop.title}</div>
							<Badge label={loop.closedReason ?? 'closed'} color="#3d8a4a" />
							<small>{ageInDays(loop.createdAt)}d</small>
						</div>
					{/each}
				</div>
			</section>
		</section>
	{/if}
{/if}

<style>
	.list {
		display: grid;
		gap: 6px;
	}

	.detail {
		display: grid;
		gap: 10px;
	}

	.back {
		width: fit-content;
		border: 0;
		background: transparent;
		color: var(--text2);
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
	}

	.back :global(svg) {
		transform: rotate(90deg);
	}

	h2 {
		margin: 0;
		font-family: 'Instrument Serif', 'Times New Roman', serif;
		font-size: 22px;
		font-weight: 400;
	}

	header p {
		margin: 2px 0 0;
		font-size: 11px;
		color: var(--text4);
	}

	.stat-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 6px;
	}

	.stat-grid article {
		padding: 10px;
		border-radius: 12px;
		border: 1px solid rgba(0, 0, 0, 0.05);
		background: rgba(255, 255, 255, 0.5);
		box-shadow: var(--shadow-sm);
		animation: cardIn 0.24s var(--ease-spring);
	}

	.stat-grid strong {
		font-family: 'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 18px;
		font-weight: 300;
	}

	.stat-grid span {
		display: block;
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text3);
	}

	h4 {
		margin: 0 0 8px;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text3);
	}

	.resolved {
		display: grid;
		gap: 6px;
		opacity: 0.4;
	}

	.resolved-item {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		padding: 7px 8px;
		border-radius: 10px;
		transition: all 0.15s var(--ease);
	}

	.resolved-item:hover {
		opacity: 0.7;
		background: rgba(255, 255, 255, 0.4);
	}

	.resolved-item small {
		margin-left: auto;
		font-size: 10px;
		color: var(--text3);
		font-family: 'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.empty-inline {
		margin: 0;
		font-size: 12px;
		color: var(--text3);
	}
</style>
