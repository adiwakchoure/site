import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ensureD1Schema } from '$db/bootstrap';
import { normalizeForClient } from '$db/d1';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const userId = locals.userId;
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const env = platform?.env;
	if (!env?.DB) return json({ error: 'D1 binding missing' }, { status: 500 });
	await ensureD1Schema(env as App.Platform['env'] | undefined);

	const [loops, events, loopNotes, people, projects, dumps, suggestions, loopPeople] = await Promise.all([
		env.DB.prepare('SELECT * FROM loops WHERE owner_id = ?').bind(userId).all(),
		env.DB.prepare('SELECT * FROM events WHERE owner_id = ?').bind(userId).all(),
		env.DB.prepare('SELECT * FROM loop_notes WHERE owner_id = ?').bind(userId).all(),
		env.DB.prepare('SELECT * FROM people WHERE owner_id = ?').bind(userId).all(),
		env.DB.prepare('SELECT * FROM projects WHERE owner_id = ?').bind(userId).all(),
		env.DB.prepare('SELECT * FROM dumps WHERE owner_id = ?').bind(userId).all(),
		env.DB.prepare('SELECT * FROM suggestions WHERE owner_id = ?').bind(userId).all(),
		env.DB.prepare('SELECT * FROM loop_person WHERE owner_id = ?').bind(userId).all()
	]);

	const norm = (rows: Record<string, unknown>[]) => rows.map((r) => normalizeForClient(r));

	return json({
		loops: norm((loops.results ?? []) as Record<string, unknown>[]),
		events: norm((events.results ?? []) as Record<string, unknown>[]),
		loopNotes: norm((loopNotes.results ?? []) as Record<string, unknown>[]),
		people: norm((people.results ?? []) as Record<string, unknown>[]),
		projects: norm((projects.results ?? []) as Record<string, unknown>[]),
		dumps: norm((dumps.results ?? []) as Record<string, unknown>[]),
		suggestions: norm((suggestions.results ?? []) as Record<string, unknown>[]),
		loopPeople: norm((loopPeople.results ?? []) as Record<string, unknown>[]),
		serverTime: new Date().toISOString()
	});
};
