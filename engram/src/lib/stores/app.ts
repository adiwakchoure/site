import { browser } from '$app/environment';
import { liveQuery } from 'dexie';
import { readable, writable } from 'svelte/store';
import { db } from '$db/schema';
import type { SuggestedAction } from '$types/models';
import type { Loop, LoopEvent, LoopNote, Person, Project, Dump, SuggestionRecord, LoopPerson } from '$types/models';

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
export const peopleStore = fromLiveQuery(() => db.people.toArray());
export const projectsStore = fromLiveQuery(() => db.projects.toArray());
export const dumpsStore = fromLiveQuery(() => db.dumps.toArray());
export const loopPeopleStore = fromLiveQuery(() => db.loopPeople.toArray());
export const suggestionRecordsStore = fromLiveQuery(() => db.suggestions.toArray());
export const pendingSyncStore = fromLiveQuery(() => db.syncQueue.count());

interface FullSnapshot {
	loops: Loop[];
	events: LoopEvent[];
	loopNotes: LoopNote[];
	people: Person[];
	projects: Project[];
	dumps: Dump[];
	suggestions: SuggestionRecord[];
	loopPeople: LoopPerson[];
	serverTime: string;
}

export async function refreshFromServer(): Promise<boolean> {
	if (!browser) return false;
	try {
		const res = await fetch('/api/data');
		if (!res.ok) return false;
		const data: FullSnapshot = await res.json();
		await db.transaction(
			'rw',
			[db.loops, db.events, db.loopNotes, db.people, db.projects, db.dumps, db.suggestions, db.loopPeople, db.meta],
			async () => {
				await db.loops.clear();
				await db.loops.bulkPut(data.loops);
				await db.events.clear();
				await db.events.bulkPut(data.events);
				await db.loopNotes.clear();
				await db.loopNotes.bulkPut(data.loopNotes);
				await db.people.clear();
				await db.people.bulkPut(data.people);
				await db.projects.clear();
				await db.projects.bulkPut(data.projects);
				await db.dumps.clear();
				await db.dumps.bulkPut(data.dumps);
				await db.suggestions.clear();
				await db.suggestions.bulkPut(data.suggestions);
				await db.loopPeople.clear();
				await db.loopPeople.bulkPut(data.loopPeople);
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
export const suggestionsStore = writable<SuggestedAction[]>([]);
export const syncState = writable<'synced' | 'syncing' | 'pending' | 'offline' | 'error'>('synced');
export const parsePhase = writable<'idle' | 'transcribing' | 'parsing' | 'suggesting'>('idle');
export const transcriptStore = writable<{ text: string; source: 'text' | 'voice'; at: string } | null>(null);
export const activeInsightStore = writable<{ openCount: number; overdueCount: number } | null>(null);
export const suggestionContextStore = writable<{ dumpId: string | null }>({ dumpId: null });
