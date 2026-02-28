import { liveQuery } from 'dexie';
import { db } from '$db/schema';
import type { ClosedReason, Dump, Loop, LoopEnergy, LoopEvent, LoopPersonRole, LoopPriority, Person, Project, SyncOp } from '$types/models';
import { uid } from '$lib/utils';

const nowIso = () => new Date().toISOString();

const queue = async (op: Omit<SyncOp, 'seq'>) => db.syncQueue.add(op);

async function putEvent(event: LoopEvent) {
	await db.events.put(event);
	await queue({ table: 'events', op: 'put', id: event.id, data: event as unknown as Record<string, unknown>, ts: event.createdAt });
}

async function putLoop(loop: Loop) {
	await db.loops.put(loop);
	await queue({ table: 'loops', op: 'put', id: loop.id, data: loop as unknown as Record<string, unknown>, ts: loop.updatedAt });
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
			projectId: loop.projectId
		}),
		dumpId: input.dumpId ?? null,
		createdAt: now
	});
	return loop;
}

export async function updateLoop(loopId: string, changes: Partial<Pick<Loop, 'title' | 'body' | 'priority' | 'energy' | 'deadline' | 'projectId' | 'tags'>>) {
	const current = await db.loops.get(loopId);
	if (!current) return null;
	const now = nowIso();
	const next: Loop = { ...current, ...changes, updatedAt: now };
	await putLoop(next);
	await putEvent({
		id: uid('evt'),
		loopId,
		kind: 'updated',
		body: Object.entries(changes)
			.map(([key, val]) => `${key} -> ${String(val ?? '')}`)
			.join(', '),
		meta: JSON.stringify(changes),
		dumpId: null,
		createdAt: now
	});
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
		createdAt: now
	});
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
		createdAt: now
	});
	return next;
}

export async function addNote(loopId: string, text: string, dumpId: string | null = null) {
	const now = nowIso();
	await putEvent({
		id: uid('evt'),
		loopId,
		kind: 'noted',
		body: text,
		meta: null,
		dumpId,
		createdAt: now
	});
	await updateLoop(loopId, {});
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
		createdAt: nowIso()
	});
	return person;
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
		createdAt: nowIso()
	});
	return project;
}

export async function putLoopPerson(loopId: string, personId: string, role: LoopPersonRole = 'involved') {
	await db.loopPeople.put({ loopId, personId, role });
	await queue({
		table: 'loop_person',
		op: 'put',
		id: `${loopId}:${personId}`,
		data: { loopId, personId, role },
		ts: nowIso()
	});
}

export async function putDump(input: Omit<Dump, 'id' | 'createdAt' | 'processed'> & { id?: string; createdAt?: string; processed?: number }) {
	const dump: Dump = {
		id: input.id ?? uid('dump'),
		raw: input.raw,
		processed: input.processed ?? 0,
		createdAt: input.createdAt ?? nowIso()
	};
	await db.dumps.put(dump);
	await queue({ table: 'dumps', op: 'put', id: dump.id, data: dump as unknown as Record<string, unknown>, ts: dump.createdAt });
	return dump;
}

export const liveLoops = () => liveQuery(() => db.loops.toArray());
export const liveEvents = () => liveQuery(() => db.events.toArray());
export const livePeople = () => liveQuery(() => db.people.toArray());
export const liveProjects = () => liveQuery(() => db.projects.toArray());
export const liveDumps = () => liveQuery(() => db.dumps.toArray());
export const liveLoopPeople = () => liveQuery(() => db.loopPeople.toArray());
