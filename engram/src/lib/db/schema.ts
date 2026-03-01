import Dexie, { type Table } from 'dexie';
import type { Dump, Loop, LoopEvent, LoopNote, LoopPerson, Person, Project, SuggestionRecord, SyncOp } from '$types/models';

export class EngramDB extends Dexie {
	loops!: Table<Loop>;
	events!: Table<LoopEvent>;
	loopNotes!: Table<LoopNote>;
	people!: Table<Person>;
	projects!: Table<Project>;
	dumps!: Table<Dump>;
	suggestions!: Table<SuggestionRecord>;
	loopPeople!: Table<LoopPerson>;
	syncQueue!: Table<SyncOp, number>;
	meta!: Table<{ key: string; value: string }, string>;

	constructor() {
		super('engram');
		this.version(4).stores({
			loops: 'id, state, energy, priority, deadline, projectId, parentId, updatedAt, createdAt, closedAt, archivedAt',
			events: 'id, loopId, kind, dumpId, sequence, createdAt',
			loopNotes: 'id, loopId, createdAt, updatedAt',
			people: 'id, name, createdAt',
			projects: 'id, name, archived, createdAt',
			dumps: 'id, processed, createdAt',
			suggestions: 'id, dumpId, status, action, createdAt, resolvedAt',
			loopPeople: '[loopId+personId], loopId, personId, role',
			syncQueue: '++seq, table, op, id, ts',
			meta: 'key'
		});
		this.version(5)
			.stores({
				loops: 'id, state, energy, priority, deadline, projectId, parentId, updatedAt, createdAt, closedAt, archivedAt',
				events: 'id, loopId, kind, dumpId, sequence, createdAt',
				loopNotes: 'id, loopId, createdAt, updatedAt',
				people: 'id, name, createdAt',
				projects: 'id, name, archived, createdAt',
				dumps: 'id, processed, createdAt',
				suggestions: 'id, dumpId, status, action, createdAt, resolvedAt',
				loopPeople: '[loopId+personId], loopId, personId',
				syncQueue: '++seq, table, op, id, ts',
				meta: 'key'
			})
			.upgrade(async (tx) => {
				await tx.table('loopPeople').toCollection().modify((row: Record<string, unknown>) => {
					delete row.role;
				});
			});
	}
}

export const db = new EngramDB();
