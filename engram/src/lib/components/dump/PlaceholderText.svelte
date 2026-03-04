<script lang="ts">
	import { onDestroy } from 'svelte';
	import { loopViewsStore } from '$stores/app';
	import { isOverdue } from '$lib/utils';

	const staticPrompts = [
		'What happened today?',
		'Anything to close out?',
		'Who needs a follow-up?',
		"What's weighing on you?"
	];

	let currentIndex = $state(0);

	let prompts = $derived.by(() => {
		const loops = $loopViewsStore ?? [];
		const overdueCount = loops.filter(
			(l) => l.state === 'open' && isOverdue(l.deadline, l.closedAt)
		).length;
		const dynamic: string[] = [];
		if (overdueCount > 0) dynamic.push(`${overdueCount} loop${overdueCount > 1 ? 's are' : ' is'} overdue`);
		return [...staticPrompts, ...dynamic];
	});

	const interval = setInterval(() => {
		currentIndex = (currentIndex + 1) % prompts.length;
	}, 30000);

	onDestroy(() => clearInterval(interval));
</script>

{#key currentIndex}
	<span class="placeholder">{prompts[currentIndex % prompts.length]}</span>
{/key}

<style>
	.placeholder {
		font-size: var(--text-md);
		font-weight: var(--weight-light);
		color: var(--text4);
		animation: fadeUp 0.4s var(--ease-spring);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
