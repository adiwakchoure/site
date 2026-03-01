import { json } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import type { SuggestedAction } from '$types/models';
import { ensureD1Schema } from '$db/bootstrap';

const payloadSchema = z.object({
	text: z.string().min(1)
});

const suggestionSchema = z.object({
	action: z.enum(['open_loop', 'close_loop', 'add_note', 'update_loop', 'create_person', 'create_project']),
	loopId: z.string().optional(),
	title: z.string().optional(),
	priority: z.enum(['P0', 'P1', 'P2']).optional(),
	energy: z.enum(['active', 'waiting', 'someday']).optional(),
	deadline: z.string().nullable().optional(),
	project: z.string().nullable().optional(),
	people: z.array(z.object({ name: z.string(), role: z.enum(['involved', 'waiting_on', 'delegated_to']).optional(), rel: z.string().optional() })).optional(),
	tags: z.array(z.string()).optional(),
	reason: z.enum(['done', 'dropped', 'delegated', 'irrelevant']).optional(),
	text: z.string().optional(),
	changes: z.record(z.string(), z.string().nullable()).optional(),
	name: z.string().optional(),
	rel: z.string().optional(),
	color: z.string().optional(),
	confidence: z.enum(['high', 'medium', 'low']).optional()
});

const suggestionArraySchema = z.array(suggestionSchema);

function extractHeuristicDeadline(text: string): string | null {
	const lower = text.toLowerCase();
	const today = new Date();

	if (/\basap\b|urgent|critical/.test(lower)) return today.toISOString().slice(0, 10);
	if (/\btoday\b|\btonight\b|\beod\b/.test(lower)) return today.toISOString().slice(0, 10);
	if (/\btomorrow\b|\btmrw\b/.test(lower)) {
		const d = new Date(today);
		d.setDate(d.getDate() + 1);
		return d.toISOString().slice(0, 10);
	}

	const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
	const byDayMatch = lower.match(/\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
	if (byDayMatch) {
		const target = dayNames.indexOf(byDayMatch[1]);
		const current = today.getDay();
		let diff = target - current;
		if (diff <= 0) diff += 7;
		const d = new Date(today);
		d.setDate(d.getDate() + diff);
		return d.toISOString().slice(0, 10);
	}

	if (/\bnext week\b/.test(lower)) {
		const d = new Date(today);
		d.setDate(d.getDate() + (8 - d.getDay()));
		return d.toISOString().slice(0, 10);
	}
	if (/\bend of (the )?week\b|\bthis week\b/.test(lower)) {
		const d = new Date(today);
		d.setDate(d.getDate() + (5 - d.getDay()));
		return d.toISOString().slice(0, 10);
	}
	if (/\bend of (the )?month\b|\beom\b/.test(lower)) {
		const d = new Date(today.getFullYear(), today.getMonth() + 1, 0);
		return d.toISOString().slice(0, 10);
	}

	const inDaysMatch = lower.match(/\bin\s+(\d+)\s+days?\b/);
	if (inDaysMatch) {
		const d = new Date(today);
		d.setDate(d.getDate() + parseInt(inDaysMatch[1]));
		return d.toISOString().slice(0, 10);
	}

	return null;
}

function extractHeuristicPeople(text: string): Array<{ name: string; role: 'involved' | 'waiting_on' | 'delegated_to' }> {
	const people: Array<{ name: string; role: 'involved' | 'waiting_on' | 'delegated_to' }> = [];
	const capitalized = text.match(/\b[A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})?\b/g) ?? [];
	const stopWords = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'ASAP', 'The', 'This', 'That', 'What', 'When', 'Where', 'How', 'Also', 'Need', 'Done', 'Just', 'Still', 'Review']);
	const lower = text.toLowerCase();
	const seen = new Set<string>();

	for (const name of capitalized) {
		if (stopWords.has(name) || seen.has(name.toLowerCase())) continue;
		seen.add(name.toLowerCase());
		let role: 'involved' | 'waiting_on' | 'delegated_to' = 'involved';
		const namePattern = name.toLowerCase();
		if (new RegExp(`waiting\\s+on\\s+${namePattern}|blocked\\s+by\\s+${namePattern}|need\\s+${namePattern}\\s+to`, 'i').test(lower)) {
			role = 'waiting_on';
		} else if (new RegExp(`delegat\\w*\\s+to\\s+${namePattern}|hand\\w*\\s+(it\\s+)?to\\s+${namePattern}|ask\\w*\\s+${namePattern}\\s+to\\s+handle`, 'i').test(lower)) {
			role = 'delegated_to';
		}
		people.push({ name, role });
	}
	return people;
}

