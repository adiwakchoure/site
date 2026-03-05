import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import type { LoopPriority, SuggestedAction } from '$types/models';
import { ensureD1Schema, ensureSystemTagTypes } from '$db/bootstrap';

const payloadSchema = z.object({ text: z.string().min(1) });
const MAX_SUGGESTIONS = 8;
const confidenceSchema = z.enum(['high', 'medium', 'low']);
const tagModeSchema = z.enum(['add', 'set', 'remove']);
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const changesSchema = z
	.object({
		title: z.string().min(1).optional(),
		content: z.string().nullable().optional(),
		priority: z.enum(['P0', 'P1', 'P2']).nullable().optional(),
		deadline: dateOnlySchema.nullable().optional(),
		project: z.string().nullable().optional()
	})
	.strict()
	.optional();
const openLoopSchema = z
	.object({
		action: z.literal('open_loop'),
		title: z.string().min(1),
		content: z.string().nullable().optional(),
		priority: z.enum(['P0', 'P1', 'P2']).optional(),
		deadline: dateOnlySchema.nullable().optional(),
		project: z.string().nullable().optional(),
		people: z.array(z.string()).optional(),
		tags: z.array(z.string()).optional(),
		confidence: confidenceSchema.optional()
	})
	.strict();
const closeLoopSchema = z
	.object({
		action: z.literal('close_loop'),
		loopId: z.string().min(1).optional(),
		title: z.string().min(1).optional(),
		people: z.array(z.string()).optional(),
		confidence: confidenceSchema.optional()
	})
	.strict()
	.refine((item) => Boolean(item.loopId || item.title), { message: 'loopId or title required' });
const addNoteSchema = z
	.object({
		action: z.literal('add_note'),
		text: z.string().min(1),
		loopId: z.string().min(1).optional(),
		title: z.string().min(1).optional(),
		people: z.array(z.string()).optional(),
		confidence: confidenceSchema.optional()
	})
	.strict()
	.refine((item) => Boolean(item.loopId || item.title), { message: 'loopId or title required' });
const updateLoopSchema = z
	.object({
		action: z.literal('update_loop'),
		loopId: z.string().min(1).optional(),
		title: z.string().min(1).optional(),
		changes: changesSchema,
		priority: z.enum(['P0', 'P1', 'P2']).optional(),
		deadline: dateOnlySchema.nullable().optional(),
		project: z.string().nullable().optional(),
		people: z.array(z.string()).optional(),
		tagTypeSlug: z.string().min(1).optional(),
		tagValue: z.string().nullable().optional(),
		tagMode: tagModeSchema.optional(),
		confidence: confidenceSchema.optional()
	})
	.strict()
	.refine((item) => Boolean(item.loopId || item.title), { message: 'loopId or title required' });
const tagLoopSchema = z
	.object({
		action: z.literal('tag_loop'),
		loopId: z.string().min(1).optional(),
		title: z.string().min(1).optional(),
		tagTypeSlug: z.string().min(1),
		tagValue: z.string().nullable().optional(),
		tagMode: tagModeSchema.optional(),
		confidence: confidenceSchema.optional()
	})
	.strict()
	.refine((item) => Boolean(item.loopId || item.title), { message: 'loopId or title required' });
const suggestionSchema = z.discriminatedUnion('action', [openLoopSchema, closeLoopSchema, addNoteSchema, updateLoopSchema, tagLoopSchema]);
const suggestionArraySchema = z.array(suggestionSchema).max(MAX_SUGGESTIONS);
const modelResponseSchema = z.object({ suggestions: z.array(z.unknown()) }).strict();

type LoopCtx = { id: string; title: string; content: string | null; closed_at: string | null; updated_at: string };
type TagCtx = {
	loop_id: string;
	slug: string;
	value_text: string | null;
	value_date: string | null;
	value_number: number | null;
	value_json: string | null;
};
type TagTypeCtx = { id: string; slug: string; name: string; value_kind: string; multi: number };

function extractHeuristicDeadline(text: string): string | null {
	const lower = text.toLowerCase();
	const today = new Date();
	if (/\basap\b|urgent|critical|\btoday\b|\btonight\b|\beod\b/.test(lower)) return today.toISOString().slice(0, 10);
	if (/\btomorrow\b|\btmrw\b/.test(lower)) {
		const d = new Date(today);
		d.setDate(d.getDate() + 1);
		return d.toISOString().slice(0, 10);
	}
	return null;
}

