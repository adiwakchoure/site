export type LoopState = 'open' | 'closed';
export type LoopEnergy = 'active' | 'waiting' | 'someday';
export type LoopPriority = 'P0' | 'P1' | 'P2';
export type ClosedReason = 'done' | 'dropped' | 'delegated' | 'irrelevant';
export type EventKind = 'created' | 'closed' | 'reopened' | 'updated' | 'noted' | 'deleted';
export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed';

export interface Loop {
	id: string;
	title: string;
	body: string;
	state: LoopState;
	closedReason: ClosedReason | null;
	energy: LoopEnergy;
	priority: LoopPriority;
	deadline: string | null;
	projectId: string | null;
	parentId: string | null;
	tags: string;
	createdAt: string;
	closedAt: string | null;
	archivedAt: string | null;
	updatedAt: string;
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

export interface Person {
	id: string;
	name: string;
	rel: string;
	createdAt: string;
}

export interface LoopPerson {
	loopId: string;
	personId: string;
}

export interface Project {
	id: string;
	name: string;
	color: string;
	emoji: string | null;
	archived: number;
	createdAt: string;
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

export type SuggestionAction = 'open_loop' | 'close_loop' | 'add_note' | 'update_loop' | 'create_person' | 'create_project';

export interface SuggestedAction {
	suggestionId?: string;
	action: SuggestionAction;
	loopId?: string;
	title?: string;
	priority?: LoopPriority;
	energy?: LoopEnergy;
	deadline?: string | null;
	project?: string | null;
	people?: Array<{ name: string; rel?: string }>;
	tags?: string[];
	reason?: ClosedReason;
	text?: string;
	changes?: Record<string, string | null>;
	name?: string;
	rel?: string;
	color?: string;
	confidence?: 'high' | 'medium' | 'low';
}

export type SyncTable = 'loops' | 'events' | 'people' | 'loop_person' | 'projects' | 'dumps' | 'loop_notes';
export type SyncTableV2 = SyncTable | 'suggestions';

export interface SyncOp {
	seq?: number;
	table: SyncTableV2;
	op: 'put' | 'delete';
	id: string;
	data?: Record<string, unknown>;
	ts: string;
}
