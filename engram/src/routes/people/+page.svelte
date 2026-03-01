<script lang="ts">
	import { ArrowLeft, Plus, Pencil, Trash2, Check, X } from 'lucide-svelte';
	import Empty from '$components/Empty.svelte';
	import Skeleton from '$components/Skeleton.svelte';
	import LoopCard from '$components/LoopCard.svelte';
	import Badge from '$components/Badge.svelte';
	import PersonCard from '$components/PersonCard.svelte';
	import StatCard from '$components/StatCard.svelte';
	import SectionHeader from '$components/SectionHeader.svelte';
	import { loopPeopleStore, loopsStore, peopleStore } from '$stores/app';
	import { putPerson, updatePerson, deletePerson } from '$db/local';
	import { showToast } from '$stores/toast';
	import { ageInDays, isOverdue } from '$lib/utils';
	import type { Loop, Person } from '$types/models';

	const people = $derived(($peopleStore ?? []) as Person[]);
	const loops = $derived(($loopsStore ?? []) as Loop[]);
	const links = $derived($loopPeopleStore ?? []);
	let selectedPersonId = $state<string | null>(null);

	// Add person form
	let showAddForm = $state(false);
	let newName = $state('');
	let newRel = $state('');

	// Inline edit
	let editingPersonId = $state<string | null>(null);
	let editName = $state('');
	let editRel = $state('');

	// Delete confirm
	let confirmDeleteId = $state<string | null>(null);

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

	async function addPerson() {
		if (!newName.trim()) return;
		try {
			await putPerson({ name: newName.trim(), rel: newRel.trim() || 'contact' });
			newName = '';
			newRel = '';
			showAddForm = false;
			showToast('Person added');
		} catch {
			showToast('Could not add person');
		}
	}

	function startEdit(person: Person) {
		editingPersonId = person.id;
		editName = person.name;
		editRel = person.rel;
	}

	async function saveEdit() {
		if (!editingPersonId || !editName.trim()) {
			editingPersonId = null;
			return;
		}
		try {
			await updatePerson(editingPersonId, { name: editName.trim(), rel: editRel.trim() });
			editingPersonId = null;
			showToast('Person updated');
		} catch {
			showToast('Could not update person');
		}
	}

	async function confirmDelete(personId: string) {
		try {
			await deletePerson(personId);
			confirmDeleteId = null;
			if (selectedPersonId === personId) selectedPersonId = null;
			showToast('Person deleted');
		} catch {
			showToast('Could not delete person');
		}
	}
</script>

