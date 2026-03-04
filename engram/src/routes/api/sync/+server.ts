import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { ensureD1Schema, ensureSystemTagTypes } from '$db/bootstrap';
import { normalizeForDb, normalizeForClient, rowExists, normalizeForeignKeys } from '$db/d1';

const changeSchema = z.object({
	table: z.enum(['loops', 'events', 'loop_notes', 'tag_types', 'tags', 'dumps', 'suggestions']),
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
	tag_types: 'id',
	tags: 'id',
	dumps: 'id',
	suggestions: 'id'
} as const;

export const POST: RequestHandler = async ({ locals, request, platform }) => {
	const userId = locals.userId;
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const env = platform?.env;
	if (!env?.DB) return json({ error: 'D1 binding missing' }, { status: 500 });
	await ensureD1Schema(env as App.Platform['env'] | undefined);
	await ensureSystemTagTypes(env as App.Platform['env'] | undefined, userId);

	const parsed = payloadSchema.safeParse(await request.json());
	if (!parsed.success) return json({ error: 'Invalid sync payload' }, { status: 400 });

	const { changes, lastSync } = parsed.data;
	const now = new Date().toISOString();

	for (const change of changes) {
		if (change.op === 'delete') {
			const pk = tablePrimaryKey[change.table];
			await env.DB.prepare(`DELETE FROM ${change.table} WHERE owner_id = ? AND ${pk} = ?`).bind(userId, change.id).run();
		} else if (change.data) {
			const dbData = normalizeForDb(change.data);
			dbData.owner_id = userId;
			await normalizeForeignKeys(env as App.Platform['env'], change.table as string, dbData, userId);
			const keys = Object.keys(dbData);
			const values = Object.values(dbData);
			const placeholders = keys.map(() => '?').join(', ');
			if (change.table === 'loop_notes') {
				const hasLoop = await rowExists(env as App.Platform['env'], 'loops', dbData.loop_id, userId);
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
	const loops = await env.DB
		.prepare('SELECT * FROM loops WHERE owner_id = ? AND updated_at > ? ORDER BY updated_at ASC LIMIT 200')
		.bind(userId, lastSync)
		.all();
	for (const row of loops.results ?? []) {
		outgoing.push({ table: 'loops', op: 'put', id: String((row as Record<string, unknown>).id), data: normalizeForClient(row as Record<string, unknown>), ts: String((row as Record<string, unknown>).updated_at) });
	}
	const events = await env.DB
		.prepare('SELECT * FROM events WHERE owner_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 400')
		.bind(userId, lastSync)
		.all();
	for (const row of events.results ?? []) {
		outgoing.push({ table: 'events', op: 'put', id: String((row as Record<string, unknown>).id), data: normalizeForClient(row as Record<string, unknown>), ts: String((row as Record<string, unknown>).created_at) });
	}
	const loopNotes = await env.DB
		.prepare('SELECT * FROM loop_notes WHERE owner_id = ? AND updated_at > ? ORDER BY updated_at ASC LIMIT 300')
		.bind(userId, lastSync)
		.all();
	for (const row of loopNotes.results ?? []) {
		outgoing.push({
			table: 'loop_notes',
			op: 'put',
			id: String((row as Record<string, unknown>).id),
			data: normalizeForClient(row as Record<string, unknown>),
			ts: String((row as Record<string, unknown>).updated_at)
		});
	}
	const tagTypes = await env.DB
		.prepare('SELECT * FROM tag_types WHERE owner_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 200')
		.bind(userId, lastSync)
		.all();
	for (const row of tagTypes.results ?? []) {
		outgoing.push({ table: 'tag_types', op: 'put', id: String((row as Record<string, unknown>).id), data: normalizeForClient(row as Record<string, unknown>), ts: String((row as Record<string, unknown>).created_at) });
	}
	const tags = await env.DB
		.prepare('SELECT * FROM tags WHERE owner_id = ? AND updated_at > ? ORDER BY updated_at ASC LIMIT 400')
		.bind(userId, lastSync)
		.all();
	for (const row of tags.results ?? []) {
		outgoing.push({
			table: 'tags',
			op: 'put',
			id: String((row as Record<string, unknown>).id),
			data: normalizeForClient(row as Record<string, unknown>),
			ts: String((row as Record<string, unknown>).updated_at)
		});
	}
	const dumps = await env.DB
		.prepare('SELECT * FROM dumps WHERE owner_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 100')
		.bind(userId, lastSync)
		.all();
	for (const row of dumps.results ?? []) {
		outgoing.push({ table: 'dumps', op: 'put', id: String((row as Record<string, unknown>).id), data: normalizeForClient(row as Record<string, unknown>), ts: String((row as Record<string, unknown>).created_at) });
	}
	const suggestions = await env.DB
		.prepare('SELECT * FROM suggestions WHERE owner_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 200')
		.bind(userId, lastSync)
		.all();
	for (const row of suggestions.results ?? []) {
		outgoing.push({
			table: 'suggestions',
			op: 'put',
			id: String((row as Record<string, unknown>).id),
			data: normalizeForClient(row as Record<string, unknown>),
			ts: String((row as Record<string, unknown>).created_at)
		});
	}
	return json({ serverTime: now, changes: outgoing });
};
