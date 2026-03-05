import { addUpdate, applyLoopTagPatches, closeLoop, createLoop, setSuggestionStatus, updateLoop, updateLoopTags } from '$db/local';
import { get } from 'svelte/store';
import { loopsStore, tagTypesStore, tagsStore, deriveLoopViews } from '$stores/app';
import type { SuggestionApplyResult, SuggestionMutationPlan, SuggestedAction } from '$types/models';
import { isNoopMutationPlan, mapSuggestionToMutationPlan } from '$lib/suggestions/mutation-plan';

async function resolveLoopId(item: SuggestedAction): Promise<string | null> {
	if (item.loopId) return item.loopId;
	const query = (item.title ?? item.text ?? '').trim().toLowerCase();
	if (!query) return null;
	const loops = get(loopsStore) ?? [];
	const tags = get(tagsStore) ?? [];
	const tagTypes = get(tagTypesStore) ?? [];
	const loopViews = deriveLoopViews(loops, tags, tagTypes);
	const exact = loopViews.find((loop) => loop.title.toLowerCase() === query);
	if (exact) return exact.id;
	const includes = loopViews.find((loop) => loop.title.toLowerCase().includes(query) || query.includes(loop.title.toLowerCase()));
	return includes?.id ?? null;
}

async function resolvePlanLoopId(plan: SuggestionMutationPlan): Promise<string | null> {
	if (plan.loopId) return plan.loopId;
	if (!plan.loopTitleHint) return null;
	return resolveLoopId({ action: 'close_loop', title: plan.loopTitleHint });
}

async function applyMutationPlan(plan: SuggestionMutationPlan, dumpId: string | null): Promise<SuggestionApplyResult> {
	if (isNoopMutationPlan(plan)) {
		return { applied: false, reason: 'no meaningful changes to apply' };
	}
	if (plan.kind === 'create_loop') {
		const createTitle = plan.title?.trim();
		if (!createTitle) return { applied: false, reason: 'no meaningful changes to apply' };
		const loop = await createLoop({
			title: createTitle,
			content: plan.content ?? null,
			priority: plan.changes?.priority ?? 'P1',
			deadline: plan.changes?.deadline ?? null,
			project: plan.changes?.project ?? null,
			tags: [],
			dumpId
		});
		await applyLoopTagPatches(loop.id, plan.tags ?? []);
		return { applied: true, loopId: loop.id };
	}

	const loopId = await resolvePlanLoopId(plan);
	if (!loopId) return { applied: false, reason: 'could not resolve target loop' };

	if (plan.kind === 'close_loop') {
		const closed = await closeLoop(loopId, dumpId);
		if (!closed) return { applied: false, reason: 'target loop not found' };
		await applyLoopTagPatches(loopId, plan.tags ?? []);
		return { applied: true, loopId };
	}

	if (plan.kind === 'add_note') {
		if (!plan.noteText?.trim()) return { applied: false, reason: 'missing note text' };
		await addUpdate(loopId, plan.noteText.trim(), dumpId);
		await applyLoopTagPatches(loopId, plan.tags ?? []);
		return { applied: true, loopId };
	}

	if (plan.kind === 'update_loop') {
		const changes = plan.changes ?? {};
		let mutated = false;
		if (typeof changes.title === 'string' && changes.title.trim()) {
			await updateLoop(loopId, { title: changes.title.trim() });
			mutated = true;
		}
		if (typeof changes.content === 'string') {
			await updateLoop(loopId, { content: changes.content.trim() });
			mutated = true;
		}
		const tagChanges = {
			priority: changes.priority ?? undefined,
			deadline: changes.deadline ?? undefined,
			project: changes.project ?? undefined
		};
		if (tagChanges.priority !== undefined || tagChanges.deadline !== undefined || tagChanges.project !== undefined) {
			await updateLoopTags(loopId, tagChanges);
			mutated = true;
		}
		if (plan.tags && plan.tags.length > 0) {
			await applyLoopTagPatches(loopId, plan.tags);
			mutated = true;
		}
		return mutated ? { applied: true, loopId } : { applied: false, reason: 'no meaningful changes to apply' };
	}

	if (plan.kind === 'set_tag') {
		if (!plan.tags?.length) return { applied: false, reason: 'missing tag patch' };
		await applyLoopTagPatches(loopId, plan.tags);
		return { applied: true, loopId };
	}

	return { applied: false, reason: 'unsupported suggestion action' };
}

export async function applySuggestion(item: SuggestedAction, dumpId: string | null = null): Promise<SuggestionApplyResult> {
	const plan = mapSuggestionToMutationPlan(item);
	if (!plan) return { applied: false, reason: 'invalid suggestion payload' };
	const result = await applyMutationPlan(plan, dumpId);
	if (result.applied && item.suggestionId) {
		await setSuggestionStatus(item.suggestionId, 'accepted');
	}
	return result;
}
