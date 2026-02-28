<script lang="ts">
	import LoopCard from '$components/LoopCard.svelte';
	import { addNote, closeLoop, createLoop, reopenLoop, updateLoop } from '$db/local';
	import { activeFilter, eventsStore, loopSort, loopsStore, peopleStore, projectsStore } from '$stores/app';
	import { isOverdue } from '$lib/utils';
	import type { Loop } from '$types/models';
	import { page } from '$app/stores';

	const filters: Array<{ key: 'open' | 'overdue' | 'all'; label: string }> = [
		{ key: 'open', label: 'Open' },
		{ key: 'overdue', label: 'Overdue' },
		{ key: 'all', label: 'All' }
	];

	let selectedLoopId = $state<string | null>(null);
	let showManual = $derived($page.url.searchParams.get('manual') === '1');
	let manual = $state({
		title: '',
		priority: 'P1' as 'P0' | 'P1' | 'P2',
		energy: 'active' as 'active' | 'waiting' | 'someday',
		deadline: '',
		projectId: '',
		tags: ''
	});
	let noteText = $state('');

	const filteredLoops = $derived((($loopsStore ?? []) as Loop[]).filter((loop) => {
		if ($activeFilter === 'open') return loop.state === 'open';
		if ($activeFilter === 'overdue') return loop.state === 'open' && isOverdue(loop.deadline, loop.closedAt);
		return true;
	}));

	const sorted = $derived([...filteredLoops].sort((a, b) => {
		if ($loopSort === 'priority') return a.priority.localeCompare(b.priority);
		if ($loopSort === 'deadline') return (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');
		return +new Date(b.updatedAt) - +new Date(a.updatedAt);
	}));

	const selected = $derived(sorted.find((loop) => loop.id === selectedLoopId) ?? null);
	const selectedEvents = $derived((($eventsStore ?? []) as Array<{ loopId: string | null; body: string | null; kind: string; createdAt: string }>).filter(
		(evt) => evt.loopId === selectedLoopId
	));

	async function submitManual() {
		if (!manual.title.trim()) return;
		await createLoop({
			title: manual.title.trim(),
			priority: manual.priority,
			energy: manual.energy,
			deadline: manual.deadline || null,
			projectId: manual.projectId || null,
			tags: manual.tags
				.split(',')
				.map((v) => v.trim())
				.filter(Boolean)
		});
		manual = { title: '', priority: 'P1', energy: 'active', deadline: '', projectId: '', tags: '' };
	}
</script>

<section class="bar">
	<div class="filters">
		{#each filters as filter}
			<button type="button" class:active={$activeFilter === filter.key} onclick={() => activeFilter.set(filter.key)}>{filter.label}</button>
		{/each}
	</div>
	<div class="sorts">
		<button type="button" onclick={() => loopSort.set('age')}>age</button>
		<button type="button" onclick={() => loopSort.set('priority')}>priority</button>
		<button type="button" onclick={() => loopSort.set('deadline')}>deadline</button>
	</div>
</section>

{#if showManual}
	<section class="manual">
		<input bind:value={manual.title} placeholder="Loop title" />
		<div class="grid">
			<select bind:value={manual.priority}>
				<option value="P0">P0</option>
				<option value="P1">P1</option>
				<option value="P2">P2</option>
			</select>
			<select bind:value={manual.energy}>
				<option value="active">active</option>
				<option value="waiting">waiting</option>
				<option value="someday">someday</option>
			</select>
		</div>
		<input bind:value={manual.deadline} type="date" />
		<select bind:value={manual.projectId}>
			<option value="">No project</option>
			{#each ($projectsStore ?? []) as project}
				<option value={project.id}>{project.name}</option>
			{/each}
		</select>
		<input bind:value={manual.tags} placeholder="tags,comma,separated" />
		<button type="button" class="cta" onclick={submitManual}>Create loop</button>
	</section>
{/if}

<section class="layout">
	<div class="list">
		{#if sorted.length === 0}
			<p class="empty">No loops in this filter.</p>
		{:else}
			{#each sorted as loop (loop.id)}
				<LoopCard loop={loop} onClose={(id) => closeLoop(id, 'done')} onSelect={(id) => (selectedLoopId = id)} />
			{/each}
		{/if}
	</div>
	<div class="pulse">
		<div class="pulse-title">Pulse</div>
		{#each sorted.slice(0, 24) as loop}
			<div class="pulse-row" style={`--h:${Math.min(96, 16 + (loop.state === 'open' ? 48 : 18))}%`}></div>
		{/each}
	</div>
</section>

{#if selected}
	<section class="detail">
		<div class="detail-head">
			<input value={selected.title} onblur={(e) => updateLoop(selected.id, { title: (e.currentTarget as HTMLInputElement).value })} />
			{#if selected.state === 'open'}
				<button type="button" onclick={() => closeLoop(selected.id, 'done')}>Resolve</button>
			{:else}
				<button type="button" onclick={() => reopenLoop(selected.id)}>Reopen</button>
			{/if}
		</div>
		<div class="notes">
			{#each selectedEvents as evt}
				<div class="evt">
					<strong>{evt.kind}</strong>
					<span>{evt.body ?? ''}</span>
				</div>
			{/each}
		</div>
		<div class="note-add">
			<input bind:value={noteText} placeholder="Add note..." />
			<button
				type="button"
				onclick={async () => {
					if (!noteText.trim()) return;
					await addNote(selected.id, noteText.trim());
					noteText = '';
				}}
			>
				Add note
			</button>
		</div>
	</section>
{/if}

<style>
	.bar {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.filters,
	.sorts {
		display: flex;
		gap: 0.4rem;
	}
	button {
		border: 0;
		border-radius: 999px;
		padding: 0.28rem 0.55rem;
		background: rgba(0, 0, 0, 0.06);
	}
	button.active,
	.cta {
		background: rgba(160, 113, 74, 0.2);
		color: #6b472d;
	}
	.layout {
		display: grid;
		grid-template-columns: 1fr 48px;
		gap: 0.6rem;
	}
	.list {
		display: grid;
		gap: 0.55rem;
	}
	.pulse {
		background: rgba(255, 255, 255, 0.65);
		border-radius: 12px;
		padding: 0.4rem;
		display: grid;
		gap: 0.2rem;
		align-content: end;
	}
	.pulse-title {
		font-size: 0.6rem;
		color: #8a857f;
		text-transform: uppercase;
	}
	.pulse-row {
		height: 8px;
		background: linear-gradient(180deg, rgba(110, 99, 160, 0.7), rgba(160, 113, 74, 0.6));
		border-radius: 999px;
		transform-origin: bottom;
		transform: scaleY(calc(var(--h) / 100));
	}
	.manual,
	.detail {
		background: rgba(255, 255, 255, 0.72);
		border: 1px solid rgba(0, 0, 0, 0.06);
		border-radius: 12px;
		padding: 0.65rem;
		display: grid;
		gap: 0.45rem;
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
	}
	input,
	select {
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 8px;
		padding: 0.45rem;
		background: rgba(255, 255, 255, 0.85);
	}
	.detail-head {
		display: flex;
		gap: 0.5rem;
	}
	.detail-head input {
		flex: 1;
	}
	.evt {
		font-size: 0.8rem;
		display: grid;
		gap: 0.15rem;
		padding: 0.35rem 0;
		border-bottom: 1px solid rgba(0, 0, 0, 0.05);
	}
	.note-add {
		display: flex;
		gap: 0.4rem;
	}
	.note-add input {
		flex: 1;
	}
</style>
