import { db } from '$db/schema';
import type { SyncOp } from '$types/models';

interface SyncResponse {
	serverTime: string;
	changes: SyncOp[];
}

const TABLE_MAP = {
	loops: db.loops,
	events: db.events,
	people: db.people,
	projects: db.projects,
	dumps: db.dumps,
	loop_person: db.loopPeople
} as const;

export async function syncNow() {
	const pending = await db.syncQueue.orderBy('seq').limit(200).toArray();
	const lastSync = (await db.meta.get('lastSync'))?.value ?? new Date(0).toISOString();

	const res = await fetch('/api/sync', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ lastSync, changes: pending })
	});

	if (!res.ok) throw new Error(`Sync failed: ${res.status}`);

	const payload = (await res.json()) as SyncResponse;
	await db.transaction(
		'rw',
		[db.syncQueue, db.meta, db.loops, db.events, db.people, db.projects, db.dumps, db.loopPeople],
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
