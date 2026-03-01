import { db } from '$db/schema';
import type {
	ClosedReason,
	Dump,
	Loop,
	LoopEnergy,
	LoopEvent,
	LoopNote,
	LoopPriority,
	Person,
	Project,
	SuggestedAction,
	SuggestionRecord,
	SyncOp
} from '$types/models';
import { uid } from '$lib/utils';
import { syncNow } from '$db/sync';
import { refreshFromServer } from '$stores/app';

const nowIso = () => new Date().toISOString();

const queue = async (op: Omit<SyncOp, 'seq'>) => db.syncQueue.add(op);

function syncAndRefresh() {
	if (typeof navigator === 'undefined' || !navigator.onLine) return;
	syncNow()
		.then(() => refreshFromServer())
		.catch(() => {});
}

async function putEvent(event: LoopEvent) {
	await db.events.put(event);
	await queue({ table: 'events', op: 'put', id: event.id, data: event as unknown as Record<string, unknown>, ts: event.createdAt });
}

async function nextSequence(loopId: string | null): Promise<number> {
	if (!loopId) return 1;
	const events = await db.events.where('loopId').equals(loopId).toArray();
	if (events.length === 0) return 1;
	return Math.max(...events.map((evt) => evt.sequence || 0)) + 1;
}

async function putLoop(loop: Loop) {
	await db.loops.put(loop);
	await queue({ table: 'loops', op: 'put', id: loop.id, data: loop as unknown as Record<string, unknown>, ts: loop.updatedAt });
}

async function touchLoop(loopId: string, at: string) {
	const current = await db.loops.get(loopId);
	if (!current) return;
	const next: Loop = { ...current, updatedAt: at };
	await putLoop(next);
}

export async function createLoop(input: {
	title: string;
	body?: string;
	priority?: LoopPriority;
	energy?: LoopEnergy;
	deadline?: string | null;
	projectId?: string | null;
	parentId?: string | null;
	tags?: string[];
	dumpId?: string | null;
}) {
	const now = nowIso();
	const loop: Loop = {
		id: uid('loop'),
		title: input.title,
		body: input.body ?? '',
		state: 'open',
		closedReason: null,
		energy: input.energy ?? 'active',
		priority: input.priority ?? 'P1',
		deadline: input.deadline ?? null,
		projectId: input.projectId ?? null,
		parentId: input.parentId ?? null,
		tags: (input.tags ?? []).join(','),
		createdAt: now,
		closedAt: null,
		archivedAt: null,
		updatedAt: now
	};
	await putLoop(loop);
	await putEvent({
		id: uid('evt'),
		loopId: loop.id,
		kind: 'created',
		body: null,
		meta: JSON.stringify({
			title: loop.title,
			priority: loop.priority,
			energy: loop.energy,
			deadline: loop.deadline,
			projectId: loop.projectId,
			tags: loop.tags
		}),
		dumpId: input.dumpId ?? null,
		sequence: await nextSequence(loop.id),
		createdAt: now
	});
	syncAndRefresh();
	return loop;
}

export async function updateLoop(loopId: string, changes: Partial<Pick<Loop, 'title' | 'body' | 'priority' | 'energy' | 'deadline' | 'projectId' | 'tags'>>) {
	const current = await db.loops.get(loopId);
	if (!current) return null;
	const now = nowIso();
	const next: Loop = { ...current, ...changes, updatedAt: now };
	await putLoop(next);
	const cleanEntries = Object.entries(changes).filter(([, val]) => val !== undefined);
	if (cleanEntries.length === 0) return next;
	await putEvent({
		id: uid('evt'),
		loopId,
		kind: 'updated',
		body: cleanEntries
			.map(([key, val]) => `${key} -> ${String(val ?? '')}`)
			.join(', '),
		meta: JSON.stringify(changes),
		dumpId: null,
		sequence: await nextSequence(loopId),
		createdAt: now
	});
	syncAndRefresh();
	return next;
}

