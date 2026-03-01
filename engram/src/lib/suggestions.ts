import { addUpdate, closeLoop, createLoop, putLoopPerson, putPerson, putProject, setSuggestionStatus, updateLoop } from '$db/local';
import { get } from 'svelte/store';
import { peopleStore, projectsStore, loopsStore } from '$stores/app';
import type { LoopPersonRole, SuggestedAction } from '$types/models';

async function ensurePerson(name: string, rel?: string) {
	const normalized = name.trim().toLowerCase();
	const people = get(peopleStore) ?? [];
	const found = people.find((p) => p.name.toLowerCase() === normalized);
	if (found) return found;
	return putPerson({ name, rel: rel ?? '' });
}

async function ensureAndLinkPeople(loopId: string, people?: SuggestedAction['people']) {
	for (const ref of people ?? []) {
		const person = await ensurePerson(ref.name, ref.rel);
		await putLoopPerson(loopId, person.id, (ref.role ?? 'involved') as LoopPersonRole);
	}
}

async function ensureProject(name: string) {
	const normalized = name.trim().toLowerCase();
	const projects = get(projectsStore) ?? [];
	const found = projects.find((p) => p.name.toLowerCase() === normalized);
	if (found) return found;
	return putProject({ name, color: '#a0714a', emoji: null });
}

async function resolveLoopId(item: SuggestedAction): Promise<string | null> {
	if (item.loopId) return item.loopId;
	const query = (item.title ?? item.text ?? '').trim().toLowerCase();
	if (!query) return null;
	const loops = get(loopsStore) ?? [];
	const exact = loops.find((loop) => loop.title.toLowerCase() === query);
	if (exact) return exact.id;
	const includes = loops.find((loop) => loop.title.toLowerCase().includes(query) || query.includes(loop.title.toLowerCase()));
	return includes?.id ?? null;
}

export async function applySuggestion(item: SuggestedAction, dumpId: string | null = null) {
	const markAccepted = async () => {
		if (item.suggestionId) {
			await setSuggestionStatus(item.suggestionId, 'accepted');
		}
	};

	if (item.action === 'create_person' && item.name) {
		await putPerson({ name: item.name, rel: item.rel ?? '' });
		await markAccepted();
		return;
	}

	if (item.action === 'create_project' && item.name) {
		await putProject({ name: item.name, color: item.color ?? '#a0714a', emoji: null });
		await markAccepted();
		return;
	}

	if (item.action === 'open_loop' && item.title) {
		const project = item.project ? await ensureProject(item.project) : null;
		const loop = await createLoop({
			title: item.title,
			priority: item.priority ?? 'P1',
			energy: item.energy ?? 'active',
			deadline: item.deadline ?? null,
			projectId: project?.id ?? null,
			tags: item.tags ?? [],
			dumpId
		});
		await ensureAndLinkPeople(loop.id, item.people);
		await markAccepted();
		return;
	}

	if (item.action === 'close_loop' && item.loopId) {
		await ensureAndLinkPeople(item.loopId, item.people);
		await closeLoop(item.loopId, item.reason ?? 'done', dumpId);
		await markAccepted();
		return;
	}

	if (item.action === 'close_loop' && !item.loopId) {
		const resolved = await resolveLoopId(item);
		if (!resolved) return;
		await ensureAndLinkPeople(resolved, item.people);
		await closeLoop(resolved, item.reason ?? 'done', dumpId);
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
		const projectName = changes.project ?? item.project;
		const project = typeof projectName === 'string' ? await ensureProject(projectName) : undefined;
		await updateLoop(item.loopId, {
			priority: (changes.priority as 'P0' | 'P1' | 'P2' | undefined) ?? item.priority,
			energy: (changes.energy as 'active' | 'waiting' | 'someday' | undefined) ?? item.energy,
			deadline: typeof changes.deadline === 'string' ? changes.deadline : item.deadline ?? undefined,
			projectId: project?.id
		});
		await ensureAndLinkPeople(item.loopId, item.people);
		await markAccepted();
		return;
	}

	if (item.action === 'update_loop' && !item.loopId) {
		const resolved = await resolveLoopId(item);
		if (!resolved) return;
		const changes = item.changes ?? {};
		const projectName = changes.project ?? item.project;
		const project = typeof projectName === 'string' ? await ensureProject(projectName) : undefined;
		await updateLoop(resolved, {
			priority: (changes.priority as 'P0' | 'P1' | 'P2' | undefined) ?? item.priority,
			energy: (changes.energy as 'active' | 'waiting' | 'someday' | undefined) ?? item.energy,
			deadline: typeof changes.deadline === 'string' ? changes.deadline : item.deadline ?? undefined,
			projectId: project?.id
		});
		await ensureAndLinkPeople(resolved, item.people);
		await markAccepted();
	}
}
