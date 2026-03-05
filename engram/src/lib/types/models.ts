export type LoopState = 'open' | 'closed' | 'archived';
export type LoopPriority = 'P0' | 'P1' | 'P2';
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
	priority: LoopPriority;
	deadline: string | null;
	project: string | null;
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
export type SuggestionConfidence = 'high' | 'medium' | 'low';

export interface SuggestedLoopChanges {
	title?: string;
	content?: string | null;
	priority?: LoopPriority | null;
	deadline?: string | null;
	project?: string | null;
}

export interface SuggestionMutationTagPatch {
	slug: string;
	value: string | null;
	multi?: boolean;
	valueKind?: TagValueKind;
}

export interface SuggestionMutationPlan {
	kind: 'create_loop' | 'update_loop' | 'close_loop' | 'add_note' | 'set_tag';
	loopId?: string;
	loopTitleHint?: string;
	title?: string;
	content?: string | null;
	noteText?: string;
	closeLoop?: boolean;
	changes?: SuggestedLoopChanges;
	tags?: SuggestionMutationTagPatch[];
	confidence?: SuggestionConfidence;
}

export interface SuggestionApplyResult {
	applied: boolean;
	reason?: string;
	loopId?: string;
}

interface SuggestedActionBase {
	suggestionId?: string;
	action: SuggestionAction;
	loopId?: string;
	title?: string;
	content?: string | null;
	priority?: LoopPriority;
	deadline?: string | null;
	project?: string | null;
	people?: string[];
	tags?: string[];
	text?: string;
	changes?: SuggestedLoopChanges;
	tagTypeSlug?: string;
	tagValue?: string | null;
	confidence?: SuggestionConfidence;
}

export type SuggestedAction =
	| (SuggestedActionBase & {
			action: 'open_loop';
			title: string;
			content?: string | null;
			priority?: LoopPriority;
			deadline?: string | null;
			project?: string | null;
	  })
	| (SuggestedActionBase & {
			action: 'close_loop';
			loopId?: string;
			title?: string;
	  })
	| (SuggestedActionBase & {
			action: 'add_note';
			text: string;
			loopId?: string;
			title?: string;
	  })
	| (SuggestedActionBase & {
			action: 'update_loop';
			loopId?: string;
			title?: string;
			changes?: SuggestedLoopChanges;
			priority?: LoopPriority;
			deadline?: string | null;
			project?: string | null;
			content?: string | null;
	  })
	| (SuggestedActionBase & {
			action: 'tag_loop';
			loopId?: string;
			title?: string;
			tagTypeSlug: string;
			tagValue?: string | null;
	  });

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