function extractHeuristicPeople(text: string): string[] {
	const fromMentions = text.match(/@([a-zA-Z][\w-]{1,32})/g)?.map((token) => token.slice(1)) ?? [];
	const names = text.match(/\b[A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})?\b/g) ?? [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const name of [...fromMentions, ...names]) {
		const key = name.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(name);
	}
	return out;
}

function heuristicSuggestions(text: string): SuggestedAction[] {
	const parts = text.split(/\n+|[.;](?=\s|$)/g).map((part) => part.trim()).filter(Boolean).slice(0, 8);
	const suggestions: SuggestedAction[] = [];
	for (const part of parts) {
		const lower = part.toLowerCase();
		const explicitDue = part.match(/\b(?:due|deadline)\s*:\s*(\d{4}-\d{2}-\d{2})\b/i)?.[1] ?? null;
		const deadline = explicitDue ?? extractHeuristicDeadline(part);
		const people = extractHeuristicPeople(part);
		const explicitProject = part.match(/\bproject\s*:\s*([^,;]+)/i)?.[1]?.trim() ?? null;
		const inlineTags = part.match(/#[a-zA-Z][\w-]*/g)?.map((token) => token.slice(1).toLowerCase()) ?? [];
		const priority: LoopPriority =
			/\bp0\b|\basap\b|urgent|critical/i.test(lower) ? 'P0' : /\bp2\b|\blow priority\b/.test(lower) ? 'P2' : 'P1';
		if (/\b(done|finished|completed|shipped|resolved)\b/.test(lower)) {
			suggestions.push({ action: 'close_loop', title: part, people, confidence: 'medium' });
			continue;
		}
		if (/\b(cancel|scratch|kill|nevermind|forget it)\b/.test(lower)) {
			suggestions.push({ action: 'close_loop', title: part, people, confidence: 'medium' });
			continue;
		}
		if (/\b(note|status|update)\b/.test(lower)) {
			suggestions.push({ action: 'add_note', text: part.replace(/^(note|status|update)[: ]*/i, ''), people, confidence: 'medium' });
			continue;
		}
		suggestions.push({
			action: 'open_loop',
			title: part,
			priority,
			deadline,
			project: explicitProject,
			people,
			tags: inlineTags,
			confidence: 'medium'
		});
	}
	return suggestions.length ? suggestions : [{ action: 'open_loop', title: text.trim(), priority: 'P1', confidence: 'medium' }];
}

function parseModelJson(raw: string): unknown[] | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	const attempts: string[] = [trimmed];
	const objectStart = trimmed.indexOf('{');
	const objectEnd = trimmed.lastIndexOf('}');
	if (objectStart >= 0 && objectEnd > objectStart) {
		attempts.push(trimmed.slice(objectStart, objectEnd + 1));
	}
	const arrayStart = trimmed.indexOf('[');
	const arrayEnd = trimmed.lastIndexOf(']');
	if (arrayStart >= 0 && arrayEnd > arrayStart) {
		attempts.push(trimmed.slice(arrayStart, arrayEnd + 1));
	}
	for (const candidate of attempts) {
		try {
			const parsed = JSON.parse(candidate);
			const wrapped = modelResponseSchema.safeParse(parsed);
			if (wrapped.success) return wrapped.data.suggestions;
			if (Array.isArray(parsed)) return parsed;
		} catch {
			// Try next parse candidate.
		}
	}
	return null;
}

