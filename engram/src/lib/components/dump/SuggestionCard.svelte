<script lang="ts">
	import { fly } from 'svelte/transition';
	import { Check, X, CircleCheck, ArrowUpRight, Plus, Pencil, Tag } from 'lucide-svelte';
	import type { SuggestedAction } from '$types/models';
	import Badge from '$components/Badge.svelte';

	let {
		item,
		onAccept,
		onDismiss,
		stagger = 0,
		pending = false
	}: {
		item: SuggestedAction;
		onAccept: () => void;
		onDismiss: () => void;
		stagger?: number;
		pending?: boolean;
	} = $props();

	const iconMap: Record<string, typeof Check> = {
		close_loop: CircleCheck,
		open_loop: ArrowUpRight,
		add_note: Plus,
		update_loop: Pencil,
		tag_loop: Tag
	};

	const labelMap: Record<string, string> = {
		open_loop: 'open loop',
		close_loop: 'close loop',
		add_note: 'update',
		update_loop: 'update loop',
		tag_loop: 'tag'
	};

	const colorMap: Record<string, string> = {
		open_loop: '#a0714a',
		close_loop: '#3d8a4a',
		add_note: '#5a5651',
		update_loop: '#6e63a0',
		tag_loop: '#5a5651'
	};

	function handleAccept() {
		onAccept();
	}

	function handleDismiss() {
		onDismiss();
	}

	const ActionIcon = $derived(iconMap[item.action] ?? Plus);
</script>

<article
	class="card"
	class:pending={pending}
	style={`--stagger:${stagger}ms`}
	in:fly={{ y: 8, duration: 250, delay: stagger }}
	out:fly={{ x: 30, duration: 200 }}
>
	<div class="head">
		<div class="head-left">
			<span class="action-icon">
				<ActionIcon size={13} />
			</span>
			<Badge label={labelMap[item.action] ?? item.action.replace('_', ' ')} color={colorMap[item.action] ?? '#5a5651'} />
			{#if item.confidence}
				<Badge
					label={item.confidence}
					color={item.confidence === 'low' ? '#c0453a' : item.confidence === 'medium' ? '#a07c28' : '#3d8a4a'}
				/>
			{/if}
		</div>
		<div class="head-right">
			<button class="circle-btn accept" title="Accept" aria-label="Accept suggestion" disabled={pending} onclick={handleAccept}>
				<Check size={14} />
			</button>
			<button class="circle-btn dismiss" title="Dismiss" aria-label="Dismiss suggestion" disabled={pending} onclick={handleDismiss}>
				<X size={14} />
			</button>
		</div>
	</div>

	{#if item.action === 'open_loop'}
		<p class="title">{item.title ?? 'Untitled loop'}</p>
	{:else if item.action === 'add_note'}
		<p class="note">{item.text}</p>
	{:else}
		<p class="body">{item.title ?? item.tagTypeSlug ?? 'Untitled suggestion'}</p>
	{/if}

	{#if (item.people && item.people.length > 0) || item.project || item.priority}
		<div class="tags">
			{#each item.people ?? [] as person}
				<Badge label={person} color="#6e63a0" />
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
		border-radius: var(--radius-md);
		background: var(--surface-1);
		border: 1px solid var(--border-soft);
		box-shadow: var(--shadow-sm);
		padding: 12px;
		overflow: hidden;
	}

	.card.pending {
		opacity: 0.7;
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
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 1px solid var(--border-soft);
		background: transparent;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s var(--ease-spring);
	}

	.circle-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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
		font-size: var(--text-md);
		font-weight: var(--weight-normal);
		line-height: var(--leading-tight);
		letter-spacing: var(--tracking-tight);
		color: var(--text);
	}

	.note {
		margin: 8px 0 2px;
		font-size: var(--text-sm);
		font-style: italic;
		color: var(--text2);
		line-height: var(--leading-normal);
	}

	.body {
		margin: 8px 0 2px;
		font-size: var(--text-md);
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
