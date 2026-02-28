<script lang="ts">
	import { Check, X } from 'lucide-svelte';
	import { addNote, closeLoop, reopenLoop, updateLoop } from '$db/local';
	import type { ClosedReason, Loop, LoopEvent } from '$types/models';
	import ActionBtn from '$components/ActionBtn.svelte';
	import IconBtn from '$components/IconBtn.svelte';
	import Badge from '$components/Badge.svelte';

	let {
		loop,
		events,
		open = false,
		onClose
	}: {
		loop: Loop | null;
		events: LoopEvent[];
		open: boolean;
		onClose: () => void;
	} = $props();

	let note = $state('');
	let resolveMode = $state(false);
	let reason = $state<ClosedReason>('done');

	const isOverdue = $derived(loop ? Boolean(loop.deadline && loop.state === 'open' && new Date(loop.deadline).getTime() < Date.now()) : false);

	async function submitNote() {
		if (!loop || !note.trim()) return;
		await addNote(loop.id, note.trim());
		note = '';
	}

	const eventLabel = (kind: LoopEvent['kind']) => {
		if (kind === 'created') return 'Opened';
		if (kind === 'closed') return 'Archived';
		if (kind === 'reopened') return 'Reopened';
		if (kind === 'updated') return 'Updated';
		if (kind === 'noted') return 'Update';
		return 'Changed';
	};

	async function resolveThread() {
		if (!loop) return;
		await closeLoop(loop.id, reason);
		resolveMode = false;
	}
</script>

{#if open && loop}
	<div
		class="overlay"
		role="button"
		tabindex="0"
		aria-label="Close details"
		onpointerdown={onClose}
		onkeydown={(event) => (event.key === 'Escape' || event.key === 'Enter') && onClose()}
	>
		<div role="dialog" aria-modal="true" aria-label="Loop details" tabindex="-1" class="sheet" onpointerdown={(event) => event.stopPropagation()}>
			<div class="drag"></div>
			<header class="head">
				<div class="head-top">
					<Badge label={loop.priority} color={loop.priority === 'P0' ? '#c0453a' : loop.priority === 'P1' ? '#a0714a' : '#8a857f'} />
					{#if loop.state === 'closed'}
						<Badge label="Resolved" color="#3d8a4a" />
					{/if}
					{#if isOverdue}
						<Badge label="Overdue" color="#c0453a" />
					{/if}
					<span class="spacer"></span>
					<IconBtn title="Close" size={30} onClick={onClose}><X size={14} /></IconBtn>
				</div>
				<input
					value={loop.title}
					onblur={(event) => updateLoop(loop.id, { title: (event.currentTarget as HTMLInputElement).value.trim() || loop.title })}
				/>
			</header>
			<div class="body">
				<div class="meta">
					<p>Opened {new Date(loop.createdAt).toLocaleDateString()}</p>
					{#if loop.deadline}<p>Deadline {new Date(loop.deadline).toLocaleDateString()}</p>{/if}
					{#if loop.closedAt}<p>Closed {new Date(loop.closedAt).toLocaleDateString()} ({loop.closedReason})</p>{/if}
				</div>
				<section>
					<h4>Activity log</h4>
					{#if events.length === 0}
						<p class="empty">No activity yet</p>
					{:else}
						{#each events as evt (evt.id)}
							<div class="evt">
								<p><strong>{eventLabel(evt.kind)}:</strong> {evt.body ?? ''}</p>
								<small>{new Date(evt.createdAt).toLocaleString()}</small>
							</div>
						{/each}
					{/if}
				</section>
				<div class="note-add">
					<input bind:value={note} placeholder="Add update..." onkeydown={(event) => event.key === 'Enter' && submitNote()} />
				</div>
			</div>
			<footer class="actions">
				<div class="right" style="margin-left:auto;">
					{#if loop.state === 'open'}
						{#if !resolveMode}
							<ActionBtn title="Archive task" color="rgba(255,255,255,0.7)" onClick={() => (resolveMode = true)}>
								<span style="color:var(--text2)">Archive task</span>
							</ActionBtn>
						{:else}
							<select bind:value={reason}>
								<option value="done">done</option>
								<option value="dropped">canceled</option>
								<option value="delegated">delegated</option>
								<option value="irrelevant">irrelevant</option>
							</select>
							<ActionBtn title="Resolve" color="#3d8a4a" onClick={resolveThread}>
								<Check size={14} />
							</ActionBtn>
						{/if}
					{:else}
						<ActionBtn title="Reopen" color="rgba(255,255,255,0.7)" onClick={() => reopenLoop(loop.id)}>
							<span style="color:var(--text2)">Reopen</span>
						</ActionBtn>
					{/if}
				</div>
			</footer>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.2);
		backdrop-filter: blur(8px);
		animation: overlayIn 0.2s var(--ease);
		z-index: 120;
		display: flex;
		align-items: flex-end;
	}

	.sheet {
		width: min(100%, 480px);
		margin: 0 auto;
		max-height: 92dvh;
		background: var(--bg);
		border-radius: 20px 20px 0 0;
		box-shadow: var(--shadow-xl);
		display: flex;
		flex-direction: column;
		animation: sheetUp 0.35s var(--ease-spring);
	}

	.drag {
		width: 36px;
		height: 4px;
		border-radius: 2px;
		background: rgba(0, 0, 0, 0.12);
		margin: 10px auto 4px;
	}

	.head {
		padding: 6px 12px 10px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.04);
	}

	.head-top {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-bottom: 8px;
	}

	.spacer {
		flex: 1;
	}

	.head input {
		width: 100%;
		border: 0;
		background: transparent;
		box-shadow: none;
		font-family: 'Instrument Serif', 'Times New Roman', serif;
		font-size: 19px;
	}

	.body {
		padding: 10px 12px;
		overflow: auto;
		display: grid;
		gap: 12px;
	}

	.meta p {
		margin: 0;
		font-size: 11px;
		color: var(--text3);
		font-family: 'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	h4 {
		margin: 0 0 8px;
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.evt {
		padding: 7px 0;
		border-bottom: 1px solid rgba(0, 0, 0, 0.04);
	}

	.evt p {
		margin: 0 0 2px;
		font-size: 13px;
		font-weight: 300;
		color: var(--text2);
	}

	.evt small {
		font-size: 10px;
		color: var(--text3);
		font-family: 'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.note-add input,
	select {
		width: 100%;
		height: 34px;
		border-radius: 10px;
		border: 1px solid rgba(0, 0, 0, 0.07);
		background: rgba(255, 255, 255, 0.75);
		padding: 0 10px;
		font-size: 13px;
	}

	.actions {
		padding: 10px 12px;
		border-top: 1px solid rgba(0, 0, 0, 0.04);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.right {
		display: inline-flex;
		gap: 8px;
		align-items: center;
	}

	.empty {
		margin: 0;
		font-size: 12.5px;
		font-style: italic;
		color: var(--text3);
	}
</style>