function normalizeSuggestions(input: unknown[] | null | undefined, fallbackText: string): SuggestedAction[] {
	if (!input || input.length === 0) {
		return [{ action: 'open_loop', title: fallbackText, priority: 'P1', confidence: 'low' }];
	}
	const cleaned: SuggestedAction[] = [];
	for (const candidate of input.slice(0, MAX_SUGGESTIONS)) {
		const parsed = suggestionSchema.safeParse(candidate);
		if (!parsed.success) continue;
		const item = parsed.data;
		const confidence: SuggestedAction['confidence'] = item.confidence ?? 'medium';
		const people = ('people' in item ? item.people : undefined)?.map((person: string) => person.trim()).filter(Boolean).slice(0, 6);
		if (item.action === 'open_loop') {
			cleaned.push({
				action: 'open_loop',
				title: item.title.trim(),
				content: item.content?.trim() || null,
				priority: item.priority ?? 'P1',
				deadline: item.deadline ?? null,
				project: item.project?.trim() || null,
				people,
				tags: item.tags?.map((tag) => tag.trim()).filter(Boolean).slice(0, 8),
				confidence
			});
		}
		if (item.action === 'close_loop') {
			cleaned.push({
				action: 'close_loop',
				loopId: item.loopId?.trim(),
				title: item.title?.trim(),
				people,
				confidence
			});
		}
		if (item.action === 'add_note') {
			cleaned.push({
				action: 'add_note',
				loopId: item.loopId?.trim(),
				title: item.title?.trim(),
				text: item.text.trim(),
				people,
				confidence
			});
		}
		if (item.action === 'update_loop') {
			cleaned.push({
				action: 'update_loop',
				loopId: item.loopId?.trim(),
				title: item.title?.trim(),
				changes: item.changes,
				priority: item.priority,
				deadline: item.deadline ?? null,
				project: item.project?.trim() || null,
				people,
				tagTypeSlug: item.tagTypeSlug?.trim(),
				tagValue: item.tagValue?.trim() || null,
				tagMode: item.tagMode,
				confidence
			});
		}
		if (item.action === 'tag_loop') {
			cleaned.push({
				action: 'tag_loop',
				loopId: item.loopId?.trim(),
				title: item.title?.trim(),
				tagTypeSlug: item.tagTypeSlug.trim().toLowerCase(),
				tagValue: item.tagValue?.trim() || null,
				tagMode: item.tagMode ?? (item.tagValue == null ? 'remove' : 'set'),
				confidence
			});
		}
	}
	const limited = suggestionArraySchema.safeParse(cleaned);
	if (limited.success && limited.data.length > 0) return limited.data;
	return [{ action: 'open_loop', title: fallbackText, priority: 'P1', confidence: 'low' }];
}

// Underscore-prefixed exports are allowed in SvelteKit endpoint modules.
export const _parseModelJson = parseModelJson;
export const _normalizeSuggestions = normalizeSuggestions;
export const _formatContextBlock = formatContextBlock;

const GROQ_API_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_REASONING_MODEL = 'openai/gpt-oss-120b';
const GROQ_TRANSCRIPTION_MODEL = 'whisper-large-v3-turbo';
const GROQ_SUGGESTIONS_RESPONSE_SCHEMA = {
	type: 'json_schema',
	json_schema: {
		name: 'engram_suggestions',
		schema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				suggestions: {
					type: 'array',
					maxItems: MAX_SUGGESTIONS,
					items: {
						type: 'object',
						additionalProperties: false,
						properties: {
							action: { enum: ['open_loop', 'close_loop', 'add_note', 'update_loop', 'tag_loop'] },
							loopId: { type: 'string' },
							title: { type: 'string' },
							content: { type: ['string', 'null'] },
							priority: { enum: ['P0', 'P1', 'P2'] },
							deadline: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
							project: { type: ['string', 'null'] },
							people: { type: 'array', items: { type: 'string' } },
							tags: { type: 'array', items: { type: 'string' } },
							text: { type: 'string' },
							changes: {
								type: 'object',
								additionalProperties: false,
								properties: {
									title: { type: 'string' },
									content: { type: ['string', 'null'] },
									priority: { enum: ['P0', 'P1', 'P2', null] },
									deadline: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
									project: { type: ['string', 'null'] }
								}
							},
							tagTypeSlug: { type: 'string' },
							tagValue: { type: ['string', 'null'] },
							tagMode: { enum: ['add', 'set', 'remove'] },
							confidence: { enum: ['high', 'medium', 'low'] }
						},
						required: ['action']
					}
				}
			},
			required: ['suggestions']
		}
	}
} as const;

function resolveGroqApiKey(env: App.Platform['env'] | undefined): string {
	const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
	return env?.GROQ_API_KEY ?? nodeEnv?.GROQ_API_KEY ?? '';
}

async function transcribeWithGroq(audio: File, apiKey: string): Promise<string> {
	const form = new FormData();
	form.append('model', GROQ_TRANSCRIPTION_MODEL);
	form.append('file', audio, audio.name || 'dump.webm');

	const response = await fetch(`${GROQ_API_BASE_URL}/audio/transcriptions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`
		},
		body: form
	});
	if (!response.ok) throw new Error(`Groq transcription failed: ${response.status}`);

	const data = (await response.json()) as { text?: unknown };
	return typeof data.text === 'string' ? data.text : '';
}

