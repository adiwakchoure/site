<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import ManageDrawer from '$components/manage/ManageDrawer.svelte';
	import ManageRowActions from '$components/manage/ManageRowActions.svelte';
	import ManageTabs from '$components/manage/ManageTabs.svelte';
	import {
		archiveProject,
		closeLoop,
		deleteLoop,
		deleteProject,
		putPerson,
		putProject,
		reassignLoopsAndDeletePerson,
		reopenLoop,
		unarchiveProject,
		updateLoop,
		updatePerson,
		updateProject
	} from '$db/local';
	import type { Loop, LoopEnergy, LoopPriority, Person, Project } from '$types/models';
	import { loopPeopleStore, loopsStore, peopleStore, pendingSyncStore, projectsStore, syncState } from '$stores/app';
	import { showToast } from '$stores/toast';

	type ManageTab = 'loops' | 'projects' | 'people' | 'account';
	type DrawerMode = null | 'new-project' | 'edit-project' | 'new-person' | 'edit-person' | 'delete-person' | 'edit-loop';

	const tabs: Array<{ id: ManageTab; label: string }> = [
		{ id: 'loops', label: 'Loops' },
		{ id: 'projects', label: 'Projects' },
		{ id: 'people', label: 'People' },
		{ id: 'account', label: 'Account' }
	];

	let activeTab = $state<ManageTab>('loops');
	let search = $state('');
	let drawerMode = $state<DrawerMode>(null);
	let editingProjectId = $state<string | null>(null);
	let editingPersonId = $state<string | null>(null);
	let editingLoopId = $state<string | null>(null);

	let projectName = $state('');
	let projectColor = $state('#a0714a');
	let projectEmoji = $state('');

	let personName = $state('');
	let personRel = $state('');

	let loopTitle = $state('');
	let loopPriority = $state<LoopPriority>('P1');
	let loopEnergy = $state<LoopEnergy>('active');
	let loopDeadline = $state('');
	let loopProjectId = $state('');

	let deletePersonId = $state<string | null>(null);
	let reassignPersonId = $state('');

	const loops = $derived(($loopsStore ?? []) as Loop[]);
	const people = $derived(($peopleStore ?? []) as Person[]);
	const projects = $derived(($projectsStore ?? []) as Project[]);
	const loopPeople = $derived($loopPeopleStore ?? []);

	const tabFromUrl = $derived.by(() => {
		const raw = ($page.url.searchParams.get('tab') ?? '').toLowerCase();
		return tabs.some((tab) => tab.id === raw) ? (raw as ManageTab) : 'loops';
	});

	$effect(() => {
		activeTab = tabFromUrl;
	});

	const normalizedQuery = $derived(search.trim().toLowerCase());
	const filteredLoops = $derived(
		loops.filter((loop) =>
			normalizedQuery
				? `${loop.title} ${loop.priority} ${loop.energy} ${loop.state}`.toLowerCase().includes(normalizedQuery)
				: true
		)
	);
	const filteredProjects = $derived(
		projects.filter((project) =>
			normalizedQuery
				? `${project.name} ${project.emoji ?? ''} ${project.color}`.toLowerCase().includes(normalizedQuery)
				: true
		)
	);
	const filteredPeople = $derived(
		people.filter((person) =>
			normalizedQuery
				? `${person.name} ${person.rel}`.toLowerCase().includes(normalizedQuery)
				: true
		)
	);

	const openLoopIds = $derived(new Set(loops.filter((loop) => loop.state === 'open').map((loop) => loop.id)));
	const openLoopCountByPerson = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const link of loopPeople) {
			if (!openLoopIds.has(link.loopId)) continue;
			counts.set(link.personId, (counts.get(link.personId) ?? 0) + 1);
		}
		return counts;
	});

	const deletePersonRecord = $derived(people.find((person) => person.id === deletePersonId) ?? null);
	const deletePersonLoopCount = $derived(deletePersonId ? (openLoopCountByPerson.get(deletePersonId) ?? 0) : 0);
	const reassignOptions = $derived(people.filter((person) => person.id !== deletePersonId));

	const accountUser = $derived(($page.data.user as { email?: string } | undefined) ?? null);

	async function changeTab(next: string) {
		if (!tabs.some((tab) => tab.id === next)) return;
		const url = new URL($page.url);
		url.searchParams.set('tab', next);
		await goto(`${url.pathname}?${url.searchParams.toString()}`, { replaceState: true, noScroll: true, keepFocus: true });
	}

	function resetProjectForm() {
		editingProjectId = null;
		projectName = '';
		projectColor = '#a0714a';
		projectEmoji = '';
	}

	function resetPersonForm() {
		editingPersonId = null;
		personName = '';
		personRel = '';
	}

	function resetLoopForm() {
		editingLoopId = null;
		loopTitle = '';
		loopPriority = 'P1';
		loopEnergy = 'active';
		loopDeadline = '';
		loopProjectId = '';
	}

	function openNewProject() {
		resetProjectForm();
		drawerMode = 'new-project';
	}

	function openEditProject(project: Project) {
		editingProjectId = project.id;
		projectName = project.name;
		projectColor = project.color;
		projectEmoji = project.emoji ?? '';
		drawerMode = 'edit-project';
	}

	async function submitProject() {
		if (!projectName.trim()) return;
		try {
			if (editingProjectId) {
				await updateProject(editingProjectId, {
					name: projectName.trim(),
					color: projectColor,
					emoji: projectEmoji.trim() || null
				});
				showToast('Project updated');
			} else {
				await putProject({
					name: projectName.trim(),
					color: projectColor,
					emoji: projectEmoji.trim() || null
				});
				showToast('Project created');
			}
			resetProjectForm();
			drawerMode = null;
		} catch {
			showToast('Could not save project');
		}
	}

	async function toggleProjectArchive(project: Project) {
		try {
			if (project.archived) {
				await unarchiveProject(project.id);
				showToast('Project unarchived');
			} else {
				await archiveProject(project.id);
				showToast('Project archived');
			}
		} catch {
			showToast('Could not update project');
		}
	}

	async function removeProject(project: Project) {
		if (!window.confirm(`Delete project "${project.name}"?`)) return;
		try {
			await deleteProject(project.id);
			showToast('Project deleted');
		} catch {
			showToast('Could not delete project');
		}
	}

	function openNewPerson() {
		resetPersonForm();
		drawerMode = 'new-person';
	}

	function openEditPerson(person: Person) {
		editingPersonId = person.id;
		personName = person.name;
		personRel = person.rel;
		drawerMode = 'edit-person';
	}

	async function submitPerson() {
		if (!personName.trim()) return;
		try {
			if (editingPersonId) {
				await updatePerson(editingPersonId, { name: personName.trim(), rel: personRel.trim() || 'contact' });
				showToast('Person updated');
			} else {
				await putPerson({ name: personName.trim(), rel: personRel.trim() || 'contact' });
				showToast('Person created');
			}
			resetPersonForm();
			drawerMode = null;
		} catch {
			showToast('Could not save person');
		}
	}

	function openDeletePerson(person: Person) {
		deletePersonId = person.id;
		reassignPersonId = people.find((entry) => entry.id !== person.id)?.id ?? '';
		drawerMode = 'delete-person';
	}

	async function submitDeletePerson() {
		if (!deletePersonId) return;
		const loopCount = openLoopCountByPerson.get(deletePersonId) ?? 0;
		if (loopCount > 0 && !reassignPersonId) {
			showToast('Select a person to reassign open loops');
			return;
		}
		try {
			await reassignLoopsAndDeletePerson(deletePersonId, loopCount > 0 ? reassignPersonId : null);
			showToast('Person deleted');
			deletePersonId = null;
			reassignPersonId = '';
			drawerMode = null;
		} catch {
			showToast('Could not delete person');
		}
	}

	function openEditLoop(loop: Loop) {
		editingLoopId = loop.id;
		loopTitle = loop.title;
		loopPriority = loop.priority;
		loopEnergy = loop.energy;
		loopDeadline = loop.deadline ?? '';
		loopProjectId = loop.projectId ?? '';
		drawerMode = 'edit-loop';
	}

	async function submitLoop() {
		if (!editingLoopId || !loopTitle.trim()) return;
		try {
			await updateLoop(editingLoopId, {
				title: loopTitle.trim(),
				priority: loopPriority,
				energy: loopEnergy,
				deadline: loopDeadline.trim() || null,
				projectId: loopProjectId || null
			});
			showToast('Loop updated');
			resetLoopForm();
			drawerMode = null;
		} catch {
			showToast('Could not update loop');
		}
	}

	async function toggleLoopState(loop: Loop) {
		try {
			if (loop.state === 'open') {
				await closeLoop(loop.id, 'done');
				showToast('Loop closed');
			} else {
				await reopenLoop(loop.id);
				showToast('Loop reopened');
			}
		} catch {
			showToast('Could not update loop state');
		}
	}

	async function removeLoopRow(loop: Loop) {
		if (!window.confirm(`Delete loop "${loop.title}"?`)) return;
		try {
			await deleteLoop(loop.id);
			showToast('Loop deleted');
		} catch {
			showToast('Could not delete loop');
		}
	}