function heuristicSuggestions(text: string): SuggestedAction[] {
	const normalized = text.trim();
	const parts = normalized
		.split(/\n+|[.;](?=\s|$)/g)
		.map((part) => part.trim())
		.filter(Boolean)
		.slice(0, 8);
	const suggestions: SuggestedAction[] = [];
	for (const part of parts) {
		const lower = part.toLowerCase();
		const deadline = extractHeuristicDeadline(part);
		const people = extractHeuristicPeople(part);
		const priority: SuggestedAction['priority'] = /\basap\b|urgent|critical/i.test(lower) ? 'P0' : deadline ? 'P1' : 'P1';
		const energy: SuggestedAction['energy'] = /waiting\s+on|blocked|pending/i.test(lower) ? 'waiting' : /someday|maybe|eventually/i.test(lower) ? 'someday' : 'active';

		if (/\b(cancel|scratch|kill|nevermind|never mind|forget it)\b/.test(lower)) {
			suggestions.push({ action: 'close_loop', title: part, reason: 'dropped', confidence: 'medium' });
			continue;
		}
		if (/\b(done|finished|completed|shipped|resolved)\b/.test(lower)) {
			suggestions.push({ action: 'close_loop', title: part, reason: 'done', confidence: 'medium' });
			continue;
		}
		if (/\b(delegated|handed off|passed to)\b/.test(lower)) {
			suggestions.push({ action: 'close_loop', title: part, reason: 'delegated', people: people.length > 0 ? people : undefined, confidence: 'medium' });
			continue;
		}
		if (/\b(note|status|update)\b/.test(lower)) {
			suggestions.push({ action: 'add_note', text: part.replace(/^(note|status|update)[: ]*/i, ''), people: people.length > 0 ? people : undefined, confidence: 'medium' });
			continue;
		}
		suggestions.push({
			action: 'open_loop',
			title: part,
			priority,
			energy,
			deadline: deadline ?? null,
			people: people.length > 0 ? people : undefined,
			confidence: 'medium'
		});
	}
	return suggestions.length ? suggestions : [{ action: 'open_loop', title: normalized, priority: 'P1', energy: 'active', confidence: 'medium' }];
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
		return [{ action: 'open_loop', title: fallbackText, priority: 'P1', energy: 'active', confidence: 'low' }];
	}
	const parsed = suggestionArraySchema.safeParse(input);
	const base = parsed.success ? parsed.data : input;
	const cleaned: SuggestedAction[] = [];
	for (const item of base) {
		const confidence: SuggestedAction['confidence'] = item.confidence ?? 'medium';
		const people = item.people?.map((person) => ({ name: person.name, role: person.role ?? 'involved', rel: person.rel }));
		if (item.action === 'open_loop') {
			const title = item.title?.trim();
			if (!title) continue;
			cleaned.push({ ...item, title, people, priority: item.priority ?? 'P1', energy: item.energy ?? 'active', confidence });
			continue;
		}
		if (item.action === 'add_note') {
			const noteText = item.text?.trim() || item.title?.trim();
			if (!noteText) continue;
			cleaned.push({ ...item, people, text: noteText, confidence });
			continue;
		}
		if (item.action === 'close_loop' || item.action === 'update_loop') {
			if (!item.loopId && !item.title) continue;
			cleaned.push({ ...item, people, confidence });
			continue;
		}
		if ((item.action === 'create_person' || item.action === 'create_project') && !item.name) continue;
		cleaned.push({ ...item, people, confidence });
	}
	return cleaned.length ? cleaned : [{ action: 'open_loop', title: fallbackText, priority: 'P1', energy: 'active', confidence: 'low' }];
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

