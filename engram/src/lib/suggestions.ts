import { addUpdate, closeLoop, createLoop, setLoopTag, setSuggestionStatus, updateLoop, updateLoopTags } from '$db/local';
import { get } from 'svelte/store';
import { loopsStore, tagTypesStore, tagsStore, deriveLoopViews } from '$stores/app';
import type { SuggestedAction } from '$types/models';

async function ensureAndLinkPeople(loopId: string, people?: SuggestedAction['people']) {
	for (const name of people ?? []) {
		if (!name) continue;
		await setLoopTag(loopId, 'person', name, { multi: 1 });
	}
}

async function resolveLoopId(item: SuggestedAction): Promise<string | null> {
	if (item.loopId) return item.loopId;
	const query = (item.title ?? item.text ?? '').trim().toLowerCase();
	if (!query) return null;
	const loops = get(loopsStore) ?? [];
	const tags = get(tagsStore) ?? [];
	const tagTypes = get(tagTypesStore) ?? [];
	const loopViews = deriveLoopViews(loops, tags, tagTypes);
	const exact = loopViews.find((loop) => loop.title.toLowerCase() === query);
	if (exact) return exact.id;
	const includes = loopViews.find((loop) => loop.title.toLowerCase().includes(query) || query.includes(loop.title.toLowerCase()));
	return includes?.id ?? null;
}

export async function applySuggestion(item: SuggestedAction, dumpId: string | null = null) {
	const markAccepted = async () => {
		if (item.suggestionId) {
			await setSuggestionStatus(item.suggestionId, 'accepted');
		}
	};

	if (item.action === 'open_loop' && item.title) {
		const loop = await createLoop({
			title: item.title,
			content: item.content ?? null,
			priority: item.priority ?? 'P1',
			deadline: item.deadline ?? null,
			project: item.project ?? null,
			tags: item.tags ?? [],
			dumpId
		});
		await ensureAndLinkPeople(loop.id, item.people);
		await markAccepted();
		return;
	}

	if (item.action === 'close_loop' && item.loopId) {
		await ensureAndLinkPeople(item.loopId, item.people);
		await closeLoop(item.loopId, dumpId);
		await markAccepted();
		return;
	}

	if (item.action === 'close_loop' && !item.loopId) {
		const resolved = await resolveLoopId(item);
		if (!resolved) return;
		await ensureAndLinkPeople(resolved, item.people);
		await closeLoop(resolved, dumpId);
		await markAccepted();
		return;
	}

	if (item.action === 'add_note' && item.loopId && item.text) {
		await addUpdate(item.loopId, item.text, dumpId);
		await ensureAndLinkPeople(item.loopId, item.people);
		await markAccepted();
		return;
	}

	if (item.action === 'add_note' && !item.loopId && item.text) {
		const resolved = await resolveLoopId(item);
		if (!resolved) return;
		await addUpdate(resolved, item.text, dumpId);
		await ensureAndLinkPeople(resolved, item.people);
		await markAccepted();
		return;
	}

	if (item.action === 'update_loop' && item.loopId) {
		const changes = item.changes ?? {};
		if (typeof changes.title === 'string') {
			await updateLoop(item.loopId, { title: changes.title });
		}
		if (typeof changes.content === 'string') {
			await updateLoop(item.loopId, { content: changes.content });
		}
		await updateLoopTags(item.loopId, {
			priority: (changes.priority as string | null | undefined) ?? item.priority ?? undefined,
			deadline: typeof changes.deadline === 'string' ? changes.deadline : item.deadline ?? undefined,
			project: typeof changes.project === 'string' ? changes.project : item.project ?? undefined
		});
		if (item.tagTypeSlug) {
			await setLoopTag(item.loopId, item.tagTypeSlug, item.tagValue ?? null, { multi: 1 });
		}
		await ensureAndLinkPeople(item.loopId, item.people);
		await markAccepted();
		return;
	}

	if (item.action === 'update_loop' && !item.loopId) {
		const resolved = await resolveLoopId(item);
		if (!resolved) return;
		const changes = item.changes ?? {};
		if (typeof changes.title === 'string') {
			await updateLoop(resolved, { title: changes.title });
		}
		if (typeof changes.content === 'string') {
			await updateLoop(resolved, { content: changes.content });
		}
		await updateLoopTags(resolved, {
			priority: (changes.priority as string | null | undefined) ?? item.priority ?? undefined,
			deadline: typeof changes.deadline === 'string' ? changes.deadline : item.deadline ?? undefined,
			project: typeof changes.project === 'string' ? changes.project : item.project ?? undefined
		});
		if (item.tagTypeSlug) {
			await setLoopTag(resolved, item.tagTypeSlug, item.tagValue ?? null, { multi: 1 });
		}
		await ensureAndLinkPeople(resolved, item.people);
		await markAccepted();
	}

	if (item.action === 'tag_loop' && item.loopId && item.tagTypeSlug) {
		await setLoopTag(item.loopId, item.tagTypeSlug, item.tagValue ?? null, { multi: 1 });
		await markAccepted();
		return;
	}

	if (item.action === 'tag_loop' && !item.loopId && item.tagTypeSlug) {
		const resolved = await resolveLoopId(item);
		if (!resolved) return;
		await setLoopTag(resolved, item.tagTypeSlug, item.tagValue ?? null, { multi: 1 });
		await markAccepted();
		return;
	}
}
