import { db } from '$db/schema';
import { browser } from '$app/environment';
import type { SyncOp } from '$types/models';

interface SyncResponse {
	serverTime: string;
	changes: SyncOp[];
}

const TABLE_MAP = {
	loops: db.loops,
	events: db.events,
	loop_notes: db.loopNotes,
	people: db.people,
	projects: db.projects,
	dumps: db.dumps,
	suggestions: db.suggestions,
	loop_person: db.loopPeople
} as const;

export async function syncNow() {
	if (!browser) return;
	const pending = await db.syncQueue.orderBy('seq').limit(200).toArray();
	const lastSync = (await db.meta.get('lastSync'))?.value ?? new Date(0).toISOString();

	const res = await window.fetch('/api/sync', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ lastSync, changes: pending })
	});

	if (!res.ok) throw new Error(`Sync failed: ${res.status}`);

	const payload = (await res.json()) as SyncResponse;
	await db.transaction(
		'rw',
		[db.syncQueue, db.meta, db.loops, db.events, db.loopNotes, db.people, db.projects, db.dumps, db.suggestions, db.loopPeople],
		async () => {
			if (pending.length > 0) {
				const seqs = pending.map((p) => p.seq).filter((v): v is number => typeof v === 'number');
				await db.syncQueue.bulkDelete(seqs);
			}

			for (const change of payload.changes) {
				const table = TABLE_MAP[change.table];
				if (!table) continue;
				if (change.op === 'delete') {
					if (change.table === 'loop_person') {
						const [loopId, personId] = change.id.split(':');
						if (loopId && personId) await db.loopPeople.delete([loopId, personId]);
					} else {
						await table.delete(change.id);
					}
				} else if (change.data) {
					await table.put(change.data as never);
				}
			}

			await db.meta.put({ key: 'lastSync', value: payload.serverTime });
		}
	);
}
