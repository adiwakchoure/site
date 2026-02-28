import Dexie, { type Table } from 'dexie';
import type { Dump, Loop, LoopEvent, LoopPerson, Person, Project, SuggestionRecord, SyncOp } from '$types/models';

export class EngramDB extends Dexie {
	loops!: Table<Loop>;
	events!: Table<LoopEvent>;
	people!: Table<Person>;
	projects!: Table<Project>;
	dumps!: Table<Dump>;
	suggestions!: Table<SuggestionRecord>;
	loopPeople!: Table<LoopPerson>;
	syncQueue!: Table<SyncOp, number>;
	meta!: Table<{ key: string; value: string }, string>;

	constructor() {
		super('engram');
		this.version(3).stores({
			loops: 'id, state, energy, priority, deadline, projectId, parentId, updatedAt, createdAt, closedAt, archivedAt',
			events: 'id, loopId, kind, dumpId, sequence, createdAt',
			people: 'id, name, createdAt',
			projects: 'id, name, archived, createdAt',
			dumps: 'id, processed, createdAt',
			suggestions: 'id, dumpId, status, action, createdAt, resolvedAt',
			loopPeople: '[loopId+personId], loopId, personId, role',
			syncQueue: '++seq, table, op, id, ts',
			meta: 'key'
		});
	}
}

export const db = new EngramDB();