export async function closeLoop(loopId: string, reason: ClosedReason, dumpId: string | null = null) {
	const current = await db.loops.get(loopId);
	if (!current) return null;
	const now = nowIso();
	const next: Loop = {
		...current,
		state: 'closed',
		closedReason: reason,
		closedAt: now,
		archivedAt: now,
		updatedAt: now
	};
	await putLoop(next);
	await putEvent({
		id: uid('evt'),
		loopId,
		kind: 'closed',
		body: null,
		meta: JSON.stringify({ reason }),
		dumpId,
		sequence: await nextSequence(loopId),
		createdAt: now
	});
	syncAndRefresh();
	return next;
}

export async function reopenLoop(loopId: string) {
	const current = await db.loops.get(loopId);
	if (!current) return null;
	const now = nowIso();
	const next: Loop = {
		...current,
		state: 'open',
		closedReason: null,
		closedAt: null,
		archivedAt: null,
		updatedAt: now
	};
	await putLoop(next);
	await putEvent({
		id: uid('evt'),
		loopId,
		kind: 'reopened',
		body: null,
		meta: null,
		dumpId: null,
		sequence: await nextSequence(loopId),
		createdAt: now
	});
	syncAndRefresh();
	return next;
}

export async function addUpdate(loopId: string, text: string, dumpId: string | null = null) {
	const now = nowIso();
	await putEvent({
		id: uid('evt'),
		loopId,
		kind: 'noted',
		body: text,
		meta: null,
		dumpId,
		sequence: await nextSequence(loopId),
		createdAt: now
	});
	await touchLoop(loopId, now);
	syncAndRefresh();
}

export const addNote = addUpdate;

async function putLoopNote(note: LoopNote) {
	await db.loopNotes.put(note);
	await queue({ table: 'loop_notes', op: 'put', id: note.id, data: note as unknown as Record<string, unknown>, ts: note.updatedAt });
}

export async function addLoopNote(loopId: string, body: string) {
	const now = nowIso();
	const note: LoopNote = {
		id: uid('note'),
		loopId,
		body,
		createdAt: now,
		updatedAt: now
	};
	await putLoopNote(note);
	await touchLoop(loopId, now);
	syncAndRefresh();
	return note;
}

export async function updateLoopNote(noteId: string, body: string) {
	const current = await db.loopNotes.get(noteId);
	if (!current) return null;
	const now = nowIso();
	const next: LoopNote = { ...current, body, updatedAt: now };
	await putLoopNote(next);
	await touchLoop(next.loopId, now);
	syncAndRefresh();
	return next;
}

export async function deleteLoop(loopId: string) {
	const current = await db.loops.get(loopId);
	if (!current) return;
	const now = nowIso();
	await db.loops.delete(loopId);
	await queue({ table: 'loops', op: 'delete', id: loopId, ts: now });
	await putEvent({
		id: uid('evt'),
		loopId,
		kind: 'deleted',
		body: null,
		meta: null,
		dumpId: null,
		sequence: await nextSequence(loopId),
		createdAt: now
	});
	syncAndRefresh();
}

export async function putPerson(input: Omit<Person, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) {
	const person: Person = { id: input.id ?? uid('person'), createdAt: input.createdAt ?? nowIso(), name: input.name, rel: input.rel };
	await db.people.put(person);
	await queue({ table: 'people', op: 'put', id: person.id, data: person as unknown as Record<string, unknown>, ts: person.createdAt });
	await putEvent({
		id: uid('evt'),
		loopId: null,
		kind: 'updated',
		body: `person created: ${person.name}`,
		meta: JSON.stringify({ entity: 'person', personId: person.id }),
		dumpId: null,
		sequence: await nextSequence(null),
		createdAt: nowIso()
	});
	syncAndRefresh();
	return person;
}

export async function updatePerson(personId: string, changes: Partial<Pick<Person, 'name' | 'rel'>>) {
	const current = await db.people.get(personId);
	if (!current) return null;
	const next: Person = {
		...current,
		...changes
	};
	await db.people.put(next);
	await queue({ table: 'people', op: 'put', id: next.id, data: next as unknown as Record<string, unknown>, ts: nowIso() });
	syncAndRefresh();
	return next;
}