async function runReasoningWithGroq(systemMessage: string, userMessage: string, temperature: number, apiKey: string): Promise<string> {
	const response = await fetch(`${GROQ_API_BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: GROQ_REASONING_MODEL,
			messages: [
				{ role: 'system', content: systemMessage },
				{ role: 'user', content: userMessage }
			],
			response_format: GROQ_SUGGESTIONS_RESPONSE_SCHEMA,
			temperature
		})
	});
	if (!response.ok) throw new Error(`Groq chat completion failed: ${response.status}`);

	const data = (await response.json()) as {
		choices?: Array<{
			message?: {
				content?: string | Array<{ type?: string; text?: string }>;
			};
		}>;
	};
	const content = data.choices?.[0]?.message?.content;
	if (typeof content === 'string') return content;
	if (Array.isArray(content)) {
		return content
			.filter((part) => part && typeof part.text === 'string')
			.map((part) => part.text as string)
			.join('\n');
	}
	return '';
}

type RecentNoteRow = { loop_id: string; body: string; created_at: string };
type RecentEventRow = { loop_id: string; kind: string; body: string | null; created_at: string };

interface FullContext {
	openLoops: LoopCtx[];
	closedLoops: LoopCtx[];
	loopTags: TagCtx[];
	tagTypes: TagTypeCtx[];
	recentNotes: RecentNoteRow[];
	recentEvents: RecentEventRow[];
	openCount: number;
	overdueCount: number;
}

async function loadActiveContext(env: App.Platform['env'], ownerId: string): Promise<FullContext> {
	if (!env?.DB) {
		return { openLoops: [], closedLoops: [], loopTags: [], tagTypes: [], recentNotes: [], recentEvents: [], openCount: 0, overdueCount: 0 };
	}

	const [openLoops, closedLoops, loopTags, tagTypes, recentNotes, recentEvents] = await Promise.all([
		env.DB.prepare(
			`SELECT id, title, content, closed_at, updated_at
       FROM loops WHERE owner_id = ? AND closed_at IS NULL ORDER BY updated_at DESC`
		).bind(ownerId).all<LoopCtx>(),
		env.DB.prepare(
			`SELECT id, title, content, closed_at, updated_at
       FROM loops WHERE owner_id = ? AND closed_at IS NOT NULL ORDER BY closed_at DESC LIMIT 30`
		).bind(ownerId).all<LoopCtx>(),
		env.DB.prepare(
			`SELECT t.loop_id, tt.slug, t.value_text, t.value_date, t.value_number, t.value_json
       FROM tags t JOIN tag_types tt ON tt.id = t.tag_type_id
       WHERE t.owner_id = ?`
		).bind(ownerId).all<TagCtx>(),
		env.DB.prepare(
			`SELECT id, slug, name, value_kind, multi
       FROM tag_types
       WHERE owner_id = ?
       ORDER BY slug ASC`
		).bind(ownerId).all<TagTypeCtx>(),
		env.DB.prepare(
			`SELECT ln.loop_id, ln.body, ln.created_at
       FROM loop_notes ln JOIN loops l ON l.id = ln.loop_id AND l.owner_id = ? AND l.closed_at IS NULL
       WHERE ln.owner_id = ?
       ORDER BY ln.created_at DESC LIMIT 100`
		).bind(ownerId, ownerId).all<RecentNoteRow>(),
		env.DB.prepare(
			`SELECT e.loop_id, e.kind, e.body, e.created_at
       FROM events e JOIN loops l ON l.id = e.loop_id AND l.owner_id = ? AND l.closed_at IS NULL
       WHERE e.owner_id = ? AND e.kind IN ('noted', 'updated', 'created')
       ORDER BY e.created_at DESC LIMIT 100`
		).bind(ownerId, ownerId).all<RecentEventRow>()
	]);

	const open = openLoops.results ?? [];
	const deadlines = new Map<string, string>();
	for (const tag of loopTags.results ?? []) {
		if (tag.slug === 'deadline' && tag.value_date) deadlines.set(tag.loop_id, tag.value_date);
	}
	const overdueCount = open.filter((loop) => {
		const due = deadlines.get(loop.id);
		return Boolean(due && +new Date(due) < Date.now());
	}).length;

	return {
		openLoops: open,
		closedLoops: closedLoops.results ?? [],
		loopTags: loopTags.results ?? [],
		tagTypes: tagTypes.results ?? [],
		recentNotes: recentNotes.results ?? [],
		recentEvents: recentEvents.results ?? [],
		openCount: open.length,
		overdueCount
	};
}

function formatContextBlock(ctx: FullContext): string {
	const openLoops = ctx.openLoops.slice(0, 40);
	const closedLoops = ctx.closedLoops.slice(0, 20);
	const systemSlugs = new Set(['priority', 'deadline', 'project', 'person', 'state']);
	const loopTagMap = new Map<string, TagCtx[]>();
	for (const tag of ctx.loopTags) {
		const list = loopTagMap.get(tag.loop_id) ?? [];
		list.push(tag);
		loopTagMap.set(tag.loop_id, list);
	}

	// Group recent notes per loop (last 3 per loop)
	const loopNotesMap = new Map<string, Array<{ body: string; at: string }>>();
	for (const n of ctx.recentNotes) {
		const list = loopNotesMap.get(n.loop_id) ?? [];
		if (list.length < 3) list.push({ body: n.body, at: n.created_at.slice(0, 10) });
		loopNotesMap.set(n.loop_id, list);
	}

	// Group recent events per loop (last 3 per loop, only those with body)
	const loopEventsMap = new Map<string, Array<{ kind: string; body: string; at: string }>>();
	for (const e of ctx.recentEvents) {
		if (!e.body) continue;
		const list = loopEventsMap.get(e.loop_id) ?? [];
		if (list.length < 3) list.push({ kind: e.kind, body: e.body, at: e.created_at.slice(0, 10) });
		loopEventsMap.set(e.loop_id, list);
	}

	function formatTagValue(tag: TagCtx): string {
		if (tag.value_text != null) return tag.value_text;
		if (tag.value_date != null) return tag.value_date;
		if (tag.value_number != null) return String(tag.value_number);
		if (tag.value_json != null) return tag.value_json;
		return 'null';
	}

	function formatOpenLoop(l: LoopCtx): string {
		const tags = loopTagMap.get(l.id) ?? [];
		const get = (slug: string) => tags.find((t) => t.slug === slug);
		const people = tags.filter((t) => t.slug === 'person').map((t) => t.value_text).filter(Boolean).join(', ');
		const meta: string[] = [];
		const priority = get('priority')?.value_text ?? 'P1';
		const project = get('project')?.value_text;
		const deadline = get('deadline')?.value_date;
		meta.push(priority);
		if (deadline) meta.push(`due ${deadline}`);
		if (project) meta.push(`project: ${project}`);
		if (people) meta.push(`people: ${people}`);
		meta.push(`updated ${l.updated_at.slice(0, 10)}`);
		const customTagSummary = tags
			.filter((tag) => !systemSlugs.has(tag.slug))
			.map((tag) => `${tag.slug}=${formatTagValue(tag)}`)
			.slice(0, 8)
			.join(', ');
		if (customTagSummary) meta.push(`custom: ${customTagSummary}`);

		let line = `- id=${l.id} title="${l.title}" | ${meta.join(' | ')}`;

		// Append recent activity
		const notes = loopNotesMap.get(l.id) ?? [];
		const events = loopEventsMap.get(l.id) ?? [];
		const activity = [...notes.map((n) => `    note ${n.at}: ${n.body.slice(0, 80)}`), ...events.map((e) => `    ${e.kind} ${e.at}: ${e.body.slice(0, 80)}`)].slice(
			0,
			3
		);
		if (activity.length > 0) line += '\n' + activity.join('\n');

		return line;
	}

	const sections: string[] = [];

	sections.push('== TAG CATALOG ==');
	if (ctx.tagTypes.length > 0) {
		sections.push(
			ctx.tagTypes
				.map((type) => `- ${type.slug} (${type.value_kind}${type.multi ? ', multi' : ''}) name="${type.name}"`)
				.join('\n')
		);
	} else {
		sections.push('(none)');
	}

	sections.push('== OPEN LOOPS ==');
	if (openLoops.length > 0) {
		sections.push(openLoops.map(formatOpenLoop).join('\n'));
	} else {
		sections.push('(none)');
	}

	sections.push('\n== RECENTLY CLOSED LOOPS ==');
	if (closedLoops.length > 0) {
		sections.push(closedLoops.map((l) => `- id=${l.id} title="${l.title}" closed=${l.closed_at ?? '?'}`).join('\n'));
	} else {
		sections.push('(none)');
	}

	sections.push(`\n== COUNTS ==\nopen=${ctx.openCount} overdue=${ctx.overdueCount}`);

	return sections.join('\n');
}

export const POST: RequestHandler = async ({ locals, request, platform }) => {
	const userId = locals.userId;
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const env = platform?.env;
	await ensureD1Schema(env as App.Platform['env'] | undefined);
	await ensureSystemTagTypes(env as App.Platform['env'] | undefined, userId);
	const groqApiKey = resolveGroqApiKey(env as App.Platform['env'] | undefined);
	const aiAvailable = Boolean(groqApiKey);
	const contentType = request.headers.get('content-type') ?? '';
	const context = await loadActiveContext(env as App.Platform['env'], userId);

	let text = '';
	let source: 'text' | 'voice' = 'text';

	if (contentType.includes('multipart/form-data')) {
		const form = await request.formData();
		const audio = form.get('audio');
		if (!(audio instanceof File)) return json({ error: 'Missing audio file' }, { status: 400 });
		source = 'voice';

		if (!aiAvailable) {
			return json({
				transcript: '',
				source,
				aiAvailable: false,
				suggestions: [{ action: 'open_loop', title: 'Review voice dump', priority: 'P1', confidence: 'low' }]
			});
		}

		try {
			text = await transcribeWithGroq(audio, groqApiKey);
		} catch {
			text = '';
		}

		if (!text.trim()) {
			return json({
				transcript: '',
				source,
				aiAvailable,
				active: { openCount: context.openCount, overdueCount: context.overdueCount },
				suggestions: [{ action: 'open_loop', title: 'Review voice dump', priority: 'P1', confidence: 'low' }]
			});
		}
	} else {
		const parsed = payloadSchema.safeParse(await request.json());
		if (!parsed.success) return json({ error: 'Invalid payload' }, { status: 400 });
		text = parsed.data.text;
	}

	const fallback = heuristicSuggestions(text);

	if (!aiAvailable) {
		return json({
			transcript: text,
			source,
			aiAvailable: false,
			active: { openCount: context.openCount, overdueCount: context.overdueCount },
			suggestions: normalizeSuggestions(fallback, text)
		});
	}

	try {
		const today = new Date().toISOString().slice(0, 10);
		const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

		const systemPrompt = `You parse unstructured brain dumps into loop suggestions.

Return ONLY JSON that matches:
{ "suggestions": [ ... ] }

Hard rules:
- At most ${MAX_SUGGESTIONS} suggestions.
- Use only actions: open_loop, close_loop, add_note, update_loop, tag_loop.
- Use YYYY-MM-DD for deadline. Never use relative dates.
- If uncertain about the target loop, do NOT guess loopId. Use title only and confidence="low".
- confidence rubric:
  - high: explicit unambiguous target + explicit intent
  - medium: probable target/intention, minor ambiguity
  - low: ambiguous target or inferred intent
- Prefer loop primitives:
  - open_loop for new work
  - close_loop for done/cancelled work
  - add_note for status updates
  - update_loop for changing title/content/priority/deadline/project
  - tag_loop for additional tags
- Prefer slugs from TAG CATALOG for tag_loop; avoid inventing unknown slugs.
- For tag_loop: tagMode="add" to append, "set" to replace value, "remove" to delete.
- Keep text concise. Do not output explanation prose.`;

		const userPrompt = `Date: ${dayName}, ${today}

Loop match rubric (deterministic):
1) exact title match
2) normalized title match (case/punctuation-insensitive)
3) lexical overlap with recent activity
4) if still ambiguous: omit loopId and set confidence=low

Context:
${formatContextBlock(context)}

Input:
${text}`;

		const runModel = async (temperature: number) => runReasoningWithGroq(systemPrompt, userPrompt, temperature, groqApiKey);

		let responseText = await runModel(0.2);
		let suggestions = parseModelJson(responseText);
		if (!suggestions) {
			responseText = await runModel(0.1);
			suggestions = parseModelJson(responseText);
		}

		return json({
			transcript: text,
			source,
			aiAvailable: true,
			active: { openCount: context.openCount, overdueCount: context.overdueCount },
			suggestions: normalizeSuggestions(suggestions ?? fallback, text)
		});
	} catch {
		return json({
			transcript: text,
			source,
			aiAvailable: true,
			active: { openCount: context.openCount, overdueCount: context.overdueCount },
			suggestions: normalizeSuggestions(fallback, text)
		});
	}
};
