import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import type { SuggestedAction } from '$types/models';

const payloadSchema = z.object({
	text: z.string().min(1)
});

function heuristicSuggestions(text: string): SuggestedAction[] {
	const normalized = text.trim();
	const lower = normalized.toLowerCase();
	if (/cancel|scratch|kill|nevermind|never mind|forget it/.test(lower)) {
		return [{ action: 'close_loop', reason: 'dropped', confidence: 'medium' }];
	}
	if (/note|status|update/.test(lower)) {
		return [{ action: 'add_note', text: normalized.replace(/^note[: ]*/i, ''), confidence: 'medium' }];
	}
	return [{ action: 'open_loop', title: normalized, priority: 'P1', energy: 'active', confidence: 'medium' }];
}

function parseModelJson(raw: string): SuggestedAction[] | null {
	try {
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) return parsed as SuggestedAction[];
		return null;
	} catch {
		const match = raw.match(/\[[\s\S]*\]/);
		if (!match) return null;
		try {
			const parsed = JSON.parse(match[0]);
			return Array.isArray(parsed) ? (parsed as SuggestedAction[]) : null;
		} catch {
			return null;
		}
	}
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
	const contentType = request.headers.get('content-type') ?? '';
	const context = await loadActiveContext(env as App.Platform['env']);

	let text = '';
	let source: 'text' | 'voice' = 'text';

	if (contentType.includes('multipart/form-data')) {
		const form = await request.formData();
		const audio = form.get('audio');
		if (!(audio instanceof File)) return json({ error: 'Missing audio file' }, { status: 400 });
		source = 'voice';

		if (!env?.AI) {
			return json({
				transcript: '',
				source,
				aiAvailable: false,
				suggestions: [{ action: 'open_loop', title: 'Review voice dump', priority: 'P1', energy: 'active', confidence: 'low' }]
			});
		}

		try {
			const buffer = await audio.arrayBuffer();
			const uint8 = Array.from(new Uint8Array(buffer));
			const whisper = await (env.AI as any).run('@cf/openai/whisper', {
				audio: uint8
			});
			text =
				typeof whisper === 'object' && whisper && 'text' in whisper ? String((whisper as { text: string }).text ?? '') : '';
		} catch {
			text = '';
		}

		if (!text.trim()) {
			return json({
				transcript: '',
				source,
				aiAvailable: !!env?.AI,
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

	if (!env?.AI) {
		return json({
			transcript: text,
			source,
			aiAvailable: false,
			active: { openCount: context.openCount, overdueCount: context.overdueCount },
			suggestions: fallback
		});
	}

	try {
		const prompt = `
You extract structured actions from brain dumps.
Return ONLY a JSON array.
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
  "text": "for add_note",
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
- Infer person/project names by fuzzy match with known lists.
- Mentioned unknown people/projects should include create_person/create_project.
Text: ${text}
`.trim();

		const runModel = async (temperature: number) =>
			(env.AI as any).run('@cf/zai-org/glm-4.7-flash', {
				messages: [
					{ role: 'system', content: 'Return strictly JSON array only.' },
					{ role: 'user', content: prompt }
				],
				temperature
			});

		let result = await runModel(0.2);
		let responseText =
			typeof result === 'object' && result && 'response' in result ? String(result.response ?? '') : '';
		let suggestions = parseModelJson(responseText);
		if (!suggestions) {
			result = await runModel(0.1);
			responseText = typeof result === 'object' && result && 'response' in result ? String(result.response ?? '') : '';
			suggestions = parseModelJson(responseText);
		}

		return json({
			transcript: text,
			source,
			aiAvailable: true,
			active: { openCount: context.openCount, overdueCount: context.overdueCount },
			suggestions: suggestions ?? [{ action: 'open_loop', title: text, priority: 'P1', energy: 'active', confidence: 'low' }]
		});
	} catch {
		return json({
			transcript: text,
			source,
			aiAvailable: true,
			active: { openCount: context.openCount, overdueCount: context.overdueCount },
			suggestions: [{ action: 'open_loop', title: text, priority: 'P1', energy: 'active', confidence: 'low' }]
		});
	}
};
