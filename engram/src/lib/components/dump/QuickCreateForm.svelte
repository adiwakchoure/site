<script lang="ts">
	import { X, Plus, Calendar, User, FolderOpen } from 'lucide-svelte';
	import { peopleStore, projectsStore } from '$stores/app';
	import type { Person, Project } from '$types/models';
	import Badge from '$components/Badge.svelte';
	import ActionBtn from '$components/ActionBtn.svelte';
	import Pill from '$components/Pill.svelte';

	let {
		onSubmit,
		onCancel
	}: {
		onSubmit: (data: {
			title: string;
			priority: 'P0' | 'P1' | 'P2';
			energy: 'active' | 'waiting';
			people: Array<{ id: string; name: string }>;
			project: { id: string; name: string } | null;
			deadline: string | null;
		}) => void;
		onCancel: () => void;
	} = $props();

	let title = $state('');
	let priority = $state<'P0' | 'P1' | 'P2'>('P1');
	let energy = $state<'active' | 'waiting'>('active');
	let selectedPeople = $state<Array<{ id: string; name: string }>>([]);
	let selectedProject = $state<{ id: string; name: string } | null>(null);
	let deadline = $state<string | null>(null);

	let showPersonSearch = $state(false);
	let showProjectSearch = $state(false);
	let showDatePicker = $state(false);
	let personQuery = $state('');
	let projectQuery = $state('');

	let filteredPeople = $derived.by(() => {
		const people = ($peopleStore ?? []) as Person[];
		const q = personQuery.trim().toLowerCase();
		if (!q) return people.slice(0, 6);
		return people.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
	});

	let filteredProjects = $derived.by(() => {
		const projects = ($projectsStore ?? []) as Project[];
		const q = projectQuery.trim().toLowerCase();
		if (!q) return projects.filter((p) => !p.archived).slice(0, 6);
		return projects.filter((p) => !p.archived && p.name.toLowerCase().includes(q)).slice(0, 6);
	});

	function addPerson(person: Person) {
		if (!selectedPeople.find((p) => p.id === person.id)) {
			selectedPeople = [...selectedPeople, { id: person.id, name: person.name }];
		}
		showPersonSearch = false;
		personQuery = '';
	}

	function removePerson(id: string) {
		selectedPeople = selectedPeople.filter((p) => p.id !== id);
	}

	function selectProject(project: Project) {
		selectedProject = { id: project.id, name: project.name };
		showProjectSearch = false;
		projectQuery = '';
	}

	function handleSubmit() {
		if (!title.trim()) return;
		onSubmit({ title: title.trim(), priority, energy, people: selectedPeople, project: selectedProject, deadline });
	}

</script>

