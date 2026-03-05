import { json } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import type { SuggestedAction } from '$types/models';
import { ensureD1Schema, ensureSystemTagTypes } from '$db/bootstrap';

const payloadSchema = z.object({ text: z.string().min(1) });
const suggestionSchema = z.object({
	action: z.enum(['open_loop', 'close_loop', 'add_note', 'update_loop', 'tag_loop']),
	loopId: z.string().optional(),
	title: z.string().optional(),
	content: z.string().nullable().optional(),
	priority: z.enum(['P0', 'P1', 'P2']).optional(),
	deadline: z.string().nullable().optional(),
	project: z.string().nullable().optional(),
	people: z.array(z.string()).optional(),
	tags: z.array(z.string()).optional(),
	text: z.string().optional(),
	changes: z.record(z.string(), z.string().nullable()).optional(),
	tagTypeSlug: z.string().optional(),
	tagValue: z.string().nullable().optional(),
	confidence: z.enum(['high', 'medium', 'low']).optional()
});
const suggestionArraySchema = z.array(suggestionSchema);

type LoopCtx = { id: string; title: string; content: string | null; closed_at: string | null; updated_at: string };
type TagCtx = { loop_id: string; slug: string; value_text: string | null; value_date: string | null };

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
	const names = text.match(/\b[A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})?\b/g) ?? [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const name of names) {
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
		const deadline = extractHeuristicDeadline(part);
		const people = extractHeuristicPeople(part);
		const priority: SuggestedAction['priority'] = /\basap\b|urgent|critical/i.test(lower) ? 'P0' : 'P1';
		if (/\b(done|finished|completed|shipped|resolved)\b/.test(lower)) {
			suggestions.push({ action: 'close_loop', title: part, confidence: 'medium' });
			continue;
		}
		if (/\b(cancel|scratch|kill|nevermind|forget it)\b/.test(lower)) {
			suggestions.push({ action: 'close_loop', title: part, confidence: 'medium' });
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
			people,
			confidence: 'medium'
		});
	}
	return suggestions.length ? suggestions : [{ action: 'open_loop', title: text.trim(), priority: 'P1', confidence: 'medium' }];
}

function parseModelJson(raw: string): SuggestedAction[] | null {
	try {
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) return parsed as SuggestedAction[];
		if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { suggestions?: unknown }).suggestions)) {
			return (parsed as { suggestions: SuggestedAction[] }).suggestions;
		}
		return null;
	} catch {
		const match = raw.match(/\[[\s\S]*\]/);
		if (!match) {
			const objectMatch = raw.match(/\{[\s\S]*\}/);
			if (!objectMatch) return null;
			try {
				const parsed = JSON.parse(objectMatch[0]) as { suggestions?: unknown };
				return Array.isArray(parsed.suggestions) ? (parsed.suggestions as SuggestedAction[]) : null;
			} catch {
				return null;
			}
		}
		try {
			const parsed = JSON.parse(match[0]);
			return Array.isArray(parsed) ? (parsed as SuggestedAction[]) : null;
		} catch {
			return null;
		}
	}
}