const personArchivePrefix = '[archived] ';

export function isArchivedPerson(person: Person) {
	return person.rel.startsWith(personArchivePrefix);
}

export async function archivePerson(personId: string) {
	const current = await db.people.get(personId);
	if (!current) return null;
	if (isArchivedPerson(current)) return current;
	return updatePerson(personId, { rel: `${personArchivePrefix}${current.rel}` });
}

export async function unarchivePerson(personId: string) {
	const current = await db.people.get(personId);
	if (!current) return null;
	if (!isArchivedPerson(current)) return current;
	return updatePerson(personId, { rel: current.rel.replace(personArchivePrefix, '') });
}

export async function deletePerson(personId: string) {
	const now = nowIso();
	const links = await db.loopPeople.where('personId').equals(personId).toArray();
	await db.transaction('rw', [db.people, db.loopPeople], async () => {
		await db.people.delete(personId);
		for (const link of links) {
			await db.loopPeople.delete([link.loopId, link.personId]);
		}
	});
	await queue({ table: 'people', op: 'delete', id: personId, ts: now });
	for (const link of links) {
		await queue({ table: 'loop_person', op: 'delete', id: `${link.loopId}:${link.personId}`, ts: now });
	}
	syncAndRefresh();
}

export async function reassignLoopsAndDeletePerson(personId: string, reassignToPersonId: string | null) {
	if (reassignToPersonId === personId) return;
	const now = nowIso();
	const links = await db.loopPeople.where('personId').equals(personId).toArray();
	if (links.length > 0 && !reassignToPersonId) {
		throw new Error('reassign_required');
	}
	if (reassignToPersonId) {
		const target = await db.people.get(reassignToPersonId);
		if (!target) throw new Error('reassign_target_missing');
	}
	const createdLinks: Array<{ loopId: string; personId: string }> = [];
	await db.transaction('rw', [db.people, db.loopPeople], async () => {
		for (const link of links) {
			if (reassignToPersonId) {
				const existing = await db.loopPeople.get([link.loopId, reassignToPersonId]);
				if (!existing) {
					const nextLink = { loopId: link.loopId, personId: reassignToPersonId };
					await db.loopPeople.put(nextLink);
					createdLinks.push(nextLink);
				}
			}
			await db.loopPeople.delete([link.loopId, link.personId]);
		}
		await db.people.delete(personId);
	});
	await queue({ table: 'people', op: 'delete', id: personId, ts: now });
	for (const link of links) {
		await queue({ table: 'loop_person', op: 'delete', id: `${link.loopId}:${link.personId}`, ts: now });
	}
	for (const link of createdLinks) {
		await queue({
			table: 'loop_person',
			op: 'put',
			id: `${link.loopId}:${link.personId}`,
			data: link as unknown as Record<string, unknown>,
			ts: now
		});
	}
	syncAndRefresh();
}

export async function putProject(input: Omit<Project, 'id' | 'createdAt' | 'archived'> & { id?: string; createdAt?: string; archived?: number }) {
	const project: Project = {
		id: input.id ?? uid('project'),
		name: input.name,
		color: input.color,
		emoji: input.emoji ?? null,
		archived: input.archived ?? 0,
		createdAt: input.createdAt ?? nowIso()
	};
	await db.projects.put(project);
	await queue({ table: 'projects', op: 'put', id: project.id, data: project as unknown as Record<string, unknown>, ts: project.createdAt });
	await putEvent({
		id: uid('evt'),
		loopId: null,
		kind: 'updated',
		body: `project created: ${project.name}`,
		meta: JSON.stringify({ entity: 'project', projectId: project.id }),
		dumpId: null,
		sequence: await nextSequence(null),
		createdAt: nowIso()
	});
	syncAndRefresh();
	return project;
}

