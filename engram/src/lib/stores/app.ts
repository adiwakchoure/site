import { browser } from '$app/environment';
import { liveQuery } from 'dexie';
import { readable, writable } from 'svelte/store';
import { db } from '$db/schema';
import type { SuggestedAction } from '$types/models';

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
export const peopleStore = fromLiveQuery(() => db.people.toArray());
export const projectsStore = fromLiveQuery(() => db.projects.toArray());
export const dumpsStore = fromLiveQuery(() => db.dumps.toArray());
export const loopPeopleStore = fromLiveQuery(() => db.loopPeople.toArray());
export const pendingSyncStore = fromLiveQuery(() => db.syncQueue.count());

export const activeFilter = writable<'open' | 'overdue' | 'all'>('open');
export const loopSort = writable<'age' | 'priority' | 'deadline'>('age');
export const suggestionsStore = writable<SuggestedAction[]>([]);
export const syncState = writable<'synced' | 'syncing' | 'pending' | 'offline' | 'error'>('synced');
export const parsePhase = writable<'idle' | 'transcribing' | 'parsing' | 'suggesting'>('idle');
export const transcriptStore = writable<{ text: string; source: 'text' | 'voice'; at: string } | null>(null);
export const activeInsightStore = writable<{ openCount: number; overdueCount: number } | null>(null);
export const suggestionContextStore = writable<{ dumpId: string | null }>({ dumpId: null });
