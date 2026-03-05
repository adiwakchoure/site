import { describe, expect, it } from 'vitest';
import { _formatContextBlock, _normalizeSuggestions, _parseModelJson } from './+server';

describe('parseModelJson', () => {
	it('parses strict response object', () => {
		const raw = JSON.stringify({
			suggestions: [{ action: 'open_loop', title: 'Refine dump prompts', confidence: 'high' }]
		});
		const parsed = _parseModelJson(raw);
		expect(parsed).toBeTruthy();
		expect(Array.isArray(parsed)).toBe(true);
		expect(parsed?.length).toBe(1);
	});

	it('extracts embedded json block from noisy output', () => {
		const raw = `thinking...\n{"suggestions":[{"action":"add_note","title":"Refactor API","text":"Edge cache shipped"}]}\nfinal`;
		const parsed = _parseModelJson(raw);
		expect(parsed).toBeTruthy();
		expect(parsed?.[0]).toMatchObject({ action: 'add_note' });
	});
});

describe('normalizeSuggestions', () => {
	it('drops malformed suggestions and keeps valid actions', () => {
		const input = [
			{ action: 'open_loop', title: 'Shore up parsing' },
			{ action: 'open_loop' },
			{ action: 'bad_action', title: 'ignore me' }
		];
		const normalized = _normalizeSuggestions(input, 'fallback title');
		expect(normalized).toHaveLength(1);
		expect(normalized[0]).toMatchObject({ action: 'open_loop', title: 'Shore up parsing' });
	});

	it('falls back when no valid entries remain', () => {
		const normalized = _normalizeSuggestions([{ action: 'invalid' }], 'fallback title');
		expect(normalized).toHaveLength(1);
		expect(normalized[0]).toMatchObject({ action: 'open_loop', title: 'fallback title', confidence: 'low' });
	});

	it('normalizes tag_loop remove mode', () => {
		const normalized = _normalizeSuggestions(
			[{ action: 'tag_loop', title: 'Homepage refresh', tagTypeSlug: 'Blocked By', tagValue: null }],
			'fallback title'
		);
		expect(normalized).toHaveLength(1);
		expect(normalized[0]).toMatchObject({
			action: 'tag_loop',
			tagTypeSlug: 'blocked by',
			tagValue: null,
			tagMode: 'remove'
		});
	});
});

describe('formatContextBlock', () => {
	it('includes tag catalog and custom tags in loop context', () => {
		const rendered = _formatContextBlock({
			openLoops: [{ id: 'loop_1', title: 'Ship tags', content: null, closed_at: null, updated_at: '2026-03-05T11:00:00Z' }],
			closedLoops: [],
			loopTags: [
				{ loop_id: 'loop_1', slug: 'priority', value_text: 'P0', value_date: null, value_number: null, value_json: null },
				{ loop_id: 'loop_1', slug: 'effort', value_text: 'high', value_date: null, value_number: null, value_json: null }
			],
			tagTypes: [
				{ id: 'tt_priority', slug: 'priority', name: 'Priority', value_kind: 'text', multi: 0 },
				{ id: 'tt_effort', slug: 'effort', name: 'Effort', value_kind: 'text', multi: 0 }
			],
			recentNotes: [],
			recentEvents: [],
			openCount: 1,
			overdueCount: 0
		});
		expect(rendered).toContain('== TAG CATALOG ==');
		expect(rendered).toContain('- effort (text) name="Effort"');
		expect(rendered).toContain('custom: effort=high');
	});
});
