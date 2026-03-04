import Dexie, { type Table } from 'dexie';
import type { Dump, Loop, LoopEvent, LoopNote, SuggestionRecord, SyncOp, Tag, TagType } from '$types/models';

export class EngramDB extends Dexie {
	loops!: Table<Loop>;
	events!: Table<LoopEvent>;
	loopNotes!: Table<LoopNote>;
	tagTypes!: Table<TagType>;
	tags!: Table<Tag>;
	dumps!: Table<Dump>;
	suggestions!: Table<SuggestionRecord>;
	syncQueue!: Table<SyncOp, number>;
	meta!: Table<{ key: string; value: string }, string>;

	constructor() {
		super('engram');
		this.version(6).stores({
			loops: 'id, title, openedAt, closedAt, updatedAt',
			events: 'id, loopId, kind, dumpId, sequence, createdAt',
			loopNotes: 'id, loopId, createdAt, updatedAt',
			tagTypes: 'id, slug, name, valueKind, multi, system, createdAt',
			tags: 'id, loopId, tagTypeId, valueText, valueDate, updatedAt',
			dumps: 'id, processed, createdAt',
			suggestions: 'id, dumpId, status, action, createdAt, resolvedAt',
			syncQueue: '++seq, table, op, id, ts',
			meta: 'key'
		});
	}
}

export const db = new EngramDB();
