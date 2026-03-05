import { describe, expect, it } from 'vitest';
import { _normalizeSuggestions, _parseModelJson } from './+server';

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
});
