import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { ensureD1Schema } from '$db/bootstrap';
import { normalizeForDb, normalizeForClient, rowExists, normalizeForeignKeys } from '$db/d1';

const changeSchema = z.object({
	table: z.enum(['loops', 'events', 'loop_notes', 'people', 'projects', 'dumps', 'suggestions', 'loop_person']),
	op: z.enum(['put', 'delete']),
	id: z.string(),
	data: z.record(z.string(), z.unknown()).optional(),
	ts: z.string()
});

const payloadSchema = z.object({
	lastSync: z.string(),
	changes: z.array(changeSchema).default([])
});

const tablePrimaryKey = {
	loops: 'id',
	events: 'id',
	loop_notes: 'id',
	people: 'id',
	projects: 'id',
	dumps: 'id',
	suggestions: 'id',
	loop_person: 'loop_id'
} as const;

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;
	if (!env?.DB) return json({ error: 'D1 binding missing' }, { status: 500 });
	await ensureD1Schema(env as App.Platform['env'] | undefined);

	const parsed = payloadSchema.safeParse(await request.json());
	if (!parsed.success) return json({ error: 'Invalid sync payload' }, { status: 400 });

	const { changes, lastSync } = parsed.data;
	const now = new Date().toISOString();

	for (const change of changes) {
		if (change.op === 'delete') {
			if (change.table === 'loop_person') {
				const [loopId, personId] = change.id.split(':');
				if (loopId && personId) {
					await env.DB.prepare('DELETE FROM loop_person WHERE loop_id = ? AND person_id = ?').bind(loopId, personId).run();
				}
			} else {
				const pk = tablePrimaryKey[change.table];
				await env.DB.prepare(`DELETE FROM ${change.table} WHERE ${pk} = ?`).bind(change.id).run();
			}
		} else if (change.data) {
			const dbData = normalizeForDb(change.data);
			await normalizeForeignKeys(env as App.Platform['env'], change.table as string, dbData);
			const keys = Object.keys(dbData);
			const values = Object.values(dbData);
			const placeholders = keys.map(() => '?').join(', ');
			if (change.table === 'loop_person') {
				const hasLoop = await rowExists(env as App.Platform['env'], 'loops', dbData.loop_id);
				const hasPerson = await rowExists(env as App.Platform['env'], 'people', dbData.person_id);
				if (!hasLoop || !hasPerson) continue;
				const onConflict = keys.filter((k) => !['loop_id', 'person_id'].includes(k)).map((k) => `${k}=excluded.${k}`).join(', ');
				const sql = `INSERT INTO loop_person (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT(loop_id, person_id) DO UPDATE SET ${onConflict || 'role=excluded.role'}`;
				await env.DB.prepare(sql).bind(...values).run();
			} else if (change.table === 'loop_notes') {
				const hasLoop = await rowExists(env as App.Platform['env'], 'loops', dbData.loop_id);
				if (!hasLoop) continue;
				const onConflict = keys.filter((k) => k !== 'id').map((k) => `${k}=excluded.${k}`).join(', ');
				const sql = `INSERT INTO loop_notes (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${onConflict}`;
				await env.DB.prepare(sql).bind(...values).run();
			} else {
				const onConflict = keys.filter((k) => k !== 'id').map((k) => `${k}=excluded.${k}`).join(', ');
				const sql = `INSERT INTO ${change.table} (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${onConflict}`;
				await env.DB.prepare(sql).bind(...values).run();
			}
		}
	}

	const outgoing: Array<{ table: string; op: 'put' | 'delete'; id: string; data?: Record<string, unknown>; ts: string }> = [];
	const loops = await env.DB.prepare('SELECT * FROM loops WHERE updated_at > ? ORDER BY updated_at ASC LIMIT 200').bind(lastSync).all();
	for (const row of loops.results ?? []) {
		outgoing.push({ table: 'loops', op: 'put', id: String((row as Record<string, unknown>).id), data: normalizeForClient(row as Record<string, unknown>), ts: String((row as Record<string, unknown>).updated_at) });
	}
	const events = await env.DB.prepare('SELECT * FROM events WHERE created_at > ? ORDER BY created_at ASC LIMIT 400').bind(lastSync).all();
	for (const row of events.results ?? []) {
		outgoing.push({ table: 'events', op: 'put', id: String((row as Record<string, unknown>).id), data: normalizeForClient(row as Record<string, unknown>), ts: String((row as Record<string, unknown>).created_at) });
	}
	const loopNotes = await env.DB.prepare('SELECT * FROM loop_notes WHERE updated_at > ? ORDER BY updated_at ASC LIMIT 300').bind(lastSync).all();
	for (const row of loopNotes.results ?? []) {
		outgoing.push({
			table: 'loop_notes',
			op: 'put',
			id: String((row as Record<string, unknown>).id),
			data: normalizeForClient(row as Record<string, unknown>),
			ts: String((row as Record<string, unknown>).updated_at)
		});
	}
	const people = await env.DB.prepare('SELECT * FROM people WHERE created_at > ? ORDER BY created_at ASC LIMIT 100').bind(lastSync).all();
	for (const row of people.results ?? []) {
		outgoing.push({ table: 'people', op: 'put', id: String((row as Record<string, unknown>).id), data: normalizeForClient(row as Record<string, unknown>), ts: String((row as Record<string, unknown>).created_at) });
	}
	const projects = await env.DB.prepare('SELECT * FROM projects WHERE created_at > ? ORDER BY created_at ASC LIMIT 100').bind(lastSync).all();
	for (const row of projects.results ?? []) {
		outgoing.push({ table: 'projects', op: 'put', id: String((row as Record<string, unknown>).id), data: normalizeForClient(row as Record<string, unknown>), ts: String((row as Record<string, unknown>).created_at) });
	}
	const dumps = await env.DB.prepare('SELECT * FROM dumps WHERE created_at > ? ORDER BY created_at ASC LIMIT 100').bind(lastSync).all();
	for (const row of dumps.results ?? []) {
		outgoing.push({ table: 'dumps', op: 'put', id: String((row as Record<string, unknown>).id), data: normalizeForClient(row as Record<string, unknown>), ts: String((row as Record<string, unknown>).created_at) });
	}
	const suggestions = await env.DB.prepare('SELECT * FROM suggestions WHERE created_at > ? ORDER BY created_at ASC LIMIT 200').bind(lastSync).all();
	for (const row of suggestions.results ?? []) {
		outgoing.push({
			table: 'suggestions',
			op: 'put',
			id: String((row as Record<string, unknown>).id),
			data: normalizeForClient(row as Record<string, unknown>),
			ts: String((row as Record<string, unknown>).created_at)
		});
	}
	const loopPeople = await env.DB.prepare(
		'SELECT lp.* FROM loop_person lp JOIN loops l ON l.id = lp.loop_id WHERE l.updated_at > ? LIMIT 200'
	)
		.bind(lastSync)
		.all();
	for (const row of loopPeople.results ?? []) {
		const rec = row as Record<string, unknown>;
		outgoing.push({
			table: 'loop_person',
			op: 'put',
			id: `${String(rec.loop_id)}:${String(rec.person_id)}`,
			data: normalizeForClient(rec),
			ts: now
		});
	}

	return json({ serverTime: now, changes: outgoing });
};
