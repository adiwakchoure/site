import { browser } from '$app/environment';
import { liveQuery } from 'dexie';
import { readable, writable } from 'svelte/store';
import { db } from '$db/schema';
import type { SuggestedAction } from '$types/models';
import type { Dump, Loop, LoopEvent, LoopNote, LoopView, SuggestionRecord, Tag, TagType } from '$types/models';

function fromLiveQuery<T>(producer: () => Promise<T>) {
	return readable<T | null>(null, (set) => {
		if (!browser) return () => {};
		const sub = liveQuery(producer).subscribe({
			next: (value) => set(value),
			error: () => set(null)
		});
		return () => sub.unsubscribe();
	});
}

export const loopsStore = fromLiveQuery(() => db.loops.toArray());
export const eventsStore = fromLiveQuery(() => db.events.toArray());
export const loopNotesStore = fromLiveQuery(() => db.loopNotes.toArray());
export const tagTypesStore = fromLiveQuery(() => db.tagTypes.toArray());
export const tagsStore = fromLiveQuery(() => db.tags.toArray());
export const dumpsStore = fromLiveQuery(() => db.dumps.toArray());
export const suggestionRecordsStore = fromLiveQuery(() => db.suggestions.toArray());
export const pendingSyncStore = fromLiveQuery(() => db.syncQueue.count());

interface FullSnapshot {
	loops: Loop[];
	events: LoopEvent[];
	loopNotes: LoopNote[];
	tagTypes: TagType[];
	tags: Tag[];
	dumps: Dump[];
	suggestions: SuggestionRecord[];
	serverTime: string;
}

export async function refreshFromServer(): Promise<boolean> {
	if (!browser) return false;
	try {
		const res = await window.fetch('/api/data');
		if (!res.ok) return false;
		const data: FullSnapshot = await res.json();
		await db.transaction(
			'rw',
			[db.loops, db.events, db.loopNotes, db.tagTypes, db.tags, db.dumps, db.suggestions, db.meta],
			async () => {
				await db.loops.clear();
				await db.loops.bulkPut(data.loops);
				await db.events.clear();
				await db.events.bulkPut(data.events);
				await db.loopNotes.clear();
				await db.loopNotes.bulkPut(data.loopNotes);
				await db.tagTypes.clear();
				await db.tagTypes.bulkPut(data.tagTypes);
				await db.tags.clear();
				await db.tags.bulkPut(data.tags);
				await db.dumps.clear();
				await db.dumps.bulkPut(data.dumps);
				await db.suggestions.clear();
				await db.suggestions.bulkPut(data.suggestions);
				await db.meta.put({ key: 'lastSync', value: data.serverTime });
			}
		);
		return true;
	} catch {
		return false;
	}
}

export const activeFilter = writable<'open' | 'overdue' | 'closed' | 'all'>('open');
export const loopSort = writable<'age' | 'priority' | 'deadline'>('age');
export const navFilterSheetNonce = writable(0);
export const navFilterActiveByRoute = writable<Record<string, boolean>>({});
export const suggestionsStore = writable<SuggestedAction[]>([]);
export const syncState = writable<'synced' | 'syncing' | 'pending' | 'offline' | 'error'>('synced');
export const parsePhase = writable<'idle' | 'transcribing' | 'parsing' | 'suggesting'>('idle');
export const transcriptStore = writable<{ text: string; source: 'text' | 'voice'; at: string } | null>(null);
export const activeInsightStore = writable<{ openCount: number; overdueCount: number } | null>(null);
export const suggestionContextStore = writable<{ dumpId: string | null }>({ dumpId: null });

type DerivedLoopMeta = {
	state: LoopView['state'];
	closedReason: LoopView['closedReason'];
	priority: LoopView['priority'];
	energy: LoopView['energy'];
	deadline: string | null;
	project: string | null;
	parentId: string | null;
	people: string[];
};

const DEFAULT_META: DerivedLoopMeta = {
	state: 'open',
	closedReason: null,
	priority: 'P1',
	energy: 'active',
	deadline: null,
	project: null,
	parentId: null,
	people: []
};

export function deriveLoopViews(loops: Loop[], tags: Tag[], tagTypes: TagType[]): LoopView[] {
	const typeById = new Map(tagTypes.map((type) => [type.id, type.slug]));
	const metaByLoop = new Map<string, DerivedLoopMeta>();
	for (const tag of tags) {
		const slug = typeById.get(tag.tagTypeId);
		if (!slug) continue;
		const meta = metaByLoop.get(tag.loopId) ?? { ...DEFAULT_META, people: [] };
		const textValue = tag.valueText ?? tag.valueDate ?? null;
		if (slug === 'state' && (textValue === 'open' || textValue === 'closed')) meta.state = textValue;
		else if (slug === 'closed_reason' && textValue) meta.closedReason = textValue as LoopView['closedReason'];
		else if (slug === 'priority' && (textValue === 'P0' || textValue === 'P1' || textValue === 'P2')) meta.priority = textValue;
		else if (slug === 'energy' && (textValue === 'active' || textValue === 'waiting' || textValue === 'someday')) meta.energy = textValue;
		else if (slug === 'deadline') meta.deadline = tag.valueDate ?? null;
		else if (slug === 'project') meta.project = textValue;
		else if (slug === 'parent') meta.parentId = textValue;
		else if (slug === 'person' && textValue) meta.people = [...meta.people, textValue];
		metaByLoop.set(tag.loopId, meta);
	}

	return loops.map((loop) => {
		const meta = metaByLoop.get(loop.id) ?? DEFAULT_META;
		return {
			...loop,
			state: loop.closedAt ? 'closed' : meta.state,
			closedReason: meta.closedReason,
			priority: meta.priority,
			energy: meta.energy,
			deadline: meta.deadline,
			project: meta.project,
			parentId: meta.parentId,
			people: meta.people
		};
	});
}

export const loopViewsStore = fromLiveQuery(async () => {
	const [loops, tags, tagTypes] = await Promise.all([db.loops.toArray(), db.tags.toArray(), db.tagTypes.toArray()]);
	return deriveLoopViews(loops, tags, tagTypes);
});