type LoopRow = { id: string; title: string; body: string; energy: string; priority: string; deadline: string | null; project_id: string | null; closed_reason: string | null; closed_at: string | null; created_at: string; updated_at: string };
type PersonRow = { id: string; name: string; rel: string };
type ProjectRow = { id: string; name: string; color: string; emoji: string | null; archived: number };
type LoopPersonRow = { loop_id: string; person_id: string; person_name: string; role: string };
type RecentNoteRow = { loop_id: string; body: string; created_at: string };
type RecentEventRow = { loop_id: string; kind: string; body: string | null; created_at: string };

interface FullContext {
	openLoops: LoopRow[];
	closedLoops: LoopRow[];
	people: PersonRow[];
	projects: ProjectRow[];
	loopPeople: LoopPersonRow[];
	recentNotes: RecentNoteRow[];
	recentEvents: RecentEventRow[];
	openCount: number;
	overdueCount: number;
}

async function loadActiveContext(env: App.Platform['env']): Promise<FullContext> {
	if (!env?.DB) {
		return { openLoops: [], closedLoops: [], people: [], projects: [], loopPeople: [], recentNotes: [], recentEvents: [], openCount: 0, overdueCount: 0 };
	}

	const [openLoops, closedLoops, people, projects, loopPeople, recentNotes, recentEvents] = await Promise.all([
		env.DB.prepare(
			`SELECT id, title, body, energy, priority, deadline, project_id, updated_at, created_at, NULL as closed_reason, NULL as closed_at
       FROM loops WHERE state = 'open' ORDER BY updated_at DESC`
		).all<LoopRow>(),
		env.DB.prepare(
			`SELECT id, title, body, energy, priority, deadline, project_id, updated_at, created_at, closed_reason, closed_at
       FROM loops WHERE state = 'closed' ORDER BY closed_at DESC LIMIT 30`
		).all<LoopRow>(),
		env.DB.prepare(
			`SELECT id, name, rel FROM people ORDER BY name ASC`
		).all<PersonRow>(),
		env.DB.prepare(
			`SELECT id, name, color, emoji, archived FROM projects ORDER BY archived ASC, name ASC`
		).all<ProjectRow>(),
		env.DB.prepare(
			`SELECT lp.loop_id, lp.person_id, p.name as person_name, lp.role
       FROM loop_person lp JOIN people p ON p.id = lp.person_id`
		).all<LoopPersonRow>(),
		env.DB.prepare(
			`SELECT ln.loop_id, ln.body, ln.created_at
       FROM loop_notes ln
       JOIN loops l ON l.id = ln.loop_id AND l.state = 'open'
       ORDER BY ln.created_at DESC LIMIT 100`
		).all<RecentNoteRow>(),
		env.DB.prepare(
			`SELECT e.loop_id, e.kind, e.body, e.created_at
       FROM events e
       JOIN loops l ON l.id = e.loop_id AND l.state = 'open'
       WHERE e.kind IN ('noted', 'updated', 'created')
       ORDER BY e.created_at DESC LIMIT 100`
		).all<RecentEventRow>()
	]);

	const open = openLoops.results ?? [];
	const overdueCount = open.filter((t) => t.deadline && +new Date(t.deadline) < Date.now()).length;

	return {
		openLoops: open,
		closedLoops: closedLoops.results ?? [],
		people: people.results ?? [],
		projects: projects.results ?? [],
		loopPeople: loopPeople.results ?? [],
		recentNotes: recentNotes.results ?? [],
		recentEvents: recentEvents.results ?? [],
		openCount: open.length,
		overdueCount
	};
}

