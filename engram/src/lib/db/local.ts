import { db } from '$db/schema';
import type {
	Dump,
	Loop,
	LoopEvent,
	LoopNote,
	SuggestionMutationTagPatch,
	SuggestedAction,
	SuggestionRecord,
	SyncOp,
	Tag,
	TagType
} from '$types/models';
import { uid } from '$lib/utils';
import { syncNow } from '$db/sync';
import { refreshFromServer } from '$stores/app';

const nowIso = () => new Date().toISOString();

const queue = async (op: Omit<SyncOp, 'seq'>) => db.syncQueue.add(op);

function syncAndRefresh() {
	if (typeof navigator === 'undefined' || !navigator.onLine) return;
	syncNow()
		.then(() => refreshFromServer())
		.catch(() => {});
}

async function putEvent(event: LoopEvent) {
	await db.events.put(event);
	await queue({ table: 'events', op: 'put', id: event.id, data: event as unknown as Record<string, unknown>, ts: event.createdAt });
}

async function nextSequence(loopId: string | null): Promise<number> {
	if (!loopId) return 1;
	const events = await db.events.where('loopId').equals(loopId).toArray();
	if (events.length === 0) return 1;
	return Math.max(...events.map((evt) => evt.sequence || 0)) + 1;
}

async function putLoop(loop: Loop) {
	await db.loops.put(loop);
	await queue({ table: 'loops', op: 'put', id: loop.id, data: loop as unknown as Record<string, unknown>, ts: loop.updatedAt });
}

async function touchLoop(loopId: string, at: string) {
	const current = await db.loops.get(loopId);
	if (!current) return;
	const next: Loop = { ...current, updatedAt: at };
	await putLoop(next);
}

async function putTagType(type: TagType) {
	await db.tagTypes.put(type);
	await queue({ table: 'tag_types', op: 'put', id: type.id, data: type as unknown as Record<string, unknown>, ts: type.createdAt });
}

async function putTag(tag: Tag) {
	await db.tags.put(tag);
	await queue({ table: 'tags', op: 'put', id: tag.id, data: tag as unknown as Record<string, unknown>, ts: tag.updatedAt });
}

function readTagValue(tag: Tag): string | null {
	if (tag.valueText != null) return tag.valueText;
	if (tag.valueDate != null) return tag.valueDate;
	if (tag.valueNumber != null) return String(tag.valueNumber);
	if (tag.valueJson != null) return tag.valueJson;
	return null;
}

function assignTagValue(tag: Tag, valueKind: TagType['valueKind'], rawValue: string, updatedAt: string): Tag {
	if (valueKind === 'number') {
		const numeric = Number(rawValue);
		if (!Number.isFinite(numeric)) {
			throw new Error('Invalid number value');
		}
		return { ...tag, valueText: null, valueDate: null, valueJson: null, valueNumber: numeric, updatedAt };
	}
	if (valueKind === 'date') {
		return { ...tag, valueText: null, valueNumber: null, valueJson: null, valueDate: rawValue, updatedAt };
	}
	if (valueKind === 'json') {
		return { ...tag, valueText: null, valueNumber: null, valueDate: null, valueJson: rawValue, updatedAt };
	}
	return { ...tag, valueNumber: null, valueDate: null, valueJson: null, valueText: rawValue, updatedAt };
}

export async function ensureTagType(slug: string, opts?: { name?: string; valueKind?: TagType['valueKind']; multi?: number; system?: number }) {
	const found = await db.tagTypes.where('slug').equals(slug).first();
	if (found) return found;
	const now = nowIso();
	const type: TagType = {
		id: uid('tt'),
		slug,
		name: opts?.name ?? slug.replace(/_/g, ' '),
		valueKind: opts?.valueKind ?? 'text',
		multi: opts?.multi ?? 0,
		system: opts?.system ?? 0,
		createdAt: now
	};
	await putTagType(type);
	return type;
}

export async function setLoopTag(loopId: string, slug: string, value: string | null, opts?: { valueKind?: TagType['valueKind']; multi?: number }) {
	const type = await ensureTagType(slug, { valueKind: opts?.valueKind, multi: opts?.multi });
	if (type.multi) {
		const existing = await db.tags.where('loopId').equals(loopId).and((tag) => tag.tagTypeId === type.id && tag.valueText === value).first();
		if (existing) return existing;
	}
	const existingSingle = await db.tags.where('loopId').equals(loopId).and((tag) => tag.tagTypeId === type.id).first();
	const now = nowIso();
	const tag: Tag = {
		id: existingSingle?.id ?? uid('tag'),
		loopId,
		tagTypeId: type.id,
		valueText: type.valueKind === 'text' ? value : null,
		valueNumber: type.valueKind === 'number' && value ? Number(value) : null,
		valueDate: type.valueKind === 'date' ? value : null,
		valueJson: type.valueKind === 'json' ? value : null,
		createdAt: existingSingle?.createdAt ?? now,
		updatedAt: now
	};
	await putTag(tag);
	return tag;
}

