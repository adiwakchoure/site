<script lang="ts">
	import ManageDrawer from '$components/manage/ManageDrawer.svelte';
	import Empty from '$components/Empty.svelte';
	import Skeleton from '$components/Skeleton.svelte';
	import { createTagType, deleteTagType, deleteTagValue, renameTagType, renameTagValue } from '$db/local';
	import { tagsStore, tagTypesStore } from '$stores/app';
	import { showToast } from '$stores/toast';
	import type { Tag, TagType } from '$types/models';

	type TagValueStat = {
		value: string;
		tagCount: number;
		loopCount: number;
	};

	type TagTypeStat = {
		type: TagType;
		tagCount: number;
		loopCount: number;
		values: TagValueStat[];
	};

	const tags = $derived(($tagsStore ?? []) as Tag[]);
	const tagTypes = $derived(($tagTypesStore ?? []) as TagType[]);

	let newTypeName = $state('');
	let creatingType = $state(false);
	let actionBusy = $state(false);
	let actionMode = $state<'renameType' | 'deleteType' | 'renameValue' | 'deleteValue' | null>(null);
	let selectedType = $state<TagType | null>(null);
	let selectedValue = $state('');
	let actionInput = $state('');

	const loading = $derived($tagTypesStore === null || $tagsStore === null);

	function tagValue(tag: Tag): string | null {
		if (tag.valueText != null) return tag.valueText;
		if (tag.valueDate != null) return tag.valueDate;
		if (tag.valueNumber != null) return String(tag.valueNumber);
		if (tag.valueJson != null) return tag.valueJson;
		return null;
	}

	function slugify(value: string): string {
		return value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '');
	}

	const typeStats = $derived.by<TagTypeStat[]>(() => {
		const tagsByType = new Map<string, Tag[]>();
		for (const tag of tags) {
			const list = tagsByType.get(tag.tagTypeId) ?? [];
			list.push(tag);
			tagsByType.set(tag.tagTypeId, list);
		}

		const stats = tagTypes.map((type) => {
			const related = tagsByType.get(type.id) ?? [];
			const loopIds = new Set<string>();
			const values = new Map<string, { count: number; loopIds: Set<string> }>();

			for (const tag of related) {
				loopIds.add(tag.loopId);
				const value = tagValue(tag);
				if (!value) continue;
				const row = values.get(value) ?? { count: 0, loopIds: new Set<string>() };
				row.count += 1;
				row.loopIds.add(tag.loopId);
				values.set(value, row);
			}

			const sortedValues: TagValueStat[] = [...values.entries()]
				.map(([value, row]) => ({ value, tagCount: row.count, loopCount: row.loopIds.size }))
				.sort((a, b) => b.loopCount - a.loopCount || b.tagCount - a.tagCount || a.value.localeCompare(b.value));

			return {
				type,
				tagCount: related.length,
				loopCount: loopIds.size,
				values: sortedValues
			};
		});

		return stats.sort((a, b) => {
			if (a.type.system !== b.type.system) return a.type.system ? 1 : -1;
			return b.loopCount - a.loopCount || a.type.name.localeCompare(b.type.name);
		});
	});

	async function handleCreateType() {
		const name = newTypeName.trim();
		if (!name) {
			showToast('Name is required');
			return;
		}
		const slug = slugify(name);
		if (!slug) {
			showToast('Could not create slug from name');
			return;
		}
		creatingType = true;
		try {
			await createTagType({ name, slug });
			newTypeName = '';
			showToast('Tag type created');
		} catch (error) {
			showToast(error instanceof Error ? error.message : 'Could not create tag type');
		} finally {
			creatingType = false;
		}
	}

	function openRenameType(type: TagType) {
		selectedType = type;
		selectedValue = '';
		actionInput = type.name;
		actionMode = 'renameType';
	}

	function openDeleteType(type: TagType) {
		if (type.system) {
			showToast('System tag types cannot be deleted');
			return;
		}
		selectedType = type;
		selectedValue = '';
		actionInput = '';
		actionMode = 'deleteType';
	}

	function openRenameValue(type: TagType, value: string) {
		selectedType = type;
		selectedValue = value;
		actionInput = value;
		actionMode = 'renameValue';
	}

	function openDeleteValue(type: TagType, value: string) {
		selectedType = type;
		selectedValue = value;
		actionInput = '';
		actionMode = 'deleteValue';
	}

	function closeActionDrawer() {
		if (actionBusy) return;
		actionMode = null;
		selectedType = null;
		selectedValue = '';
		actionInput = '';
	}

	function actionTitle() {
		if (actionMode === 'renameType') return 'Rename tag type';
		if (actionMode === 'deleteType') return 'Delete tag type';
		if (actionMode === 'renameValue') return 'Rename tag value';
		if (actionMode === 'deleteValue') return 'Delete tag value';
		return 'Tag action';
	}

	async function submitAction() {
		if (!selectedType || !actionMode) return;
		actionBusy = true;
		try {
			if (actionMode === 'renameType') {
				const next = actionInput.trim();
				if (!next || next === selectedType.name) return;
				await renameTagType(selectedType.id, next);
				showToast('Tag type renamed');
			}
			if (actionMode === 'deleteType') {
				const result = await deleteTagType(selectedType.id);
				showToast(`Tag type deleted (${result.deletedTags} tags removed)`);
			}
			if (actionMode === 'renameValue') {
				const next = actionInput.trim();
				if (!next || next === selectedValue) return;
				const result = await renameTagValue(selectedType.id, selectedValue, next);
				showToast(`Updated ${result.updated} tag${result.updated === 1 ? '' : 's'}`);
			}
			if (actionMode === 'deleteValue') {
				const result = await deleteTagValue(selectedType.id, selectedValue);
				showToast(`Deleted ${result.deleted} tag${result.deleted === 1 ? '' : 's'}`);
			}
			closeActionDrawer();
		} catch (error) {
			showToast(error instanceof Error ? error.message : 'Could not complete action');
		} finally {
			actionBusy = false;
		}
	}
