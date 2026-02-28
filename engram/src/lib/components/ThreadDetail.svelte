<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Check, RotateCw, X } from 'lucide-svelte';
	import { addLoopNote, addUpdate, closeLoop, reopenLoop, updateLoopNote } from '$db/local';
	import { loopNotesStore } from '$stores/app';
	import type { ClosedReason, Loop, LoopEvent, LoopNote } from '$types/models';
	import ActionBtn from '$components/ActionBtn.svelte';
	import IconBtn from '$components/IconBtn.svelte';
	import Badge from '$components/Badge.svelte';
	import Toast from '$components/Toast.svelte';

	type OptimisticTimelineEntry = {
		id: string;
		body: string;
		createdAt: string;
		status: 'pending' | 'failed';
	};

	type TimelineRow = {
		id: string;
		kind: LoopEvent['kind'] | 'optimistic_update';
		body: string;
		createdAt: string;
		status?: 'pending' | 'failed';
	};

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

	let updateText = $state('');
	let noteText = $state('');
	let resolveMode = $state(false);
	let reason = $state<ClosedReason>('done');
	let optimistic = $state<OptimisticTimelineEntry[]>([]);
	let editingNoteId = $state<string | null>(null);
	let editingNoteBody = $state('');
	let updateInput = $state<HTMLInputElement | null>(null);
	let toast = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	const isOverdue = $derived(loop ? Boolean(loop.deadline && loop.state === 'open' && new Date(loop.deadline).getTime() < Date.now()) : false);
	const loopNotes = $derived.by(() =>
		(($loopNotesStore ?? []) as LoopNote[])
			.filter((entry) => entry.loopId === loop?.id)
			.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
	);
	const timelineRows = $derived.by(() => {
		const persisted: TimelineRow[] = events.map((evt) => ({
			id: evt.id,
			kind: evt.kind,
			body: evt.body ?? '',
			createdAt: evt.createdAt
		}));
		const temporary: TimelineRow[] = optimistic.map((entry) => ({
			id: entry.id,
			kind: 'optimistic_update',
			body: entry.body,
			createdAt: entry.createdAt,
			status: entry.status
		}));
		return [...persisted, ...temporary].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
	});

	const eventLabel = (kind: TimelineRow['kind']) => {
		if (kind === 'created') return 'Opened';
		if (kind === 'closed') return 'Archived';
		if (kind === 'reopened') return 'Reopened';
		if (kind === 'updated') return 'Updated';
		if (kind === 'noted') return 'Update';
		return 'Update';
	};

	function relativeAge(value: string) {
		const ms = Date.now() - +new Date(value);
		const minute = 60_000;
		const hour = 60 * minute;
		const day = 24 * hour;
		if (ms < hour) {
			const n = Math.max(1, Math.floor(ms / minute));
			return `${n}m ago`;
		}
		if (ms < day) {
			const n = Math.max(1, Math.floor(ms / hour));
			return `${n}h ago`;
		}
		const n = Math.max(1, Math.floor(ms / day));
		return `${n}d ago`;
	}

	function absoluteStamp(value: string) {
		return new Date(value).toLocaleString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function showToast(message: string) {
		toast = message;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => {
			toast = null;
		}, 2200);
	}

	async function submitUpdate() {
		if (!loop || !updateText.trim()) return;
		const body = updateText.trim();
		updateText = '';
		updateInput?.focus();
		const optimisticId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
		const createdAt = new Date().toISOString();
		optimistic = [...optimistic, { id: optimisticId, body, createdAt, status: 'pending' }];
		try {
			await addUpdate(loop.id, body);
			optimistic = optimistic.filter((entry) => entry.id !== optimisticId);
			showToast('Update saved');
		} catch {
			optimistic = optimistic.map((entry) => (entry.id === optimisticId ? { ...entry, status: 'failed' } : entry));
			showToast('Could not save update');
		}
	}

	async function retryUpdate(entry: OptimisticTimelineEntry) {
		if (!loop) return;
		optimistic = optimistic.map((row) => (row.id === entry.id ? { ...row, status: 'pending' } : row));
		try {
			await addUpdate(loop.id, entry.body);
			optimistic = optimistic.filter((row) => row.id !== entry.id);
			showToast('Update saved');
		} catch {
			optimistic = optimistic.map((row) => (row.id === entry.id ? { ...row, status: 'failed' } : row));
			showToast('Retry failed');
		}
	}

	async function submitNote() {
		if (!loop || !noteText.trim()) return;
		try {
			await addLoopNote(loop.id, noteText.trim());
			noteText = '';
			showToast('Note added');
		} catch {
			showToast('Could not add note');
		}
	}

	function beginEdit(note: LoopNote) {
		editingNoteId = note.id;
		editingNoteBody = note.body;
	}

	async function saveEdit() {
		if (!editingNoteId || !editingNoteBody.trim()) return;
		try {
			await updateLoopNote(editingNoteId, editingNoteBody.trim());
			editingNoteId = null;
			editingNoteBody = '';
			showToast('Note saved');
		} catch {
			showToast('Could not save note');
		}
	}

	async function resolveLoop() {
		if (!loop) return;
		try {
			await closeLoop(loop.id, reason);
			resolveMode = false;
			showToast('Loop archived');
		} catch {
			showToast('Could not archive loop');
		}
	}

	async function reopenCurrentLoop() {
		if (!loop) return;
		try {
			await reopenLoop(loop.id);
			showToast('Loop reopened');
		} catch {
			showToast('Could not reopen loop');
		}
	}

	onDestroy(() => {
		if (toastTimer) clearTimeout(toastTimer);
	});