<div class="qc" role="group" aria-label="Quick create loop">
	<input
		class="title-input"
		bind:value={title}
		placeholder="Loop title..."
		autofocus
		onkeydown={(e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				handleSubmit();
			}
			if (e.key === 'Escape') onCancel();
		}}
	/>

	<div class="row g1" style="animation-delay:40ms">
		<Pill label="P0" active={priority === 'P0'} onClick={() => (priority = 'P0')} />
		<Pill label="P1" active={priority === 'P1'} onClick={() => (priority = 'P1')} />
		<Pill label="P2" active={priority === 'P2'} onClick={() => (priority = 'P2')} />
	</div>

	<div class="row g2" style="animation-delay:80ms">
		<Pill label="Active" active={energy === 'active'} onClick={() => (energy = 'active')} />
		<Pill label="Waiting" active={energy === 'waiting'} onClick={() => (energy = 'waiting')} />
	</div>

	<div class="chips-row g3" style="animation-delay:120ms">
		{#each selectedPeople as person}
			<Badge label={person.name} color="#6e63a0" onClick={() => removePerson(person.id)} />
		{/each}
		{#if showPersonSearch}
			<div class="search-inline">
				<input
					class="search-input"
					bind:value={personQuery}
					placeholder="Search people..."
					autofocus
					onkeydown={(e) => { if (e.key === 'Escape') { showPersonSearch = false; personQuery = ''; } }}
				/>
				{#if filteredPeople.length > 0}
					<div class="dropdown">
						{#each filteredPeople as person}
							<button class="dropdown-item" onclick={() => addPerson(person)}>{person.name}</button>
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<button class="chip" onclick={() => (showPersonSearch = true)}>
				<User size={11} /> Person
			</button>
		{/if}

		{#if selectedProject}
			<Badge label={selectedProject.name} color="#a0714a" onClick={() => (selectedProject = null)} />
		{:else if showProjectSearch}
			<div class="search-inline">
				<input
					class="search-input"
					bind:value={projectQuery}
					placeholder="Search projects..."
					autofocus
					onkeydown={(e) => { if (e.key === 'Escape') { showProjectSearch = false; projectQuery = ''; } }}
				/>
				{#if filteredProjects.length > 0}
					<div class="dropdown">
						{#each filteredProjects as project}
							<button class="dropdown-item" onclick={() => selectProject(project)}>{project.name}</button>
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<button class="chip" onclick={() => (showProjectSearch = true)}>
				<FolderOpen size={11} /> Project
			</button>
		{/if}

		{#if deadline}
			<Badge label={deadline} color="#a07c28" onClick={() => (deadline = null)} />
		{:else if showDatePicker}
			<input
				class="date-input"
				type="date"
				autofocus
				onchange={(e) => {
					deadline = (e.target as HTMLInputElement).value || null;
					showDatePicker = false;
				}}
				onkeydown={(e) => { if (e.key === 'Escape') showDatePicker = false; }}
			/>
		{:else}
			<button class="chip" onclick={() => (showDatePicker = true)}>
				<Calendar size={11} /> Deadline
			</button>
		{/if}
	</div>

	<div class="footer g4" style="animation-delay:160ms">
		<button class="cancel-btn" onclick={onCancel} title="Cancel">
			<X size={16} />
		</button>
		<ActionBtn title="Create" disabled={!title.trim()} onClick={handleSubmit}>Create</ActionBtn>
	</div>
</div>

<style>
	.qc {
		display: grid;
		gap: 10px;
		padding: 4px 0;
	}

	.title-input {
		width: 100%;
		border: none;
		background: transparent;
		font-size: var(--text-lg);
		font-weight: var(--weight-light);
		color: var(--text);
		outline: none;
		padding: 2px 0;
	}

	.title-input::placeholder {
		color: var(--text4);
	}

	.row {
		display: inline-flex;
		gap: 4px;
		animation: fadeUp 0.3s var(--ease-spring) backwards;
	}

	.chips-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		animation: fadeUp 0.3s var(--ease-spring) backwards;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: 40px;
		padding: 8px 10px;
		border: none;
		background: transparent;
		color: var(--text4);
		font-size: 12px;
		font-weight: 300;
		cursor: pointer;
		border-radius: var(--radius-sm);
		transition: color 0.15s var(--ease);
	}

	.chip:active {
		color: var(--text2);
	}

	.search-inline {
		position: relative;
		max-width: 100%;
	}

	.search-input {
		width: clamp(140px, 28vw, 220px);
		max-width: 100%;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
		background: transparent;
		font-size: var(--text-sm);
		font-weight: 300;
		color: var(--text);
		outline: none;
		padding: 8px 2px;
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: auto;
		width: max(100%, 180px);
		max-width: min(320px, calc(100vw - 48px));
		max-height: 220px;
		overflow: auto;
		background: var(--surface-3);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
		z-index: 10;
		padding: 4px;
		animation: fadeUp 0.15s var(--ease-spring);
	}

	.dropdown-item {
		width: 100%;
		text-align: left;
		border: none;
		background: transparent;
		min-height: 40px;
		padding: 8px 10px;
		font-size: var(--text-sm);
		font-weight: 300;
		color: var(--text2);
		cursor: pointer;
		border-radius: 6px;
	}

	.dropdown-item:active {
		background: rgba(0, 0, 0, 0.04);
	}

	.date-input {
		min-height: 40px;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
		background: transparent;
		font-size: var(--text-sm);
		font-weight: 300;
		color: var(--text);
		outline: none;
		padding: 8px 2px;
	}

	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		animation: fadeUp 0.3s var(--ease-spring) backwards;
	}

	.cancel-btn {
		width: 40px;
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		color: var(--text4);
		cursor: pointer;
		border-radius: var(--radius-sm);
		transition: color 0.15s var(--ease);
	}

	.cancel-btn:active {
		color: var(--text2);
	}

	@media (min-width: 1024px) {
		.dropdown {
			max-width: 360px;
		}
	}
</style>