</script>

{#if loading}
	<Skeleton lines={8} />
{:else}
	<section class="tags-page">
		<header class="page-head">
			<h2>Tags</h2>
			<p>Configure tag types and clean up tag values used across loops.</p>
		</header>

		<form
			class="create-type panel"
			onsubmit={(event) => {
				event.preventDefault();
				handleCreateType();
			}}
		>
			<h3>Create tag type</h3>
			<div class="grid">
				<label>
					<span>Name</span>
					<input bind:value={newTypeName} />
				</label>
			</div>
			<footer>
				<button type="submit" disabled={creatingType}>{creatingType ? 'Creating...' : 'Create type'}</button>
			</footer>
		</form>

		{#if typeStats.length === 0}
			<Empty label="No tag types yet" icon={true} hint="Create a tag type to start organizing loops." />
		{:else}
			<div class="type-list">
				{#each typeStats as group}
					<article class="type-card panel">
						<header class="type-head">
							<div>
								<h3>{group.type.name}</h3>
								<p>{group.loopCount} loops · {group.tagCount} tags</p>
							</div>
							<div class="actions">
								<button type="button" onclick={() => openRenameType(group.type)}>Rename</button>
								<button type="button" class="danger" disabled={Boolean(group.type.system)} onclick={() => openDeleteType(group.type)}>
									Delete
								</button>
							</div>
						</header>

						{#if group.values.length === 0}
							<p class="muted">No values used yet.</p>
						{:else}
							<div class="value-list">
								{#each group.values as value}
									<div class="value-row">
										<div class="value-main">
											<strong>{value.value}</strong>
											<small>{value.loopCount} loops · {value.tagCount} tags</small>
										</div>
										<div class="actions">
											<button type="button" onclick={() => openRenameValue(group.type, value.value)}>Rename</button>
											<button type="button" class="danger" onclick={() => openDeleteValue(group.type, value.value)}>Delete</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<ManageDrawer open={Boolean(actionMode)} title={actionTitle()} onClose={closeActionDrawer}>
	{#snippet children()}
		{#if selectedType && actionMode}
			<div class="drawer-content">
				{#if actionMode === 'renameType'}
					<p class="drawer-copy">Rename <strong>{selectedType.name}</strong>.</p>
					<label>
						<span>New name</span>
						<input bind:value={actionInput} />
					</label>
				{:else if actionMode === 'deleteType'}
					<p class="drawer-copy">
						Delete <strong>{selectedType.name}</strong> and all of its values? This cannot be undone.
					</p>
				{:else if actionMode === 'renameValue'}
					<p class="drawer-copy">
						Rename <strong>{selectedValue}</strong> in <strong>{selectedType.name}</strong>.
					</p>
					<label>
						<span>New value</span>
						<input bind:value={actionInput} />
					</label>
				{:else if actionMode === 'deleteValue'}
					<p class="drawer-copy">
						Delete value <strong>{selectedValue}</strong> from <strong>{selectedType.name}</strong>? This cannot be undone.
					</p>
				{/if}

				<div class="drawer-actions">
					<button type="button" onclick={closeActionDrawer} disabled={actionBusy}>Cancel</button>
					<button type="button" class="danger" onclick={submitAction} disabled={actionBusy}>
						{actionBusy ? 'Working...' : 'Confirm'}
					</button>
				</div>
			</div>
		{/if}
	{/snippet}
</ManageDrawer>

<style>
	.tags-page {
		display: grid;
		gap: 10px;
	}

	.page-head h2 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--text-xl);
	}

	.page-head p {
		margin: 4px 0 0;
		color: var(--text3);
		font-size: var(--text-sm);
	}

	.create-type {
		display: grid;
		gap: 10px;
		padding: 12px;
	}

	.create-type h3 {
		margin: 0;
		font-size: var(--text-md);
	}

	.grid {
		display: grid;
		gap: 8px;
	}

	label {
		display: grid;
		gap: 4px;
	}

	label span {
		font-size: var(--text-xs);
		font-family: var(--font-mono);
		color: var(--text3);
	}

	input {
		min-height: 36px;
		border-radius: 10px;
		border: 1px solid var(--border-soft);
		background: var(--surface-2);
		color: var(--text);
		padding: 0 10px;
	}

	footer {
		display: flex;
		justify-content: flex-end;
	}

	button {
		min-height: 34px;
		border-radius: 10px;
		border: 1px solid var(--border-soft);
		background: var(--surface-2);
		color: var(--text2);
		padding: 6px 10px;
		font-size: var(--text-sm);
	}

	.type-list {
		display: grid;
		gap: 8px;
	}

	.type-card {
		display: grid;
		gap: 8px;
		padding: 10px;
	}

	.type-head {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 8px;
	}

	.type-head h3 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--text-lg);
	}

	.type-head p {
		margin: 2px 0 0;
		font-size: var(--text-xs);
		font-family: var(--font-mono);
		color: var(--text3);
	}

	.value-list {
		display: grid;
		gap: 6px;
	}

	.value-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		border: 1px solid var(--border-soft);
		background: var(--surface-2);
		border-radius: 10px;
		padding: 8px;
	}

	.value-main {
		display: grid;
		gap: 2px;
		min-width: 0;
	}

	.value-main strong {
		font-size: var(--text-sm);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.value-main small {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text3);
	}

	.actions {
		display: inline-flex;
		gap: 6px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.danger {
		color: var(--red);
		border-color: color-mix(in srgb, var(--red) 26%, var(--border-soft));
	}

	.muted {
		margin: 0;
		color: var(--text3);
		font-size: var(--text-sm);
	}

	.drawer-content {
		display: grid;
		gap: 10px;
	}

	.drawer-copy {
		margin: 0;
		color: var(--text2);
		font-size: var(--text-sm);
	}

	.drawer-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
</style>
