export type LoopState = 'open' | 'closed';
export type LoopEnergy = 'active' | 'waiting' | 'someday';
export type LoopPriority = 'P0' | 'P1' | 'P2';
export type ClosedReason = 'done' | 'dropped' | 'delegated' | 'irrelevant';
export type LoopPersonRole = 'involved' | 'waiting_on' | 'delegated_to';
export type EventKind = 'created' | 'closed' | 'reopened' | 'updated' | 'noted';

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
	updatedAt: string;
}

export interface LoopEvent {
	id: string;
	loopId: string | null;
	kind: EventKind;
	body: string | null;
	meta: string | null;
	dumpId: string | null;
	createdAt: string;
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
	role: LoopPersonRole;
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
	processed: number;
	createdAt: string;
}

export type SuggestionAction = 'open_loop' | 'close_loop' | 'add_note' | 'update_loop' | 'create_person' | 'create_project';

export interface SuggestedAction {
	action: SuggestionAction;
	loopId?: string;
	title?: string;
	priority?: LoopPriority;
	energy?: LoopEnergy;
	deadline?: string | null;
	project?: string | null;
	people?: Array<{ name: string; role: LoopPersonRole }>;
	tags?: string[];
	reason?: ClosedReason;
	text?: string;
	changes?: Record<string, string | null>;
	name?: string;
	rel?: string;
	color?: string;
	confidence?: 'high' | 'medium' | 'low';
}

export type SyncTable = 'loops' | 'events' | 'people' | 'loop_person' | 'projects' | 'dumps';

export interface SyncOp {
	seq?: number;
	table: SyncTable;
	op: 'put' | 'delete';
	id: string;
	data?: Record<string, unknown>;
	ts: string;
}
