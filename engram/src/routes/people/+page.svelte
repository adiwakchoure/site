<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';
	import Empty from '$components/Empty.svelte';
	import Skeleton from '$components/Skeleton.svelte';
	import LoopCard from '$components/LoopCard.svelte';
	import Badge from '$components/Badge.svelte';
	import PersonCard from '$components/PersonCard.svelte';
	import StatCard from '$components/StatCard.svelte';
	import SectionHeader from '$components/SectionHeader.svelte';
	import { loopPeopleStore, loopsStore, peopleStore } from '$stores/app';
	import { ageInDays, isOverdue } from '$lib/utils';
	import type { Loop, Person } from '$types/models';

	const people = $derived(($peopleStore ?? []) as Person[]);
	const loops = $derived(($loopsStore ?? []) as Loop[]);
	const links = $derived($loopPeopleStore ?? []);
	let selectedPersonId = $state<string | null>(null);

	const statsMap = $derived.by(() => {
		const map = new Map<string, { openCount: number; closedCount: number; avgDays: number; longest: number; openLoops: Loop[]; closedLoops: Loop[] }>();
		const loopById = new Map(loops.map((l) => [l.id, l]));
		const personLoopIds = new Map<string, string[]>();
		for (const link of links) {
			const arr = personLoopIds.get(link.personId) ?? [];
			arr.push(link.loopId);
			personLoopIds.set(link.personId, arr);
		}
		for (const person of people) {
			const ids = personLoopIds.get(person.id) ?? [];
			const personLoops = ids.map((id) => loopById.get(id)).filter(Boolean) as Loop[];
			const open = personLoops.filter((l) => l.state === 'open');
			const closed = personLoops.filter((l) => l.state === 'closed');
			const avgDays = closed.length
				? Math.round(
						closed.reduce((sum, l) => sum + (+new Date(l.closedAt ?? l.updatedAt) - +new Date(l.createdAt)), 0) /
							closed.length /
							(1000 * 60 * 60 * 24)
					)
				: 0;
			const longest = open.length
				? Math.max(...open.map((l) => Math.floor((Date.now() - +new Date(l.createdAt)) / (1000 * 60 * 60 * 24))))
				: 0;
			map.set(person.id, { openCount: open.length, closedCount: closed.length, avgDays, longest, openLoops: open, closedLoops: closed });
		}
		return map;
	});

	function getStats(personId: string) {
		return statsMap.get(personId) ?? { openCount: 0, closedCount: 0, avgDays: 0, longest: 0, openLoops: [], closedLoops: [] };
	}

	const selectedPerson = $derived((people as Person[]).find((person) => person.id === selectedPersonId) ?? null);
	const selectedStats = $derived(selectedPerson ? getStats(selectedPerson.id) : null);
	const loading = $derived($peopleStore === null);
</script>

{#if loading}
	<Skeleton lines={4} />
{:else if people.length === 0}
	<Empty label="No people yet" icon={true} hint="People are added when you mention them in a dump" />
{:else}
	{#if !selectedPerson}
		<section class="list">
			{#each people as person, i (person.id)}
				<div style={`animation-delay:${i * 40}ms`}>
					<PersonCard
						person={person}
						openCount={getStats(person.id).openCount}
						overdueCount={getStats(person.id).openLoops.filter((loop) => isOverdue(loop.deadline, loop.closedAt)).length}
						onSelect={() => (selectedPersonId = person.id)}
					/>
				</div>
			{/each}
		</section>
	{:else if selectedStats}
		<section class="detail">
			<button class="back" type="button" onclick={() => (selectedPersonId = null)}>
				<ArrowLeft size={13} />
				Back
			</button>
			<header>
				<h2>{selectedPerson.name}</h2>
				<p>{selectedPerson.rel || 'contact'}</p>
			</header>
			<div class="stat-grid">
				<StatCard label="Open" value={selectedStats.openCount} color="var(--accent)" />
				<StatCard label="Closed" value={selectedStats.closedCount} color="var(--green)" />
				<StatCard label="Avg" value="{selectedStats.avgDays}d" color="var(--purple)" />
				<StatCard label="Longest" value="{selectedStats.longest}d" color="var(--red)" />
			</div>
			<section>
				<SectionHeader label="Open loops" />
				{#if selectedStats.openLoops.length === 0}
					<p class="empty-inline">No open loops.</p>
				{:else}
					{#each selectedStats.openLoops as loop (loop.id)}
						<LoopCard loop={loop} onSelect={() => {}} />
					{/each}
				{/if}
			</section>
			<section>
				<SectionHeader label="Resolved" />
				<div class="resolved">
					{#each selectedStats.closedLoops as loop (loop.id)}
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
		gap: 8px;
	}

	.detail {
		display: grid;
		gap: 12px;
		max-width: 920px;
		margin: 0 auto;
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

	h2 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--text-2xl);
		font-weight: var(--weight-normal);
		letter-spacing: var(--tracking-tight);
	}

	header p {
		margin: 2px 0 0;
		font-size: 11px;
		color: var(--text4);
	}

	.stat-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}

	.resolved {
		display: grid;
		gap: 8px;
		opacity: 0.4;
	}

	.resolved-item {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
		font-size: 13px;
		padding: 8px 10px;
		border-radius: 12px;
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
		font-family: var(--font-mono);
	}

	.empty-inline {
		margin: 0;
		font-size: 12px;
		color: var(--text3);
	}

	@media (min-width: 768px) {
		.list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 10px;
		}

		.stat-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	@media (min-width: 1024px) {
		.detail {
			gap: 14px;
		}
	}
</style>