{#if loading}
	<Skeleton lines={4} />
{:else}
	{#if !selectedPerson}
		<section class="list">
			{#if people.length === 0 && !showAddForm}
				<Empty label="No people yet" icon={true} hint="Add someone manually or mention them in a dump" />
			{/if}
			{#each people as person, i (person.id)}
				<div class="person-row" style={`animation-delay:${i * 40}ms`}>
					{#if editingPersonId === person.id}
						<div class="edit-row">
							<input class="edit-input" bind:value={editName} placeholder="Name" autofocus
								onkeydown={(event) => {
									if (event.key === 'Enter') saveEdit();
									if (event.key === 'Escape') { editingPersonId = null; }
								}}
							/>
							<input class="edit-input small" bind:value={editRel} placeholder="Relationship"
								onkeydown={(event) => {
									if (event.key === 'Enter') saveEdit();
									if (event.key === 'Escape') { editingPersonId = null; }
								}}
							/>
							<button type="button" class="icon-action save" onclick={saveEdit}><Check size={13} /></button>
							<button type="button" class="icon-action" onclick={() => (editingPersonId = null)}><X size={13} /></button>
						</div>
					{:else if confirmDeleteId === person.id}
						<div class="confirm-row">
							<span class="confirm-text">Delete {person.name}?</span>
							<button type="button" class="confirm-btn danger" onclick={() => confirmDelete(person.id)}>Delete</button>
							<button type="button" class="confirm-btn" onclick={() => (confirmDeleteId = null)}>Cancel</button>
						</div>
					{:else}
						<PersonCard
							person={person}
							openCount={getStats(person.id).openCount}
							overdueCount={getStats(person.id).openLoops.filter((loop) => isOverdue(loop.deadline, loop.closedAt)).length}
							onSelect={() => (selectedPersonId = person.id)}
						/>
						<div class="row-actions">
							<button type="button" class="icon-action" onclick={() => startEdit(person)} aria-label="Edit"><Pencil size={12} /></button>
							<button type="button" class="icon-action danger" onclick={() => (confirmDeleteId = person.id)} aria-label="Delete"><Trash2 size={12} /></button>
						</div>
					{/if}
				</div>
			{/each}
			{#if showAddForm}
				<div class="add-form">
					<input class="add-input" bind:value={newName} placeholder="Name" autofocus
						onkeydown={(event) => {
							if (event.key === 'Enter') addPerson();
							if (event.key === 'Escape') { showAddForm = false; newName = ''; newRel = ''; }
						}}
					/>
					<input class="add-input small" bind:value={newRel} placeholder="Relationship (e.g. colleague)"
						onkeydown={(event) => {
							if (event.key === 'Enter') addPerson();
							if (event.key === 'Escape') { showAddForm = false; newName = ''; newRel = ''; }
						}}
					/>
					<div class="add-form-actions">
						<button type="button" class="form-btn primary" onclick={addPerson}>Add</button>
						<button type="button" class="form-btn" onclick={() => { showAddForm = false; newName = ''; newRel = ''; }}>Cancel</button>
					</div>
				</div>
			{/if}
			<button type="button" class="add-person-btn" onclick={() => (showAddForm = !showAddForm)}>
				<Plus size={13} />
				{showAddForm ? 'Cancel' : 'Add person'}
			</button>
		</section>
	{:else if selectedStats}
		<section class="detail">
			<div class="detail-top">
				<button class="back" type="button" onclick={() => (selectedPersonId = null)}>
					<ArrowLeft size={13} />
					Back
				</button>
				<div class="detail-actions">
					<button type="button" class="icon-action" onclick={() => startEdit(selectedPerson)} aria-label="Edit"><Pencil size={12} /></button>
					<button type="button" class="icon-action danger" onclick={() => (confirmDeleteId = selectedPerson.id)} aria-label="Delete"><Trash2 size={12} /></button>
				</div>
			</div>
			{#if editingPersonId === selectedPerson.id}
				<div class="edit-row detail-edit">
					<input class="edit-input" bind:value={editName} placeholder="Name" autofocus
						onkeydown={(event) => {
							if (event.key === 'Enter') saveEdit();
							if (event.key === 'Escape') { editingPersonId = null; }
						}}
					/>
					<input class="edit-input small" bind:value={editRel} placeholder="Relationship"
						onkeydown={(event) => {
							if (event.key === 'Enter') saveEdit();
							if (event.key === 'Escape') { editingPersonId = null; }
						}}
					/>
					<button type="button" class="icon-action save" onclick={saveEdit}><Check size={13} /></button>
					<button type="button" class="icon-action" onclick={() => (editingPersonId = null)}><X size={13} /></button>
				</div>
			{:else if confirmDeleteId === selectedPerson.id}
				<div class="confirm-row">
					<span class="confirm-text">Delete {selectedPerson.name}? This will also remove all loop assignments.</span>
					<button type="button" class="confirm-btn danger" onclick={() => confirmDelete(selectedPerson.id)}>Delete</button>
					<button type="button" class="confirm-btn" onclick={() => (confirmDeleteId = null)}>Cancel</button>
				</div>
			{:else}
				<header>
					<h2>{selectedPerson.name}</h2>
					<p>{selectedPerson.rel || 'contact'}</p>
				</header>
			{/if}
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

	.person-row {
		position: relative;
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 4px;
	}

	.row-actions {
		display: flex;
		gap: 2px;
		opacity: 0;
		transition: opacity 0.15s var(--ease);
	}

	.person-row:hover .row-actions {
		opacity: 1;
	}

	.icon-action {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		border: 0;
		background: rgba(255, 255, 255, 0.6);
		color: var(--text3);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.12s var(--ease);
	}

	.icon-action:hover {
		background: rgba(255, 255, 255, 0.9);
		color: var(--text2);
	}

	.icon-action.save {
		color: var(--green);
	}

	.icon-action.danger:hover {
		color: var(--red);
		background: rgba(192, 69, 58, 0.08);
	}

	.edit-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 10px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.7);
		border: 1px solid rgba(0, 0, 0, 0.06);
		grid-column: 1 / -1;
	}

	.detail-edit {
		grid-column: unset;
	}

	.edit-input {
		flex: 1;
		border: 1px solid rgba(0, 0, 0, 0.06);
		border-radius: 8px;
		padding: 5px 8px;
		font-size: 13px;
		background: rgba(255, 255, 255, 0.8);
	}

	.edit-input:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--accent) 35%, rgba(0, 0, 0, 0.05));
		box-shadow: var(--ring-accent);
	}

	.edit-input.small {
		flex: 0.6;
	}

	.confirm-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 12px;
		background: rgba(192, 69, 58, 0.04);
		border: 1px solid rgba(192, 69, 58, 0.12);
		grid-column: 1 / -1;
	}

	.confirm-text {
		flex: 1;
		font-size: 12px;
		color: var(--text2);
	}

	.confirm-btn {
		padding: 4px 10px;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.06);
		font-size: 11px;
		cursor: pointer;
		background: rgba(255, 255, 255, 0.7);
		color: var(--text2);
		transition: all 0.12s var(--ease);
	}

	.confirm-btn.danger {
		background: color-mix(in srgb, var(--red) 10%, #fff);
		color: var(--red);
		border-color: rgba(192, 69, 58, 0.15);
	}

	.add-form {
		display: grid;
		gap: 6px;
		padding: 10px 12px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.6);
		border: 1px solid rgba(0, 0, 0, 0.06);
		animation: cardIn 0.2s var(--ease-spring);
	}

	.add-input {
		width: 100%;
		border: 1px solid rgba(0, 0, 0, 0.06);
		border-radius: 8px;
		padding: 7px 10px;
		font-size: 13px;
		background: rgba(255, 255, 255, 0.85);
	}

	.add-input:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--accent) 35%, rgba(0, 0, 0, 0.05));
		box-shadow: var(--ring-accent);
	}

	.add-input.small {
		font-size: 12px;
	}

	.add-form-actions {
		display: flex;
		gap: 6px;
	}

	.form-btn {
		padding: 5px 12px;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.06);
		font-size: 12px;
		cursor: pointer;
		background: rgba(255, 255, 255, 0.7);
		color: var(--text2);
		transition: all 0.12s var(--ease);
	}

	.form-btn.primary {
		background: color-mix(in srgb, var(--accent) 12%, #fff);
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 15%, transparent);
	}

	.form-btn.primary:hover {
		background: color-mix(in srgb, var(--accent) 18%, #fff);
	}

	.add-person-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 6px 12px;
		border-radius: 10px;
		border: 1px dashed rgba(0, 0, 0, 0.12);
		background: transparent;
		font-size: 12px;
		color: var(--text3);
		cursor: pointer;
		transition: all 0.15s var(--ease);
		width: fit-content;
	}

	.add-person-btn:hover {
		border-color: rgba(0, 0, 0, 0.25);
		color: var(--text2);
		background: rgba(255, 255, 255, 0.4);
	}

	.detail {
		display: grid;
		gap: 12px;
	}

	.detail-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.detail-actions {
		display: flex;
		gap: 4px;
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
		cursor: pointer;
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
		grid-template-columns: repeat(4, minmax(0, 1fr));
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
</style>