</script>

<section class="manage-page stack-gap-3">
	<header class="manage-head panel">
		<div>
			<h2>Management</h2>
			<p>Simple controls for loops, projects, people, and account.</p>
		</div>
		<input class="search" type="search" bind:value={search} placeholder="Search current section..." />
	</header>

	<ManageTabs tabs={tabs} active={activeTab} onChange={changeTab} />

	{#if activeTab === 'loops'}
		<section class="panel section">
			<header class="section-head">
				<h3>Loops</h3>
			</header>
			<div class="table">
				<div class="table-row table-head">
					<span>Loop</span>
					<span>Status</span>
					<span>Priority</span>
					<span>Actions</span>
				</div>
				{#if filteredLoops.length === 0}
					<p class="empty">No loops found.</p>
				{:else}
					{#each filteredLoops as loop (loop.id)}
						<div class="table-row loops-row">
							<span class="cell-main">{loop.title}</span>
							<span>{loop.state}</span>
							<span>{loop.priority}</span>
							<ManageRowActions
								onEdit={() => openEditLoop(loop)}
								onArchive={() => toggleLoopState(loop)}
								onDelete={() => removeLoopRow(loop)}
								archived={loop.state === 'closed'}
							/>
						</div>
					{/each}
				{/if}
			</div>
		</section>
	{/if}

	{#if activeTab === 'projects'}
		<section class="panel section">
			<header class="section-head">
				<h3>Projects</h3>
				<button type="button" class="primary-btn" onclick={openNewProject}>New project</button>
			</header>
			<div class="table">
				<div class="table-row table-head">
					<span>Project</span>
					<span>Status</span>
					<span>Actions</span>
				</div>
				{#if filteredProjects.length === 0}
					<p class="empty">No projects found.</p>
				{:else}
					{#each filteredProjects as project (project.id)}
						<div class="table-row">
							<span class="cell-main">{project.emoji ?? '•'} {project.name}</span>
							<span>{project.archived ? 'Archived' : 'Active'}</span>
							<ManageRowActions
								onEdit={() => openEditProject(project)}
								onArchive={() => toggleProjectArchive(project)}
								onDelete={() => removeProject(project)}
								archived={Boolean(project.archived)}
							/>
						</div>
					{/each}
				{/if}
			</div>
		</section>
	{/if}

	{#if activeTab === 'people'}
		<section class="panel section">
			<header class="section-head">
				<h3>People</h3>
				<button type="button" class="primary-btn" onclick={openNewPerson}>New person</button>
			</header>
			<div class="table">
				<div class="table-row table-head">
					<span>Name</span>
					<span>Context</span>
					<span>Open loops</span>
					<span>Actions</span>
				</div>
				{#if filteredPeople.length === 0}
					<p class="empty">No people found.</p>
				{:else}
					{#each filteredPeople as person (person.id)}
						<div class="table-row people-row">
							<span class="cell-main">{person.name}</span>
							<span>{person.rel}</span>
							<span>{openLoopCountByPerson.get(person.id) ?? 0}</span>
							<ManageRowActions
								onEdit={() => openEditPerson(person)}
								onDelete={() => openDeletePerson(person)}
								canArchive={false}
							/>
						</div>
					{/each}
				{/if}
			</div>
		</section>
	{/if}

	{#if activeTab === 'account'}
		<section class="panel section account">
			<h3>Account</h3>
			<div class="account-grid">
				<div>
					<span class="label">Signed in as</span>
					<p>{accountUser?.email ?? 'Unknown user'}</p>
				</div>
				<div>
					<span class="label">Sync state</span>
					<p>{$syncState}</p>
				</div>
				<div>
					<span class="label">Pending operations</span>
					<p>{$pendingSyncStore ?? 0}</p>
				</div>
			</div>
			<a class="primary-link" href="/api/auth/logout">Sign out</a>
		</section>
	{/if}
</section>

<ManageDrawer
	open={drawerMode === 'new-project' || drawerMode === 'edit-project'}
	title={drawerMode === 'edit-project' ? 'Edit project' : 'New project'}
	onClose={() => (drawerMode = null)}
>
	<form class="form" onsubmit={(e) => { e.preventDefault(); submitProject(); }}>
		<label>
			Name
			<input bind:value={projectName} required />
		</label>
		<label>
			Color
			<input bind:value={projectColor} type="color" />
		</label>
		<label>
			Emoji
			<input bind:value={projectEmoji} maxlength={4} placeholder="Optional" />
		</label>
		<button type="submit" class="primary-btn">{editingProjectId ? 'Save project' : 'Create project'}</button>
	</form>
</ManageDrawer>

<ManageDrawer
	open={drawerMode === 'new-person' || drawerMode === 'edit-person'}
	title={drawerMode === 'edit-person' ? 'Edit person' : 'New person'}
	onClose={() => (drawerMode = null)}
>
	<form class="form" onsubmit={(e) => { e.preventDefault(); submitPerson(); }}>
		<label>
			Name
			<input bind:value={personName} required />
		</label>
		<label>
			Context
			<input bind:value={personRel} placeholder="colleague, client, friend..." />
		</label>
		<button type="submit" class="primary-btn">{editingPersonId ? 'Save person' : 'Create person'}</button>
	</form>
</ManageDrawer>

<ManageDrawer
	open={drawerMode === 'delete-person'}
	title="Reassign loops and delete person"
	onClose={() => (drawerMode = null)}
>
	<form class="form" onsubmit={(e) => { e.preventDefault(); submitDeletePerson(); }}>
		<p class="note">
			{#if deletePersonRecord}
				Delete <strong>{deletePersonRecord.name}</strong>. Open loops linked: <strong>{deletePersonLoopCount}</strong>.
			{/if}
		</p>
		{#if deletePersonLoopCount > 0}
			<label>
				Reassign open loops to
				<select bind:value={reassignPersonId} required>
					<option value="" disabled>Select person</option>
					{#each reassignOptions as person (person.id)}
						<option value={person.id}>{person.name}</option>
					{/each}
				</select>
			</label>
		{/if}
		<button type="submit" class="primary-btn">Reassign and delete</button>
	</form>
</ManageDrawer>

<ManageDrawer
	open={drawerMode === 'edit-loop'}
	title="Edit loop"
	onClose={() => (drawerMode = null)}
>
	<form class="form" onsubmit={(e) => { e.preventDefault(); submitLoop(); }}>
		<label>
			Title
			<input bind:value={loopTitle} required />
		</label>
		<label>
			Priority
			<select bind:value={loopPriority}>
				<option value="P0">P0</option>
				<option value="P1">P1</option>
				<option value="P2">P2</option>
			</select>
		</label>
		<label>
			Energy
			<select bind:value={loopEnergy}>
				<option value="active">Active</option>
				<option value="waiting">Waiting</option>
				<option value="someday">Someday</option>
			</select>
		</label>
		<label>
			Deadline
			<input type="date" bind:value={loopDeadline} />
		</label>
		<label>
			Project
			<select bind:value={loopProjectId}>
				<option value="">No project</option>
				{#each projects as project (project.id)}
					<option value={project.id}>{project.name}</option>
				{/each}
			</select>
		</label>
		<button type="submit" class="primary-btn">Save loop</button>
	</form>
</ManageDrawer>

<style>
	.manage-page {
		min-height: 100%;
	}

	.manage-head {
		padding: 12px;
		display: grid;
		gap: 10px;
	}

	h2,
	h3 {
		margin: 0;
		font-family: var(--font-serif);
		font-weight: var(--weight-normal);
	}

	.manage-head p {
		margin: 4px 0 0;
		color: var(--text3);
		font-size: var(--text-sm);
	}

	.search {
		width: 100%;
		min-height: 40px;
		border-radius: 10px;
		border: 1px solid var(--border-soft);
		background: var(--surface-3);
		padding: 8px 10px;
	}

	.section {
		padding: 12px;
		display: grid;
		gap: 12px;
	}

	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.primary-btn,
	.primary-link {
		min-height: 40px;
		border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		color: var(--accent);
		border-radius: 10px;
		padding: 8px 12px;
		font-size: var(--text-sm);
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.table {
		display: grid;
		gap: 4px;
	}

	.table-row {
		display: grid;
		grid-template-columns: minmax(120px, 1.5fr) minmax(90px, 1fr) minmax(130px, 1.2fr);
		align-items: center;
		gap: 10px;
		border-radius: 10px;
		padding: 10px;
		border: 1px solid var(--border-soft);
		background: var(--surface-2);
	}

	.table-head {
		background: transparent;
		border-color: transparent;
		color: var(--text3);
		font-size: var(--text-sm);
		padding: 4px 10px;
	}

	.loops-row {
		grid-template-columns: minmax(180px, 1.8fr) 90px 90px minmax(140px, 1.2fr);
	}

	.people-row {
		grid-template-columns: minmax(120px, 1.2fr) minmax(110px, 1fr) 90px minmax(140px, 1.2fr);
	}

	.cell-main {
		font-size: var(--text-md);
		color: var(--text);
	}

	.empty {
		margin: 0;
		color: var(--text3);
		font-size: var(--text-sm);
		padding: 8px 4px;
	}

	select,
	input {
		min-height: 36px;
		border-radius: 8px;
		border: 1px solid var(--border-soft);
		background: var(--surface-3);
		padding: 6px 8px;
		font-size: var(--text-sm);
	}

	.account-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}

	.account-grid > div {
		border: 1px solid var(--border-soft);
		border-radius: 10px;
		padding: 10px;
		background: var(--surface-2);
	}

	.label {
		font-size: var(--text-xs);
		color: var(--text3);
	}

	.account-grid p {
		margin: 5px 0 0;
		font-size: var(--text-md);
	}

	.form {
		display: grid;
		gap: 10px;
	}

	.form label {
		display: grid;
		gap: 6px;
		font-size: var(--text-sm);
		color: var(--text2);
	}

	.note {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text2);
	}

	@media (max-width: 767px) {
		.table-row,
		.people-row,
		.loops-row {
			grid-template-columns: 1fr;
			gap: 6px;
		}

		.table-head {
			display: none;
		}

		.account-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
