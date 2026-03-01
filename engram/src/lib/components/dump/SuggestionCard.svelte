<script lang="ts">
	import { Check, X, CircleCheck, ArrowUpRight, Plus, Pencil, UserPlus, FolderPlus } from 'lucide-svelte';
	import type { SuggestedAction } from '$types/models';
	import Badge from '$components/Badge.svelte';

	let {
		item,
		onAccept,
		onDismiss,
		stagger = 0
	}: {
		item: SuggestedAction;
		onAccept: () => void;
		onDismiss: () => void;
		stagger?: number;
	} = $props();

	let animatingAccept = $state(false);
	let animatingDismiss = $state(false);

	const iconMap: Record<string, typeof Check> = {
		close_loop: CircleCheck,
		open_loop: ArrowUpRight,
		add_note: Plus,
		update_loop: Pencil,
		create_person: UserPlus,
		create_project: FolderPlus
	};

	const labelMap: Record<string, string> = {
		open_loop: 'open loop',
		close_loop: 'archive loop',
		add_note: 'update',
		update_loop: 'update loop',
		create_person: 'person',
		create_project: 'project'
	};

	const colorMap: Record<string, string> = {
		open_loop: '#a0714a',
		close_loop: '#3d8a4a',
		add_note: '#5a5651',
		update_loop: '#6e63a0',
		create_person: '#6e63a0',
		create_project: '#a0714a'
	};

	function handleAccept() {
		animatingAccept = true;
		setTimeout(() => onAccept(), 500);
	}

	function handleDismiss() {
		animatingDismiss = true;
		setTimeout(() => onDismiss(), 200);
	}

	const ActionIcon = $derived(iconMap[item.action] ?? Plus);
</script>

<article
	class="card"
	class:accepting={animatingAccept}
	class:dismissing={animatingDismiss}
	style={`--stagger:${stagger}ms`}
>
	<div class="head">
		<div class="head-left">
			<span class="action-icon">
				<svelte:component this={ActionIcon} size={13} />
			</span>
			<Badge label={labelMap[item.action] ?? item.action.replace('_', ' ')} color={colorMap[item.action] ?? '#5a5651'} />
		</div>
		<div class="head-right">
			<button class="circle-btn accept" title="Accept" onclick={handleAccept}>
				<Check size={14} />
			</button>
			<button class="circle-btn dismiss" title="Dismiss" onclick={handleDismiss}>
				<X size={14} />
			</button>
		</div>
	</div>

	{#if item.action === 'open_loop'}
		<p class="title">{item.title ?? 'Untitled loop'}</p>
	{:else if item.action === 'add_note'}
		<p class="note">{item.text}</p>
	{:else}
		<p class="body">{item.title ?? item.name ?? 'Untitled suggestion'}</p>
	{/if}

	{#if (item.people && item.people.length > 0) || item.project || item.priority}
		<div class="tags">
			{#each item.people ?? [] as person}
				<Badge label={person.name} color="#6e63a0" />
			{/each}
			{#if item.project}<Badge label={item.project} color="#a0714a" />{/if}
			{#if item.priority}
				<Badge
					label={item.priority}
					color={item.priority === 'P0' ? '#c0453a' : item.priority === 'P1' ? '#a07c28' : '#8a857f'}
				/>
			{/if}
		</div>
	{/if}
</article>

<style>
	.card {
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.5);
		border: 1px solid rgba(0, 0, 0, 0.05);
		box-shadow: var(--shadow-sm);
		padding: 12px;
		animation: cardIn 0.25s var(--ease-spring) backwards;
		animation-delay: var(--stagger);
		transition:
			opacity var(--dur-fast) var(--ease),
			transform 0.2s var(--ease),
			max-height 0.25s var(--ease-spring),
			background var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease);
		overflow: hidden;
	}

	.card.accepting {
		border-color: color-mix(in srgb, var(--green) 30%, transparent);
		background: color-mix(in srgb, var(--green) 8%, #fff);
		max-height: 0 !important;
		padding: 0 12px;
		opacity: 0;
		margin: 0;
	}

	.card.dismissing {
		transform: translateX(30px);
		opacity: 0;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.head-left {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.action-icon {
		display: inline-flex;
		color: var(--text3);
	}

	.head-right {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.circle-btn {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 1px solid rgba(0, 0, 0, 0.06);
		background: transparent;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s var(--ease-spring);
	}

	.circle-btn.accept {
		color: var(--green);
	}

	.circle-btn.accept:active {
		transform: scale(1.15);
	}

	.circle-btn.dismiss {
		color: var(--text4);
	}

	.circle-btn.dismiss:active {
		transform: scale(0.9);
	}

	.title {
		margin: 8px 0 5px;
		font-family: var(--font-serif);
		font-size: 14px;
		font-weight: var(--weight-normal);
		line-height: var(--leading-tight);
		letter-spacing: var(--tracking-tight);
		color: var(--text);
	}

	.note {
		margin: 8px 0 2px;
		font-size: 12px;
		font-style: italic;
		color: var(--text2);
		line-height: var(--leading-normal);
	}

	.body {
		margin: 8px 0 2px;
		font-size: 13px;
		font-weight: var(--weight-light);
		line-height: var(--leading-normal);
		color: var(--text2);
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
		margin-top: 4px;
	}
</style>