function normalizeSuggestions(input: SuggestedAction[] | null | undefined, fallbackText: string): SuggestedAction[] {
	if (!input || input.length === 0) {
		return [{ action: 'open_loop', title: fallbackText, priority: 'P1', confidence: 'low' }];
	}
	const parsed = suggestionArraySchema.safeParse(input);
	const base = parsed.success ? parsed.data : input;
	const cleaned: SuggestedAction[] = [];
	for (const item of base) {
		const confidence: SuggestedAction['confidence'] = item.confidence ?? 'medium';
		const people = item.people?.map((person) => person.trim()).filter(Boolean);
		if (item.action === 'open_loop') {
			const title = item.title?.trim();
			if (!title) continue;
			cleaned.push({ ...item, title, people, priority: item.priority ?? 'P1', confidence });
			continue;
		}
		if (item.action === 'add_note') {
			const noteText = item.text?.trim() || item.title?.trim();
			if (!noteText) continue;
			cleaned.push({ ...item, people, text: noteText, confidence });
			continue;
		}
		if (item.action === 'close_loop' || item.action === 'update_loop' || item.action === 'tag_loop') {
			if (!item.loopId && !item.title) continue;
			cleaned.push({ ...item, people, confidence });
			continue;
		}
	}
	return cleaned.length ? cleaned : [{ action: 'open_loop', title: fallbackText, priority: 'P1', confidence: 'low' }];
}

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
					items: {
						type: 'object',
						additionalProperties: true,
						properties: {
							action: { type: 'string' }
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
	return env?.GROQ_API_KEY ?? privateEnv.GROQ_API_KEY ?? '';
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
	recentNotes: RecentNoteRow[];
	recentEvents: RecentEventRow[];
	openCount: number;
	overdueCount: number;
}

async function loadActiveContext(env: App.Platform['env'], ownerId: string): Promise<FullContext> {
	if (!env?.DB) {
		return { openLoops: [], closedLoops: [], loopTags: [], recentNotes: [], recentEvents: [], openCount: 0, overdueCount: 0 };
	}

	const [openLoops, closedLoops, loopTags, recentNotes, recentEvents] = await Promise.all([
		env.DB.prepare(
			`SELECT id, title, content, closed_at, updated_at
       FROM loops WHERE owner_id = ? AND closed_at IS NULL ORDER BY updated_at DESC`
		).bind(ownerId).all<LoopCtx>(),
		env.DB.prepare(
			`SELECT id, title, content, closed_at, updated_at
       FROM loops WHERE owner_id = ? AND closed_at IS NOT NULL ORDER BY closed_at DESC LIMIT 30`
		).bind(ownerId).all<LoopCtx>(),
		env.DB.prepare(
			`SELECT t.loop_id, tt.slug, t.value_text, t.value_date
       FROM tags t JOIN tag_types tt ON tt.id = t.tag_type_id
       WHERE t.owner_id = ?`
		).bind(ownerId).all<TagCtx>(),
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
		recentNotes: recentNotes.results ?? [],
		recentEvents: recentEvents.results ?? [],
		openCount: open.length,
		overdueCount
	};
}

function formatContextBlock(ctx: FullContext): string {
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

		let line = `- [${l.id}] "${l.title}" | ${meta.join(' | ')}`;

		// Append recent activity
		const notes = loopNotesMap.get(l.id) ?? [];
		const events = loopEventsMap.get(l.id) ?? [];
		const activity = [
			...notes.map((n) => `    note (${n.at}): ${n.body.slice(0, 120)}`),
			...events.map((e) => `    ${e.kind} (${e.at}): ${e.body.slice(0, 120)}`)
		].slice(0, 3);
		if (activity.length > 0) line += '\n' + activity.join('\n');

		return line;
	}

	const sections: string[] = [];

	sections.push('== OPEN LOOPS (with recent activity) ==');
	if (ctx.openLoops.length > 0) {
		sections.push(ctx.openLoops.map(formatOpenLoop).join('\n'));
	} else {
		sections.push('(none)');
	}

	sections.push('\n== RECENTLY CLOSED LOOPS ==');
	if (ctx.closedLoops.length > 0) {
		sections.push(ctx.closedLoops.map((l) => `- [${l.id}] "${l.title}" closed at ${l.closed_at ?? '?'}`).join('\n'));
	} else {
		sections.push('(none)');
	}

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

		const systemPrompt = `You are an expert assistant that parses unstructured brain dumps into precise, structured actions for a loop+tags system.

Return ONLY a JSON object: { "suggestions": [ ... ] }.
Each suggestion object has this shape (include only relevant fields):
{
  "action": "open_loop" | "close_loop" | "add_note" | "update_loop" | "tag_loop",
  "title": "string",
  "content": "optional loop content",
  "priority": "P0" | "P1" | "P2",
  "deadline": "ISO date string or null",
  "project": "project name or null",
  "people": ["name"],
  "tags": ["tag"],
  "loopId": "existing loop id when matching an existing loop",
  "changes": { "field": "new_value" },
  "text": "note text for add_note actions",
  "tagTypeSlug": "slug for custom tag",
  "tagValue": "optional tag value",
  "confidence": "high" | "medium" | "low"
}

RULES:
- Prefer matching existing loops by title and return loopId when confident.
- Convert metadata to tags via update_loop fields (priority, deadline, project, people).
- Use tag_loop for arbitrary custom tags.
- Extract multiple actions from one dump.
- Keep output concise and deterministic.
- Confidence high/medium/low as appropriate.`;

		const userPrompt = `Today is ${dayName}, ${today}.

${formatContextBlock(context)}

Text: ${text}`;

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
