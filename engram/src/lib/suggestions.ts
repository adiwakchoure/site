import { addNote, closeLoop, createLoop, putLoopPerson, putPerson, putProject, updateLoop } from '$db/local';
import { db } from '$db/schema';
import type { LoopPersonRole, SuggestedAction } from '$types/models';

async function ensurePerson(name: string) {
	const normalized = name.trim().toLowerCase();
	const found = await db.people.filter((p) => p.name.toLowerCase() === normalized).first();
	if (found) return found;
	return putPerson({ name, rel: '' });
}

async function ensureProject(name: string) {
	const normalized = name.trim().toLowerCase();
	const found = await db.projects.filter((p) => p.name.toLowerCase() === normalized).first();
	if (found) return found;
	return putProject({ name, color: '#a0714a', emoji: null });
}

export async function applySuggestion(item: SuggestedAction, dumpId: string | null = null) {
	if (item.action === 'create_person' && item.name) {
		await putPerson({ name: item.name, rel: item.rel ?? '' });
		return;
	}

	if (item.action === 'create_project' && item.name) {
		await putProject({ name: item.name, color: item.color ?? '#a0714a', emoji: null });
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
		for (const personRef of item.people ?? []) {
			const person = await ensurePerson(personRef.name);
			await putLoopPerson(loop.id, person.id, (personRef.role ?? 'involved') as LoopPersonRole);
		}
		return;
	}

	if (item.action === 'close_loop' && item.loopId) {
		await closeLoop(item.loopId, item.reason ?? 'done', dumpId);
		return;
	}

	if (item.action === 'add_note' && item.loopId && item.text) {
		await addNote(item.loopId, item.text, dumpId);
		return;
	}

	if (item.action === 'update_loop' && item.loopId) {
		const changes = item.changes ?? {};
		await updateLoop(item.loopId, {
			priority: (changes.priority as 'P0' | 'P1' | 'P2' | undefined) ?? item.priority,
			energy: (changes.energy as 'active' | 'waiting' | 'someday' | undefined) ?? item.energy,
			deadline: typeof changes.deadline === 'string' ? changes.deadline : item.deadline ?? undefined,
			title: typeof changes.title === 'string' ? changes.title : undefined
		});
	}
}
