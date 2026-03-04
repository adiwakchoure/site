<script lang="ts">
	import { loopViewsStore } from '$stores/app';
	import Skeleton from '$components/Skeleton.svelte';
	import Empty from '$components/Empty.svelte';
	import LoopCard from '$components/LoopCard.svelte';
	import type { LoopView } from '$types/models';

	const loops = $derived(($loopViewsStore ?? []) as LoopView[]);

	const peopleRows = $derived.by(() => {
		const byPerson = new Map<string, LoopView[]>();
		for (const loop of loops) {
			for (const person of loop.people) {
				const list = byPerson.get(person) ?? [];
				list.push(loop);
				byPerson.set(person, list);
			}
		}
		return [...byPerson.entries()]
			.map(([name, related]) => ({
				name,
				open: related.filter((loop) => loop.state === 'open'),
				closed: related.filter((loop) => loop.state === 'closed')
			}))
			.sort((a, b) => b.open.length - a.open.length || a.name.localeCompare(b.name));
	});

	const loading = $derived($loopViewsStore === null);
</script>

{#if loading}
	<Skeleton lines={6} />
{:else if peopleRows.length === 0}
	<Empty label="No people tags yet" icon={true} hint="Mention people in dumps to build this view." />
{:else}
	<section class="people">
		{#each peopleRows as row}
			<article class="person-card">
				<header>
					<h3>{row.name}</h3>
					<small>{row.open.length} open / {row.closed.length} closed</small>
				</header>
				<div class="loop-list">
					{#each row.open.slice(0, 3) as loop (loop.id)}
						<LoopCard loop={loop} onSelect={() => {}} />
					{/each}
				</div>
			</article>
		{/each}
	</section>
{/if}

<style>
	.people {
		display: grid;
		gap: 10px;
	}
	.person-card {
		border: 1px solid var(--border-soft);
		background: var(--surface-1);
		border-radius: 12px;
		padding: 10px;
	}
	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 8px;
	}
	h3 {
		margin: 0;
		font-size: var(--text-md);
		font-weight: 500;
	}
	small {
		color: var(--text3);
		font-family: var(--font-mono);
	}
	.loop-list {
		display: grid;
	}
</style>
