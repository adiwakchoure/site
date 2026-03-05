import { describe, expect, it } from 'vitest';
import { isNoopMutationPlan, mapSuggestionToMutationPlan, normalizeTagSlug } from './mutation-plan';

describe('normalizeTagSlug', () => {
	it('normalizes custom tag names', () => {
		expect(normalizeTagSlug('Needs Review')).toBe('needs_review');
		expect(normalizeTagSlug('#Launch')).toBe('launch');
	});
});

describe('mapSuggestionToMutationPlan', () => {
	it('maps open_loop into create_loop with tag patches', () => {
		const plan = mapSuggestionToMutationPlan({
			action: 'open_loop',
			title: 'Ship API hardening',
			priority: 'P0',
			deadline: '2026-03-09',
			project: 'engram',
			people: ['Aditya'],
			tags: ['#launch']
		});
		expect(plan?.kind).toBe('create_loop');
		expect(plan?.changes?.priority).toBe('P0');
		expect(plan?.tags?.some((tag) => tag.slug === 'person' && tag.value === 'Aditya')).toBe(true);
		expect(plan?.tags?.some((tag) => tag.slug === 'launch')).toBe(true);
	});

	it('maps update_loop without fields to noop plan', () => {
		const plan = mapSuggestionToMutationPlan({
			action: 'update_loop',
			title: 'ThreadDetail polish'
		});
		expect(plan).toBeTruthy();
		expect(isNoopMutationPlan(plan!)).toBe(true);
	});

	it('marks update_loop with changes as non-noop', () => {
		const plan = mapSuggestionToMutationPlan({
			action: 'update_loop',
			title: 'ThreadDetail polish',
			changes: { project: 'engram' }
		});
		expect(plan).toBeTruthy();
		expect(isNoopMutationPlan(plan!)).toBe(false);
	});
});