export async function applyLoopTagPatches(loopId: string, patches: SuggestionMutationTagPatch[]) {
	for (const patch of patches) {
		await setLoopTag(loopId, patch.slug, patch.value ?? null, {
			valueKind: patch.valueKind,
			multi: patch.multi ? 1 : 0
		});
	}
}

export async function clearLoopTag(loopId: string, slug: string) {
	const type = await db.tagTypes.where('slug').equals(slug).first();
	if (!type) return;
	const tags = await db.tags.where('loopId').equals(loopId).and((tag) => tag.tagTypeId === type.id).toArray();
	const now = nowIso();
	for (const tag of tags) {
		await db.tags.delete(tag.id);
		await queue({ table: 'tags', op: 'delete', id: tag.id, ts: now });
	}
}

export async function createTagType(input: { name: string; slug: string; valueKind?: TagType['valueKind']; multi?: number }) {
	const slug = input.slug.trim().toLowerCase();
	if (!slug) throw new Error('Slug is required');
	const exists = await db.tagTypes.where('slug').equals(slug).first();
	if (exists) throw new Error('Slug already exists');
	const now = nowIso();
	const tagType: TagType = {
		id: uid('tt'),
		slug,
		name: input.name.trim() || slug,
		valueKind: input.valueKind ?? 'text',
		multi: input.multi ?? 0,
		system: 0,
		createdAt: now
	};
	await putTagType(tagType);
	syncAndRefresh();
	return tagType;
}

export async function renameTagType(tagTypeId: string, nextName: string) {
	const current = await db.tagTypes.get(tagTypeId);
	if (!current) return null;
	const name = nextName.trim();
	if (!name || name === current.name) return current;
	const next: TagType = { ...current, name };
	await putTagType(next);
	syncAndRefresh();
	return next;
}

export async function deleteTagType(tagTypeId: string) {
	const current = await db.tagTypes.get(tagTypeId);
	if (!current) return { deletedTags: 0 };
	const tags = await db.tags.where('tagTypeId').equals(tagTypeId).toArray();
	const now = nowIso();
	for (const tag of tags) {
		await db.tags.delete(tag.id);
		await queue({ table: 'tags', op: 'delete', id: tag.id, ts: now });
	}
	await db.tagTypes.delete(tagTypeId);
	await queue({ table: 'tag_types', op: 'delete', id: tagTypeId, ts: now });
	syncAndRefresh();
	return { deletedTags: tags.length };
}

export async function mergeTagValues(tagTypeId: string, sourceValues: string[], targetValue: string) {
	const type = await db.tagTypes.get(tagTypeId);
	if (!type) return { updated: 0, deleted: 0 };
	const normalizedTarget = targetValue.trim();
	if (!normalizedTarget) throw new Error('Target value is required');
	const sourceSet = new Set(sourceValues.map((value) => value.trim()).filter(Boolean).filter((value) => value !== normalizedTarget));
	if (sourceSet.size === 0) return { updated: 0, deleted: 0 };

	const tags = await db.tags.where('tagTypeId').equals(tagTypeId).toArray();
	const ordered = [...tags].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	const now = nowIso();
	const keptKeys = new Set<string>();
	let updated = 0;
	let deleted = 0;

	for (const tag of ordered) {
		const currentValue = readTagValue(tag);
		if (!currentValue) continue;
		const nextValue = sourceSet.has(currentValue) ? normalizedTarget : currentValue;
		const key = `${tag.loopId}::${nextValue}`;
		if (keptKeys.has(key)) {
			await db.tags.delete(tag.id);
			await queue({ table: 'tags', op: 'delete', id: tag.id, ts: now });
			deleted += 1;
			continue;
		}
		keptKeys.add(key);
		if (nextValue !== currentValue) {
			const next = assignTagValue(tag, type.valueKind, nextValue, now);
			await putTag(next);
			updated += 1;
		}
	}

	syncAndRefresh();
	return { updated, deleted };
}

export async function renameTagValue(tagTypeId: string, fromValue: string, toValue: string) {
	return mergeTagValues(tagTypeId, [fromValue], toValue);
}

export async function deleteTagValue(tagTypeId: string, value: string) {
	const target = value.trim();
	if (!target) return { deleted: 0 };
	const type = await db.tagTypes.get(tagTypeId);
	if (!type) return { deleted: 0 };
	const tags = await db.tags.where('tagTypeId').equals(tagTypeId).toArray();
	const now = nowIso();
	let deleted = 0;
	for (const tag of tags) {
		if (readTagValue(tag) !== target) continue;
		await db.tags.delete(tag.id);
		await queue({ table: 'tags', op: 'delete', id: tag.id, ts: now });
		deleted += 1;
	}
	if (deleted > 0) syncAndRefresh();
	return { deleted };
}

