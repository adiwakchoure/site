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

	const [loops, events, loopNotes, tagTypes, tags, dumps, suggestions] = await Promise.all([
		env.DB.prepare('SELECT * FROM loops WHERE owner_id = ?').bind(userId).all(),
		env.DB.prepare('SELECT * FROM events WHERE owner_id = ?').bind(userId).all(),
		env.DB.prepare('SELECT * FROM loop_notes WHERE owner_id = ?').bind(userId).all(),
		env.DB.prepare('SELECT * FROM tag_types WHERE owner_id = ?').bind(userId).all(),
		env.DB.prepare('SELECT * FROM tags WHERE owner_id = ?').bind(userId).all(),
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
