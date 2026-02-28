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
	people: z.array(z.object({ name: z.string(), role: z.enum(['involved', 'waiting_on', 'delegated_to']).optional() })).optional(),
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
		if (/cancel|scratch|kill|nevermind|never mind|forget it/.test(lower)) {
			suggestions.push({ action: 'close_loop', title: part, reason: 'dropped', confidence: 'medium' });
			continue;
		}
		if (/note|status|update/.test(lower)) {
			suggestions.push({ action: 'add_note', text: part.replace(/^note[: ]*/i, ''), confidence: 'medium' });
			continue;
		}
		suggestions.push({ action: 'open_loop', title: part, priority: 'P1', energy: 'active', confidence: 'medium' });
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
		const people = item.people?.map((person) => ({ name: person.name, role: person.role ?? 'involved' }));
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

async function runReasoningWithGroq(prompt: string, temperature: number, apiKey: string): Promise<string> {
	const response = await fetch(`${GROQ_API_BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: GROQ_REASONING_MODEL,
			messages: [
				{ role: 'system', content: 'Return strictly JSON with shape: { "suggestions": [...] }.' },
				{ role: 'user', content: prompt }
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

async function loadActiveContext(env: App.Platform['env']) {
	if (!env?.DB) {
		return { openLoops: [], people: [], projects: [], openCount: 0, overdueCount: 0 };
	}

	const [loops, people, projects] = await Promise.all([
		env.DB.prepare(
			`SELECT id, title, energy, priority, deadline
       FROM loops
       WHERE state = 'open'
       ORDER BY updated_at DESC
       LIMIT 25`
		).all<{
			id: string;
			title: string;
			energy: string;
			priority: string;
			deadline: string | null;
		}>(),
		env.DB.prepare(`SELECT name FROM people ORDER BY created_at DESC LIMIT 25`).all<{ name: string }>(),
		env.DB.prepare(`SELECT name FROM projects WHERE archived = 0 ORDER BY created_at DESC LIMIT 25`).all<{ name: string }>()
	]);

	const openLoops = loops.results ?? [];
	const overdueCount = openLoops.filter((t) => t.deadline && +new Date(t.deadline) < Date.now()).length;
	return {
		openLoops,
		people: (people.results ?? []).map((p) => p.name),
		projects: (projects.results ?? []).map((p) => p.name),
		openCount: openLoops.length,
		overdueCount
	};
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
		const prompt = `
You extract structured actions from brain dumps.
Return ONLY JSON object: { "suggestions": [ ... ] }.
Each object:
{
  "action": "open_loop" | "close_loop" | "add_note" | "update_loop" | "create_person" | "create_project",
  "title": "string",
  "priority": "P0" | "P1" | "P2",
  "energy": "active" | "waiting" | "someday",
  "deadline": "ISO or null",
  "project": "name or null",
  "people": [{ "name": "string", "role": "involved" | "waiting_on" | "delegated_to" }],
  "tags": ["tag"],
  "loopId": "existing loop id when relevant",
  "reason": "done" | "dropped" | "delegated" | "irrelevant",
  "changes": { "priority": "P0" },
  "text": "for add_note (timeline update entry)",
  "name": "for create_person/create_project",
  "rel": "for create_person",
  "color": "#a0714a",
  "confidence": "high | medium | low"
}
OPEN LOOPS:
${context.openLoops
	.map((t) => `- [${t.id}] "${t.title}" (${t.energy}, ${t.priority}) due=${t.deadline ?? 'none'}`)
	.join('\n')}

KNOWN PEOPLE:
${context.people.map((p) => `- ${p}`).join('\n')}

KNOWN PROJECTS:
${context.projects.map((p) => `- ${p}`).join('\n')}

RULES:
- Extract ALL actionable items in narrative order.
- If text says completed/done/finished/shipped -> close_loop reason done.
- If text says cancel/scratch/kill/nevermind -> close_loop reason dropped.
- If text says delegated/handed to -> close_loop reason delegated.
- If text mentions existing loop, prefer update_loop/close_loop/add_note over open_loop.
- Use add_note for progress updates/history entries on an existing loop.
- Infer person/project names by fuzzy match with known lists.
- Mentioned unknown people/projects should include create_person/create_project.
Text: ${text}
`.trim();

		const runModel = async (temperature: number) => runReasoningWithGroq(prompt, temperature, groqApiKey);

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