export async function createLoop(input: { title: string; content?: string | null; deadline?: string | null; project?: string | null; priority?: 'P0' | 'P1' | 'P2'; tags?: string[]; dumpId?: string | null; }) {
	const now = nowIso();
	const loop: Loop = {
		id: uid('loop'),
		title: input.title,
		content: input.content ?? null,
		openedAt: now,
		closedAt: null,
		updatedAt: now
	};
	await putLoop(loop);
	await setLoopTag(loop.id, 'state', 'open');
	await setLoopTag(loop.id, 'priority', input.priority ?? 'P1');
	if (input.deadline) await setLoopTag(loop.id, 'deadline', input.deadline, { valueKind: 'date' });
	if (input.project) await setLoopTag(loop.id, 'project', input.project);
	for (const tag of input.tags ?? []) {
		await setLoopTag(loop.id, tag, 'true', { multi: 1 });
	}
	await putEvent({
		id: uid('evt'),
		loopId: loop.id,
		kind: 'created',
		body: null,
		meta: JSON.stringify({ title: loop.title }),
		dumpId: input.dumpId ?? null,
		sequence: await nextSequence(loop.id),
		createdAt: now
	});
	syncAndRefresh();
	return loop;
}

export async function updateLoop(loopId: string, changes: Partial<Pick<Loop, 'title' | 'content'>>) {
	const current = await db.loops.get(loopId);
	if (!current) return null;
	const now = nowIso();
	const next: Loop = { ...current, ...changes, updatedAt: now };
	await putLoop(next);
	const cleanEntries = Object.entries(changes).filter(([, val]) => val !== undefined);
	if (cleanEntries.length === 0) return next;
	await putEvent({
		id: uid('evt'),
		loopId,
		kind: 'updated',
		body: cleanEntries
			.map(([key, val]) => `${key} -> ${String(val ?? '')}`)
			.join(', '),
		meta: JSON.stringify(changes),
		dumpId: null,
		sequence: await nextSequence(loopId),
		createdAt: now
	});
	syncAndRefresh();
	return next;
}

export async function updateLoopTags(loopId: string, changes: { priority?: string | null; deadline?: string | null; project?: string | null }) {
	if (changes.priority !== undefined) await applyLoopTagPatches(loopId, [{ slug: 'priority', value: changes.priority ?? null }]);
	if (changes.deadline !== undefined) {
		if (changes.deadline) await applyLoopTagPatches(loopId, [{ slug: 'deadline', value: changes.deadline, valueKind: 'date' }]);
		else await clearLoopTag(loopId, 'deadline');
	}
	if (changes.project !== undefined) {
		if (changes.project) await applyLoopTagPatches(loopId, [{ slug: 'project', value: changes.project }]);
		else await clearLoopTag(loopId, 'project');
	}
}

export async function archiveLoop(loopId: string) {
	const current = await db.loops.get(loopId);
	if (!current) return null;
	const now = nowIso();
	const next: Loop = {
		...current,
		updatedAt: now
	};
	await putLoop(next);
	await setLoopTag(loopId, 'state', 'archived');
	await putEvent({
		id: uid('evt'),
		loopId,
		kind: 'updated',
		body: 'state -> archived',
		meta: JSON.stringify({ state: 'archived' }),
		dumpId: null,
		sequence: await nextSequence(loopId),
		createdAt: now
	});
	syncAndRefresh();
	return next;
}

export async function unarchiveLoop(loopId: string) {
	const current = await db.loops.get(loopId);
	if (!current) return null;
	const now = nowIso();
	const next: Loop = {
		...current,
		updatedAt: now
	};
	await putLoop(next);
	await setLoopTag(loopId, 'state', 'open');
	await putEvent({
		id: uid('evt'),
		loopId,
		kind: 'updated',
		body: 'state -> open',
		meta: JSON.stringify({ state: 'open' }),
		dumpId: null,
		sequence: await nextSequence(loopId),
		createdAt: now
	});
	syncAndRefresh();
	return next;
}

export async function closeLoop(loopId: string, dumpId: string | null = null) {
	const current = await db.loops.get(loopId);
	if (!current) return null;
	const now = nowIso();
	const next: Loop = {
		...current,
		closedAt: now,
		updatedAt: now
	};
	await putLoop(next);
	await setLoopTag(loopId, 'state', 'closed');
	await putEvent({
		id: uid('evt'),
		loopId,
		kind: 'closed',
		body: null,
		meta: null,
		dumpId,
		sequence: await nextSequence(loopId),
		createdAt: now
	});
	syncAndRefresh();
	return next;
}

