import type { SuggestionMutationPlan, SuggestedAction } from '$types/models';

export function normalizeTagSlug(raw: string): string {
	return raw.trim().toLowerCase().replace(/^[@#]+/, '').replace(/\s+/g, '_');
}

export function mapSuggestionToMutationPlan(item: SuggestedAction): SuggestionMutationPlan | null {
	if (item.action === 'open_loop') {
		return {
			kind: 'create_loop',
			title: item.title,
			content: item.content ?? null,
			changes: {
				priority: item.priority ?? 'P1',
				deadline: item.deadline ?? null,
				project: item.project ?? null
			},
			tags: [
				{ slug: 'priority', value: item.priority ?? 'P1' },
				...(item.deadline ? [{ slug: 'deadline', value: item.deadline, valueKind: 'date' as const }] : []),
				...(item.project ? [{ slug: 'project', value: item.project }] : []),
				...(item.people ?? []).map((name) => ({ slug: 'person', value: name, multi: true })),
				...(item.tags ?? []).map((slug) => ({ slug: normalizeTagSlug(slug), value: 'true', multi: true }))
			],
			confidence: item.confidence
		};
	}

	if (item.action === 'close_loop') {
		return {
			kind: 'close_loop',
			loopId: item.loopId,
			loopTitleHint: item.title,
			tags: (item.people ?? []).map((name) => ({ slug: 'person', value: name, multi: true })),
			confidence: item.confidence
		};
	}

	if (item.action === 'add_note') {
		return {
			kind: 'add_note',
			loopId: item.loopId,
			loopTitleHint: item.title,
			noteText: item.text,
			tags: (item.people ?? []).map((name) => ({ slug: 'person', value: name, multi: true })),
			confidence: item.confidence
		};
	}

	if (item.action === 'update_loop') {
		return {
			kind: 'update_loop',
			loopId: item.loopId,
			loopTitleHint: item.title,
			changes: {
				title: item.changes?.title,
				content: item.changes?.content ?? item.content,
				priority: item.changes?.priority ?? item.priority,
				deadline: item.changes?.deadline ?? item.deadline,
				project: item.changes?.project ?? item.project
			},
			tags: [
				...(item.tagTypeSlug ? [{ slug: normalizeTagSlug(item.tagTypeSlug), value: item.tagValue ?? null, multi: true }] : []),
				...(item.people ?? []).map((name) => ({ slug: 'person', value: name, multi: true }))
			],
			confidence: item.confidence
		};
	}

	if (item.action === 'tag_loop') {
		return {
			kind: 'set_tag',
			loopId: item.loopId,
			loopTitleHint: item.title,
			tags: [{ slug: normalizeTagSlug(item.tagTypeSlug), value: item.tagValue ?? null, multi: true }],
			confidence: item.confidence
		};
	}

	return null;
}

export function isNoopMutationPlan(plan: SuggestionMutationPlan): boolean {
	if (plan.kind === 'create_loop') return !plan.title?.trim();
	if (plan.kind === 'close_loop') return false;
	if (plan.kind === 'add_note') return !plan.noteText?.trim();
	if (plan.kind === 'set_tag') return !plan.tags || plan.tags.length === 0;
	if (plan.kind === 'update_loop') {
		const changes = plan.changes ?? {};
		const hasLoopFieldChange = Boolean(changes.title?.trim()) || typeof changes.content === 'string';
		const hasTagFieldChange = changes.priority !== undefined || changes.deadline !== undefined || changes.project !== undefined;
		const hasExtraTags = Boolean(plan.tags && plan.tags.length > 0);
		return !hasLoopFieldChange && !hasTagFieldChange && !hasExtraTags;
	}
	return true;
}