export async function updateProject(projectId: string, changes: Partial<Pick<Project, 'name' | 'color' | 'emoji' | 'archived'>>) {
	const current = await db.projects.get(projectId);
	if (!current) return null;
	const next: Project = {
		...current,
		...changes
	};
	await db.projects.put(next);
	await queue({ table: 'projects', op: 'put', id: next.id, data: next as unknown as Record<string, unknown>, ts: nowIso() });
	syncAndRefresh();
	return next;
}

export async function archiveProject(projectId: string) {
	return updateProject(projectId, { archived: 1 });
}

export async function unarchiveProject(projectId: string) {
	return updateProject(projectId, { archived: 0 });
}

export async function deleteProject(projectId: string) {
	const now = nowIso();
	const loopsUsingProject = await db.loops.where('projectId').equals(projectId).toArray();
	await db.transaction('rw', [db.projects, db.loops], async () => {
		await db.projects.delete(projectId);
		for (const loop of loopsUsingProject) {
			const next: Loop = { ...loop, projectId: null, updatedAt: now };
			await db.loops.put(next);
		}
	});
	await queue({ table: 'projects', op: 'delete', id: projectId, ts: now });
	for (const loop of loopsUsingProject) {
		const next = { ...loop, projectId: null, updatedAt: now };
		await queue({ table: 'loops', op: 'put', id: next.id, data: next as unknown as Record<string, unknown>, ts: now });
	}
	syncAndRefresh();
}

export async function putLoopPerson(loopId: string, personId: string) {
	await db.loopPeople.put({ loopId, personId });
	await queue({
		table: 'loop_person',
		op: 'put',
		id: `${loopId}:${personId}`,
		data: { loopId, personId },
		ts: nowIso()
	});
	syncAndRefresh();
}

export async function removeLoopPerson(loopId: string, personId: string) {
	await db.loopPeople.delete([loopId, personId]);
	await queue({
		table: 'loop_person',
		op: 'delete',
		id: `${loopId}:${personId}`,
		ts: nowIso()
	});
	syncAndRefresh();
}

export async function putDump(input: Omit<Dump, 'id' | 'createdAt' | 'processed'> & { id?: string; createdAt?: string; processed?: number }) {
	const dump: Dump = {
		id: input.id ?? uid('dump'),
		raw: input.raw,
		source: input.source,
		transcript: input.transcript ?? null,
		processed: input.processed ?? 0,
		createdAt: input.createdAt ?? nowIso()
	};
	await db.dumps.put(dump);
	await queue({ table: 'dumps', op: 'put', id: dump.id, data: dump as unknown as Record<string, unknown>, ts: dump.createdAt });
	syncAndRefresh();
	return dump;
}

export async function putSuggestion(input: Omit<SuggestionRecord, 'id' | 'createdAt' | 'resolvedAt' | 'status'> & { id?: string }) {
	const now = nowIso();
	const suggestion: SuggestionRecord = {
		id: input.id ?? uid('sg'),
		dumpId: input.dumpId,
		action: input.action,
		payload: input.payload,
		status: 'pending',
		createdAt: now,
		resolvedAt: null
	};
	await db.suggestions.put(suggestion);
	await queue({ table: 'suggestions', op: 'put', id: suggestion.id, data: suggestion as unknown as Record<string, unknown>, ts: now });
	syncAndRefresh();
	return suggestion;
}

export async function putSuggestionsForDump(dumpId: string | null, suggestions: SuggestedAction[]) {
	const records = await Promise.all(
		suggestions.map((item) => putSuggestion({ dumpId, action: item.action, payload: JSON.stringify(item) }))
	);
	return records;
}

export async function setSuggestionStatus(suggestionId: string, status: 'accepted' | 'dismissed') {
	const current = await db.suggestions.get(suggestionId);
	if (!current) return;
	const next: SuggestionRecord = { ...current, status, resolvedAt: nowIso() };
	await db.suggestions.put(next);
	await queue({
		table: 'suggestions',
		op: 'put',
		id: next.id,
		data: next as unknown as Record<string, unknown>,
		ts: next.resolvedAt ?? nowIso()
	});
	syncAndRefresh();
}