export async function reopenLoop(loopId: string) {
	const current = await db.loops.get(loopId);
	if (!current) return null;
	const now = nowIso();
	const next: Loop = {
		...current,
		closedAt: null,
		updatedAt: now
	};
	await putLoop(next);
	await setLoopTag(loopId, 'state', 'open');
	await putEvent({
		id: uid('evt'),
		loopId,
		kind: 'reopened',
		body: null,
		meta: null,
		dumpId: null,
		sequence: await nextSequence(loopId),
		createdAt: now
	});
	syncAndRefresh();
	return next;
}

export async function addUpdate(loopId: string, text: string, dumpId: string | null = null) {
	const now = nowIso();
	await putEvent({
		id: uid('evt'),
		loopId,
		kind: 'noted',
		body: text,
		meta: null,
		dumpId,
		sequence: await nextSequence(loopId),
		createdAt: now
	});
	await touchLoop(loopId, now);
	syncAndRefresh();
}

export const addNote = addUpdate;

async function putLoopNote(note: LoopNote) {
	await db.loopNotes.put(note);
	await queue({ table: 'loop_notes', op: 'put', id: note.id, data: note as unknown as Record<string, unknown>, ts: note.updatedAt });
}

export async function addLoopNote(loopId: string, body: string) {
	const now = nowIso();
	const note: LoopNote = {
		id: uid('note'),
		loopId,
		body,
		createdAt: now,
		updatedAt: now
	};
	await putLoopNote(note);
	await touchLoop(loopId, now);
	syncAndRefresh();
	return note;
}

export async function updateLoopNote(noteId: string, body: string) {
	const current = await db.loopNotes.get(noteId);
	if (!current) return null;
	const now = nowIso();
	const next: LoopNote = { ...current, body, updatedAt: now };
	await putLoopNote(next);
	await touchLoop(next.loopId, now);
	syncAndRefresh();
	return next;
}

export async function deleteLoop(loopId: string) {
	const current = await db.loops.get(loopId);
	if (!current) return;
	const now = nowIso();
	await db.loops.delete(loopId);
	await queue({ table: 'loops', op: 'delete', id: loopId, ts: now });
	await putEvent({
		id: uid('evt'),
		loopId,
		kind: 'deleted',
		body: null,
		meta: null,
		dumpId: null,
		sequence: await nextSequence(loopId),
		createdAt: now
	});
	syncAndRefresh();
}

export async function putLoopPerson(loopId: string, personName: string) {
	await setLoopTag(loopId, 'person', personName, { multi: 1 });
	syncAndRefresh();
}

export async function removeLoopPerson(loopId: string, personId: string) {
	await clearLoopTag(loopId, 'person');
	syncAndRefresh();
}

export async function putDump(input: Omit<Dump, 'id' | 'createdAt' | 'processed'> & { id?: string; createdAt?: string; processed?: number }) {
	const dump: Dump = {
		id: input.id ?? uid('dump'),
		raw: input.raw,
		source: input.source,
		transcript: input.transcript ?? null,
		processed: input.processed ?? 0,
		createdAt: input.createdAt ?? nowIso()
	};
	await db.dumps.put(dump);
	await queue({ table: 'dumps', op: 'put', id: dump.id, data: dump as unknown as Record<string, unknown>, ts: dump.createdAt });
	syncAndRefresh();
	return dump;
}

export async function putSuggestion(input: Omit<SuggestionRecord, 'id' | 'createdAt' | 'resolvedAt' | 'status'> & { id?: string }) {
	const now = nowIso();
	const suggestion: SuggestionRecord = {
		id: input.id ?? uid('sg'),
		dumpId: input.dumpId,
		action: input.action,
		payload: input.payload,
		status: 'pending',
		createdAt: now,
		resolvedAt: null
	};
	await db.suggestions.put(suggestion);
	await queue({ table: 'suggestions', op: 'put', id: suggestion.id, data: suggestion as unknown as Record<string, unknown>, ts: now });
	syncAndRefresh();
	return suggestion;
}

export async function putSuggestionsForDump(dumpId: string | null, suggestions: SuggestedAction[]) {
	const records = await Promise.all(
		suggestions.map((item) => putSuggestion({ dumpId, action: item.action, payload: JSON.stringify(item) }))
	);
	return records;
}

export async function setSuggestionStatus(suggestionId: string, status: 'accepted' | 'dismissed') {
	const current = await db.suggestions.get(suggestionId);
	if (!current) return;
	const next: SuggestionRecord = { ...current, status, resolvedAt: nowIso() };
	await db.suggestions.put(next);
	await queue({
		table: 'suggestions',
		op: 'put',
		id: next.id,
		data: next as unknown as Record<string, unknown>,
		ts: next.resolvedAt ?? nowIso()
	});
	syncAndRefresh();
}
