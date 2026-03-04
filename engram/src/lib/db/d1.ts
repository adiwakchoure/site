/** Shared D1 helpers used by /api/sync and /api/data */

export const toSnake = (value: string) => value.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
export const toCamel = (value: string) => value.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export const normalizeForDb = (obj: Record<string, unknown>) =>
	Object.fromEntries(Object.entries(obj).map(([key, val]) => [toSnake(key), val]));

export const normalizeForClient = (obj: Record<string, unknown>) =>
	Object.fromEntries(Object.entries(obj).map(([key, val]) => [toCamel(key), val]));

export async function rowExists(env: App.Platform['env'], table: string, id: unknown, ownerId: string) {
	if (typeof id !== 'string' || !id) return false;
	const row = await env.DB.prepare(`SELECT id FROM ${table} WHERE id = ? AND owner_id = ? LIMIT 1`).bind(id, ownerId).first();
	return Boolean(row);
}

export async function normalizeForeignKeys(
	env: App.Platform['env'],
	table: string,
	data: Record<string, unknown>,
	ownerId: string
) {
	if (table === 'events') {
		if (typeof data.loop_id === 'string' && !(await rowExists(env, 'loops', data.loop_id, ownerId))) data.loop_id = null;
		if (typeof data.dump_id === 'string' && !(await rowExists(env, 'dumps', data.dump_id, ownerId))) data.dump_id = null;
	}
	if (table === 'suggestions') {
		if (typeof data.dump_id === 'string' && !(await rowExists(env, 'dumps', data.dump_id, ownerId))) data.dump_id = null;
	}
	if (table === 'loop_notes') {
		if (typeof data.loop_id === 'string' && !(await rowExists(env, 'loops', data.loop_id, ownerId))) data.loop_id = null;
	}
	if (table === 'tags') {
		if (typeof data.loop_id === 'string' && !(await rowExists(env, 'loops', data.loop_id, ownerId))) data.loop_id = null;
		if (typeof data.tag_type_id === 'string' && !(await rowExists(env, 'tag_types', data.tag_type_id, ownerId)))
			data.tag_type_id = null;
	}
}