</script>

{#if open && loop}
	<div
		class="overlay"
		role="button"
		tabindex="0"
		aria-label="Close loop details"
		onpointerdown={onClose}
		onkeydown={(event) => event.key === 'Escape' && onClose()}
	>
		<div role="dialog" aria-modal="true" aria-label="Loop details" tabindex="-1" class="sheet" onpointerdown={(event) => event.stopPropagation()}>
			<div class="drag"></div>
			<header class="head">
				<div class="head-top">
					<Badge label={loop.priority} color={loop.priority === 'P0' ? '#c0453a' : loop.priority === 'P1' ? '#a0714a' : '#8a857f'} />
					{#if loop.state === 'closed'}
						<Badge label="Archived" color="#3d8a4a" />
					{/if}
					{#if isOverdue}
						<Badge label="Overdue" color="#c0453a" />
					{/if}
					<span class="spacer"></span>
					<IconBtn title="Close" size={30} onClick={onClose}><X size={14} /></IconBtn>
				</div>
				<h2 class="head-title">{loop.title}</h2>
			</header>
			<div class="body">
				<div class="meta">
					<p>Opened {new Date(loop.createdAt).toLocaleDateString()}</p>
					{#if loop.deadline}<p>Deadline {new Date(loop.deadline).toLocaleDateString()}</p>{/if}
					{#if loop.closedAt}<p>Archived {new Date(loop.closedAt).toLocaleDateString()} ({loop.closedReason})</p>{/if}
				</div>

				<section>
					<h4>Loop timeline</h4>
					{#if timelineRows.length === 0}
						<p class="empty">No timeline events yet</p>
					{:else}
						{#each timelineRows as row (row.id)}
							<div class="timeline-row" class:pending={row.status === 'pending'} class:failed={row.status === 'failed'}>
								<p>
									<strong>{eventLabel(row.kind)}:</strong>
									{row.body || 'No details'}
								</p>
								<div class="row-meta">
									<span class="info-tag">{relativeAge(row.createdAt)}</span>
									<span class="info-tag">{absoluteStamp(row.createdAt)}</span>
									{#if row.status === 'pending'}
										<span class="info-tag">syncing</span>
									{/if}
									{#if row.status === 'failed'}
										<button type="button" class="retry" onclick={() => retryUpdate(row as OptimisticTimelineEntry)}>
											<RotateCw size={11} /> retry
										</button>
									{/if}
								</div>
							</div>
						{/each}
					{/if}
					<div class="composer">
						<input
							bind:this={updateInput}
							bind:value={updateText}
							placeholder="Add update to timeline..."
							onkeydown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault();
									event.stopPropagation();
									submitUpdate();
								}
							}}
						/>
					</div>
				</section>

				<section>
					<h4>Loop notes</h4>
					{#if loopNotes.length === 0}
						<p class="empty">No context notes yet</p>
					{:else}
						<div class="notes">
							{#each loopNotes as note (note.id)}
								<div class="note-row">
									{#if editingNoteId === note.id}
										<input
											bind:value={editingNoteBody}
											onkeydown={(event) => {
												if (event.key === 'Enter') {
													event.preventDefault();
													event.stopPropagation();
													saveEdit();
												}
											}}
										/>
										<button type="button" class="small" onclick={saveEdit}>Save</button>
									{:else}
										<p>{note.body}</p>
										<div class="row-meta">
											<button type="button" class="small" onclick={() => beginEdit(note)}>Edit</button>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
					<div class="composer">
						<input
							bind:value={noteText}
							placeholder="Add context note..."
							onkeydown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault();
									event.stopPropagation();
									submitNote();
								}
							}}
						/>
					</div>
				</section>
			</div>

			<footer class="actions">
				<div class="right" style="margin-left:auto;">
					{#if loop.state === 'open'}
						{#if !resolveMode}
							<ActionBtn title="Archive loop" color="rgba(255,255,255,0.7)" onClick={() => (resolveMode = true)}>
								<span style="color:var(--text2)">Archive loop</span>
							</ActionBtn>
						{:else}
							<select bind:value={reason}>
								<option value="done">done</option>
								<option value="dropped">canceled</option>
								<option value="delegated">delegated</option>
								<option value="irrelevant">irrelevant</option>
							</select>
							<ActionBtn title="Archive" color="#3d8a4a" onClick={resolveLoop}>
								<Check size={14} />
							</ActionBtn>
						{/if}
					{:else}
						<ActionBtn title="Reopen loop" color="rgba(255,255,255,0.7)" onClick={reopenCurrentLoop}>
							<span style="color:var(--text2)">Reopen loop</span>
						</ActionBtn>
					{/if}
				</div>
			</footer>
		</div>
	</div>
{/if}

{#if toast}
	<Toast message={toast} />
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.2);
		backdrop-filter: blur(8px);
		animation: overlayIn var(--dur-fast) var(--ease);
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
		animation: sheetUp var(--dur-slow) var(--ease-spring);
	}

	.drag {
		width: 36px;
		height: 4px;
		border-radius: 2px;
		background: rgba(0, 0, 0, 0.12);
		margin: 10px auto 4px;
	}

	.head {
		padding: 8px 12px 10px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.04);
	}

	.head-top {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
	}

	.spacer {
		flex: 1;
	}

	.head-title {
		margin: 0;
		width: 100%;
		font-family: var(--font-serif);
		font-size: var(--text-xl);
		font-weight: var(--weight-normal);
		line-height: var(--leading-tight);
		letter-spacing: var(--tracking-tight);
	}

	.body {
		padding: 12px;
		overflow: auto;
		display: grid;
		gap: 12px;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.meta p {
		margin: 0;
		font-size: 11px;
		color: var(--text3);
		font-family: var(--font-mono);
		padding: 3px 7px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.6);
		border: 1px solid rgba(0, 0, 0, 0.04);
	}

	h4 {
		margin: 0 0 8px;
		font-size: 10px;
		letter-spacing: var(--tracking-caps-wide);
		text-transform: uppercase;
		color: var(--text3);
	}

	.timeline-row {
		padding: 8px 0;
		border-bottom: 1px solid rgba(0, 0, 0, 0.04);
		animation: rowEnter var(--dur-base) var(--ease-spring);
	}

	.timeline-row.pending {
		opacity: 0.8;
	}

	.timeline-row.failed {
		border-bottom-color: color-mix(in srgb, var(--red) 32%, transparent);
	}

	.timeline-row p {
		margin: 0 0 4px;
		font-size: 13px;
		font-weight: var(--weight-light);
		line-height: var(--leading-normal);
		color: var(--text2);
	}

	.timeline-row p strong {
		font-weight: var(--weight-normal);
		color: var(--text);
	}

	.row-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}

	.info-tag {
		font-size: 10px;
		color: var(--text3);
		font-family: var(--font-mono);
		padding: 2px 6px;
		border-radius: 999px;
		border: 1px solid rgba(0, 0, 0, 0.05);
		background: rgba(255, 255, 255, 0.7);
	}

	.retry {
		border: 0;
		background: rgba(192, 69, 58, 0.08);
		color: var(--red);
		font-size: 10px;
		font-family: var(--font-mono);
		padding: 2px 7px;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		cursor: pointer;
	}

	.composer {
		margin-top: 8px;
	}

	.composer input,
	select {
		width: 100%;
		height: 34px;
		border-radius: 12px;
		border: 1px solid rgba(0, 0, 0, 0.05);
		background: rgba(255, 255, 255, 0.75);
		padding: 0 12px;
		font-size: 13px;
		transition:
			border-color var(--dur-fast) var(--ease),
			box-shadow var(--dur-fast) var(--ease);
	}

	.composer input:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--accent) 40%, rgba(0, 0, 0, 0.05));
		box-shadow: var(--ring-accent);
	}

	.notes {
		display: grid;
		gap: 8px;
	}

	.note-row {
		padding: 8px 10px;
		border-radius: 10px;
		border: 1px solid rgba(0, 0, 0, 0.05);
		background: rgba(255, 255, 255, 0.65);
		animation: rowFlash var(--dur-slow) var(--ease);
	}

	.note-row p {
		margin: 0 0 6px;
		font-size: 12.5px;
		color: var(--text2);
	}

	.note-row input {
		width: 100%;
		height: 32px;
		border-radius: 10px;
		border: 1px solid rgba(0, 0, 0, 0.08);
		padding: 0 10px;
		font-size: 12px;
	}

	.small {
		border: 0;
		background: rgba(0, 0, 0, 0.06);
		color: var(--text2);
		font-size: 10px;
		font-family: var(--font-mono);
		padding: 2px 8px;
		border-radius: 999px;
		cursor: pointer;
	}

	.actions {
		padding: 12px;
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
		font-size: 12px;
		font-style: italic;
		color: var(--text3);
	}
</style>
