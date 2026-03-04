export type LoopState = 'open' | 'closed';
export type LoopEnergy = 'active' | 'waiting' | 'someday';
export type LoopPriority = 'P0' | 'P1' | 'P2';
export type ClosedReason = 'done' | 'dropped' | 'delegated' | 'irrelevant';
export type EventKind = 'created' | 'closed' | 'reopened' | 'updated' | 'noted' | 'deleted';
export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed';
export type TagValueKind = 'text' | 'number' | 'date' | 'json';

export interface Loop {
	id: string;
	title: string;
	content: string | null;
	openedAt: string;
	closedAt: string | null;
	updatedAt: string;
}

// Derived, UI-level shape computed from Loop + tags.
export interface LoopView extends Loop {
	state: LoopState;
	closedReason: ClosedReason | null;
	energy: LoopEnergy;
	priority: LoopPriority;
	deadline: string | null;
	project: string | null;
	parentId: string | null;
	people: string[];
}

export interface LoopEvent {
	id: string;
	loopId: string | null;
	kind: EventKind;
	body: string | null;
	meta: string | null;
	dumpId: string | null;
	sequence: number;
	createdAt: string;
}

export interface LoopNote {
	id: string;
	loopId: string;
	body: string;
	createdAt: string;
	updatedAt: string;
}

export interface TagType {
	id: string;
	slug: string;
	name: string;
	valueKind: TagValueKind;
	multi: number;
	system: number;
	createdAt: string;
}

export interface Tag {
	id: string;
	loopId: string;
	tagTypeId: string;
	valueText: string | null;
	valueNumber: number | null;
	valueDate: string | null;
	valueJson: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface Dump {
	id: string;
	raw: string;
	transcript: string | null;
	source: 'text' | 'voice';
	processed: number;
	createdAt: string;
}

export interface SuggestionRecord {
	id: string;
	dumpId: string | null;
	action: SuggestionAction;
	payload: string;
	status: SuggestionStatus;
	createdAt: string;
	resolvedAt: string | null;
}

export type SuggestionAction = 'open_loop' | 'close_loop' | 'add_note' | 'update_loop' | 'tag_loop';

export interface SuggestedAction {
	suggestionId?: string;
	action: SuggestionAction;
	loopId?: string;
	title?: string;
	content?: string | null;
	priority?: LoopPriority;
	energy?: LoopEnergy;
	deadline?: string | null;
	project?: string | null;
	people?: string[];
	parentId?: string | null;
	tags?: string[];
	reason?: ClosedReason;
	text?: string;
	changes?: Record<string, string | null>;
	tagTypeSlug?: string;
	tagValue?: string | null;
	confidence?: 'high' | 'medium' | 'low';
}

export type SyncTable = 'loops' | 'events' | 'dumps' | 'loop_notes' | 'tag_types' | 'tags';
export type SyncTableV2 = SyncTable | 'suggestions';

export interface SyncOp {
	seq?: number;
	table: SyncTableV2;
	op: 'put' | 'delete';
	id: string;
	data?: Record<string, unknown>;
	ts: string;
}
