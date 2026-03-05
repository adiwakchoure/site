import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ensureD1Schema, ensureSystemTagTypes } from '$db/bootstrap';
import { normalizeForClient } from '$db/d1';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const userId = locals.userId;
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const env = platform?.env;
	if (!env?.DB) return json({ error: 'D1 binding missing' }, { status: 500 });
	await ensureD1Schema(env as App.Platform['env'] | undefined);
	await ensureSystemTagTypes(env as App.Platform['env'] | undefined, userId);

	const userVisibleLoopCountResult = await env.DB
		.prepare(
			`SELECT COUNT(*) AS count
       FROM loops l
       WHERE l.owner_id = ?
         AND NOT EXISTS (
           SELECT 1
           FROM tags t
           JOIN tag_types tt
             ON tt.id = t.tag_type_id
            AND tt.owner_id = t.owner_id
           WHERE t.owner_id = l.owner_id
             AND t.loop_id = l.id
             AND tt.slug = 'state'
             AND t.value_text = 'archived'
         )`
		)
		.bind(userId)
		.first<Record<string, unknown>>();

	const userVisibleLoopCount = Number(userVisibleLoopCountResult?.count ?? 0);
	const includeDemo = userVisibleLoopCount === 0;
	const ownerIds = includeDemo ? [userId, 'demo'] : [userId];
	const ownerPlaceholders = ownerIds.map(() => '?').join(', ');
	const ownerArgs = (...tail: Array<string | number>) => [...ownerIds, ...tail];

	const [loops, events, loopNotes, tagTypes, tags, dumps, suggestions] = await Promise.all([
		env.DB.prepare(`SELECT * FROM loops WHERE owner_id IN (${ownerPlaceholders})`).bind(...ownerArgs()).all(),
		env.DB.prepare(`SELECT * FROM events WHERE owner_id IN (${ownerPlaceholders})`).bind(...ownerArgs()).all(),
		env.DB.prepare(`SELECT * FROM loop_notes WHERE owner_id IN (${ownerPlaceholders})`).bind(...ownerArgs()).all(),
		env.DB.prepare(`SELECT * FROM tag_types WHERE owner_id IN (${ownerPlaceholders})`).bind(...ownerArgs()).all(),
		env.DB.prepare(`SELECT * FROM tags WHERE owner_id IN (${ownerPlaceholders})`).bind(...ownerArgs()).all(),
		env.DB.prepare('SELECT * FROM dumps WHERE owner_id = ?').bind(userId).all(),
		env.DB.prepare('SELECT * FROM suggestions WHERE owner_id = ?').bind(userId).all()
	]);

	const norm = (rows: Record<string, unknown>[]) => rows.map((r) => normalizeForClient(r));

	return json({
		loops: norm((loops.results ?? []) as Record<string, unknown>[]),
		events: norm((events.results ?? []) as Record<string, unknown>[]),
		loopNotes: norm((loopNotes.results ?? []) as Record<string, unknown>[]),
		tagTypes: norm((tagTypes.results ?? []) as Record<string, unknown>[]),
		tags: norm((tags.results ?? []) as Record<string, unknown>[]),
		dumps: norm((dumps.results ?? []) as Record<string, unknown>[]),
		suggestions: norm((suggestions.results ?? []) as Record<string, unknown>[]),
		serverTime: new Date().toISOString()
	});
};