function formatContextBlock(ctx: FullContext): string {
	const projectMap = new Map(ctx.projects.map((p) => [p.id, p.name]));

	// Group people per loop
	const loopPeopleMap = new Map<string, string[]>();
	for (const lp of ctx.loopPeople) {
		const list = loopPeopleMap.get(lp.loop_id) ?? [];
		list.push(`${lp.person_name} (${lp.role.replace('_', ' ')})`);
		loopPeopleMap.set(lp.loop_id, list);
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

	function formatOpenLoop(l: LoopRow): string {
		const meta: string[] = [`${l.priority}, ${l.energy}`];
		if (l.deadline) meta.push(`due ${l.deadline}`);
		const proj = l.project_id ? projectMap.get(l.project_id) : null;
		if (proj) meta.push(`project: ${proj}`);
		const people = loopPeopleMap.get(l.id);
		if (people?.length) meta.push(`people: ${people.join(', ')}`);
		meta.push(`opened ${l.created_at.slice(0, 10)}, updated ${l.updated_at.slice(0, 10)}`);

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
		sections.push(ctx.closedLoops.map((l) => `- [${l.id}] "${l.title}" closed=${l.closed_reason ?? 'done'} at ${l.closed_at ?? '?'}`).join('\n'));
	} else {
		sections.push('(none)');
	}

	sections.push('\n== PEOPLE ==');
	if (ctx.people.length > 0) {
		sections.push(ctx.people.map((p) => `- ${p.name}${p.rel ? ` (${p.rel})` : ''}`).join('\n'));
	} else {
		sections.push('(none)');
	}

	sections.push('\n== PROJECTS ==');
	if (ctx.projects.length > 0) {
		sections.push(ctx.projects.map((p) => `- ${p.name}${p.archived ? ' [archived]' : ''}`).join('\n'));
	} else {
		sections.push('(none)');
	}

	return sections.join('\n');
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;
	await ensureD1Schema(env as App.Platform['env'] | undefined);
	const groqApiKey = resolveGroqApiKey(env as App.Platform['env'] | undefined);
	const aiAvailable = Boolean(groqApiKey);
	const contentType = request.headers.get('content-type') ?? '';
	const context = await loadActiveContext(env as App.Platform['env']);

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
				suggestions: [{ action: 'open_loop', title: 'Review voice dump', priority: 'P1', energy: 'active', confidence: 'low' }]
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
				suggestions: [{ action: 'open_loop', title: 'Review voice dump', priority: 'P1', energy: 'active', confidence: 'low' }]
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

		const systemPrompt = `You are an expert assistant that parses unstructured brain dumps into precise, structured actions. You understand natural language deeply — people talk in fragments, abbreviations, and stream-of-consciousness. Your job is to extract EVERY actionable item and categorize it correctly.

Return ONLY a JSON object: { "suggestions": [ ... ] }.
Each suggestion object has this shape (include only relevant fields):
{
  "action": "open_loop" | "close_loop" | "add_note" | "update_loop" | "create_person" | "create_project",
  "title": "string (concise, imperative — e.g. 'Follow up with Sarah on proposal')",
  "priority": "P0" | "P1" | "P2",
  "energy": "active" | "waiting" | "someday",
  "deadline": "ISO date string or null",
  "project": "project name or null",
  "people": [{ "name": "string", "role": "involved" | "waiting_on" | "delegated_to", "rel": "inferred relationship" }],
  "tags": ["tag"],
  "loopId": "existing loop id when matching an existing loop",
  "reason": "done" | "dropped" | "delegated" | "irrelevant",
  "changes": { "field": "new_value" },
  "text": "note text for add_note actions",
  "name": "for create_person / create_project",
  "rel": "relationship description for create_person",
  "color": "#hex for create_project",
  "confidence": "high" | "medium" | "low"
}

== ACTION SELECTION RULES ==
IMPORTANT: Most brain dumps are about EXISTING loops — updates, progress, closures, priority shifts. Creating new loops is less common. Always try to match against existing loops FIRST.

1. UPDATE EXISTING (add_note) — THE MOST COMMON ACTION:
   Any mention of progress, status, context, or new information about an existing loop → add_note.
   - "talked to Sarah about the proposal" → add_note on the proposal loop, text = "Talked to Sarah about it"
   - "deck is 80% done" → add_note on the deck loop, text = "80% done"
   - "Mike said he'll review it tomorrow" → add_note, text = "Mike said he'll review tomorrow"
   - Use the recent activity shown under each loop to avoid duplicating notes that were just added.
   - Always include loopId and a concise text field summarizing the update.

2. CLOSE LOOP (close_loop) — SECOND MOST COMMON:
   - Completed/done/finished/shipped/resolved/sorted/handled → reason "done"
   - Cancel/scratch/kill/nevermind/forget it/don't need → reason "dropped"
   - Delegated/handed off/passed to/gave it to X → reason "delegated"
   - No longer relevant/doesn't matter anymore → reason "irrelevant"
   - "the dentist thing is sorted" → close_loop with reason "done"
   - Always include loopId. Fuzzy-match the title against OPEN LOOPS.

3. MODIFY LOOP (update_loop):
   - New deadline: "push the deck to Friday" → update_loop with changes: { "deadline": "2026-03-06" }
   - Priority change: "the API thing is actually urgent" → update_loop with changes: { "priority": "P0" }
   - Energy change: "waiting on Mike for the designs" → update_loop with changes: { "energy": "waiting" }
   - Can combine: "push the deck to Friday and make it P0" → one update_loop with both changes
   - Always include loopId.

4. NEW LOOP (open_loop) — ONLY when genuinely new:
   - A task/idea that doesn't relate to ANY existing open loop.
   - "need to book flights for the conference" (and no flight/conference loop exists) → open_loop
   - DON'T create a new loop if an existing one covers the topic — add a note instead.

5. MULTIPLE ACTIONS: A single dump often contains several. Extract ALL in order.
   - "Called Mike about the deck, he said by Friday. Also the dentist thing is done. Oh and I need to set up the new CI pipeline."
   = add_note (deck loop) + update_loop (deck deadline→Friday) + close_loop (dentist) + open_loop (CI pipeline)
   - An update and a deadline change on the same loop should be SEPARATE actions (add_note + update_loop) so both are tracked.

6. PROJECTS: Fuzzy-match against PROJECTS list. If the user groups tasks under a clear theme/project name that doesn't exist yet, include it as the "project" field — it will be auto-created.

7. RECENTLY CLOSED: Don't suggest closing something already closed. If the user mentions a closed loop with new info, use open_loop to reopen it or add_note if they're just reflecting.

== AUTO-CREATION ==
The system automatically creates people and projects when you reference them.
- Include people directly in the "people" array of ANY action. If the person doesn't exist yet, they'll be created automatically. No need for a separate create_person action.
- Include projects by name in the "project" field. If the project doesn't exist, it'll be created automatically. No need for a separate create_project action.
- Use create_person / create_project ONLY for standalone requests like "add Sarah as a contact" or "create a project called Marketing" with no associated loop action.

== PEOPLE EXTRACTION ==
- Recognize names in ANY position: "told Sarah", "meeting with Jake", "Sarah said", "from Mike", "Mike's thing"
- Determine role from context:
  - "waiting on X", "need X to", "blocked by X", "X hasn't" → role: "waiting_on"
  - "delegated to X", "handed X", "asked X to handle", "X is taking over" → role: "delegated_to"
  - Otherwise → role: "involved"
- Fuzzy-match against PEOPLE list first (use the relationship context to disambiguate). If no match, just use the name directly — the system auto-creates people. Infer relationship (colleague, client, friend, etc.) and include it in the "rel" field of the person object.
- Attach people to the relevant loop action, not as standalone items.
- When a loop already has people assigned (shown in OPEN LOOPS), carry them forward — don't lose existing associations.

== DEADLINE EXTRACTION ==
Parse natural-language dates relative to today:
- "today" / "tonight" / "eod" → today's date
- "tomorrow" / "tmrw" → next day
- "this week" / "by Friday" / "by end of week" → that weekday this week (or next week if already passed)
- "next week" / "next Monday" → the corresponding day next week
- "next month" → 1st of next month
- "end of month" / "eom" → last day of current month
- "in X days" → today + X days
- Explicit dates: "March 15", "3/15", "15th" → the nearest future occurrence
- "ASAP" / "urgent" → set deadline to today AND priority to P0
- If no deadline mentioned, leave deadline as null.
Always output deadlines as ISO date strings (YYYY-MM-DD).

== PRIORITY INFERENCE ==
- Explicit: "urgent", "critical", "ASAP", "fire", "P0" → P0
- Explicit: "important", "high priority", "P1" → P1
- Explicit: "low priority", "whenever", "someday", "P2" → P2
- From deadline proximity: due today/tomorrow → P0, due this week → P1, due later → P2
- Default when unclear: P1

== ENERGY INFERENCE ==
- "waiting on", "blocked", "pending", "need X first" → waiting
- "someday", "maybe", "would be nice", "eventually" → someday
- Active tasks, todos, follow-ups → active
- Default: active

== CONFIDENCE ==
- high: explicit, unambiguous instruction ("Schedule meeting with Sarah for Friday")
- medium: reasonable inference ("talked to Sarah about the deck" → add_note to deck-related loop)
- low: vague or uncertain ("maybe something about that thing")`;

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
