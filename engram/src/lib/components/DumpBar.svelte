<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import { Check, Clipboard, Loader2, Mic, Send, Square, X } from 'lucide-svelte';
	import { putDump, putSuggestionsForDump, setSuggestionStatus } from '$db/local';
	import { parsePhase, suggestionContextStore, suggestionsStore, transcriptStore } from '$stores/app';
	import { applySuggestion } from '$lib/suggestions';
	import type { SuggestedAction } from '$types/models';
	import IconBtn from '$components/IconBtn.svelte';
	import ActionBtn from '$components/ActionBtn.svelte';
	import Badge from '$components/Badge.svelte';
	import Toast from '$components/Toast.svelte';

	let text = $state('');
	let loading = $state(false);
	let recording = $state(false);
	let expanded = $state(false);
	let allProcessed = $state(false);
	let recorder: MediaRecorder | null = null;
	let audioChunks: Blob[] = [];
	let recordError = $state<string | null>(null);
	let mediaStream: MediaStream | null = null;
	let audioCtx: AudioContext | null = null;
	let analyser: AnalyserNode | null = null;
	let rafId: number | null = null;
	let micLevel = $state(0.12);
	let bars = $state<number[]>(Array.from({ length: 12 }, () => 0.14));
	let toast = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;
	let acceptedIds = $state<Set<string>>(new Set());
	const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	type DumpResponse = {
		transcript: string;
		source: 'text' | 'voice';
		aiAvailable: boolean;
		active?: { openCount: number; overdueCount: number };
		suggestions: SuggestedAction[];
	};

	async function submitDumpAudio(audio: Blob) {
		if (loading) return;
		loading = true;
		expanded = true;
		recordError = null;
		parsePhase.set('transcribing');

		const now = new Date().toISOString();
		const dump = await putDump({ raw: '[voice]', source: 'voice', transcript: null, createdAt: now, processed: 0 });
		suggestionContextStore.set({ dumpId: dump.id });

		try {
			const form = new FormData();
			form.set('audio', audio, 'dump.webm');
			if (!browser) return;
			const res = await window.fetch('/api/dump', {
				method: 'POST',
				body: form
			});
			if (!res.ok) throw new Error('parse failed');
			const body = (await res.json()) as DumpResponse;
			transcriptStore.set({
				text: body.transcript?.trim() || 'Could not confidently transcribe. Try speaking closer to the mic.',
				source: 'voice',
				at: new Date().toISOString()
			});
			parsePhase.set('parsing');
			await wait(850);
			parsePhase.set('suggesting');
			await wait(260);
			const records = await putSuggestionsForDump(dump.id, body.suggestions ?? []);
			suggestionsStore.set((body.suggestions ?? []).map((item, idx) => ({ ...item, suggestionId: records[idx]?.id })));
		} catch {
			transcriptStore.set({
				text: 'Could not confidently transcribe. Try speaking closer to the mic.',
				source: 'voice',
				at: new Date().toISOString()
			});
			parsePhase.set('suggesting');
			const fallback: SuggestedAction[] = [
				{
					action: 'open_loop',
					title: 'Review voice dump',
					priority: 'P1',
					energy: 'active',
					confidence: browser && navigator.onLine ? 'low' : 'medium'
				}
			];
			const records = await putSuggestionsForDump(dump.id, fallback);
			suggestionsStore.set(fallback.map((item, idx) => ({ ...item, suggestionId: records[idx]?.id })));
		} finally {
			parsePhase.set('idle');
			loading = false;
		}
	}

	async function submitDumpText() {
		const raw = text.trim();
		if (!raw || loading) return;

		loading = true;
		const submitted = text;
		text = '';
		expanded = true;
		recordError = null;
		parsePhase.set('parsing');

		const now = new Date().toISOString();
		const dump = await putDump({ raw, source: 'text', transcript: raw, createdAt: now, processed: 0 });
		suggestionContextStore.set({ dumpId: dump.id });

		try {
			if (!browser) return;
			const res = await window.fetch('/api/dump', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text: raw })
			});
			if (!res.ok) throw new Error('parse failed');
			const body = (await res.json()) as DumpResponse;
			transcriptStore.set({
				text: body.transcript?.trim() || raw,
				source: 'text',
				at: new Date().toISOString()
			});
			parsePhase.set('suggesting');
			await wait(160);
			const records = await putSuggestionsForDump(dump.id, body.suggestions ?? []);
			suggestionsStore.set((body.suggestions ?? []).map((item, idx) => ({ ...item, suggestionId: records[idx]?.id })));
		} catch {
			transcriptStore.set({
				text: submitted,
				source: 'text',
				at: new Date().toISOString()
			});
			parsePhase.set('suggesting');
			const fallback: SuggestedAction[] = [
				{ action: 'open_loop', title: submitted, priority: 'P1', energy: 'active', confidence: browser && navigator.onLine ? 'low' : 'medium' }
			];
			const records = await putSuggestionsForDump(dump.id, fallback);
			suggestionsStore.set(fallback.map((item, idx) => ({ ...item, suggestionId: records[idx]?.id })));
		} finally {
			parsePhase.set('idle');
			loading = false;
		}
	}

	async function startRecording() {
		if (!browser || loading) return;
		recordError = null;
		try {
			mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			audioCtx = new AudioContext();
			const source = audioCtx.createMediaStreamSource(mediaStream);
			analyser = audioCtx.createAnalyser();
			analyser.fftSize = 256;
			analyser.smoothingTimeConstant = 0.82;
			source.connect(analyser);

			const tick = () => {
				if (!analyser) return;
				const fft = new Uint8Array(analyser.frequencyBinCount);
				analyser.getByteFrequencyData(fft);
				const activeBins = Array.from(fft).slice(2, 66);
				const mean = activeBins.reduce((sum, v) => sum + v, 0) / activeBins.length;
				micLevel = Math.max(0.08, Math.min(1, mean / 160));

				const nextBars: number[] = [];
				const bucket = Math.floor(activeBins.length / 12);
				for (let i = 0; i < 12; i++) {
					const start = i * bucket;
					const chunk = activeBins.slice(start, start + bucket);
					const chunkMean = chunk.reduce((sum, v) => sum + v, 0) / Math.max(1, chunk.length);
					nextBars.push(Math.max(0.12, Math.min(1, chunkMean / 210)));
				}
				bars = nextBars;
				rafId = requestAnimationFrame(tick);
			};
			tick();

			recorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
			audioChunks = [];

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) audioChunks.push(event.data);
			};

			recorder.onstop = async () => {
				mediaStream?.getTracks().forEach((track) => track.stop());
				mediaStream = null;
				if (rafId !== null) cancelAnimationFrame(rafId);
				rafId = null;
				analyser = null;
				if (audioCtx) {
					await audioCtx.close().catch(() => {});
					audioCtx = null;
				}
				micLevel = 0.12;
				bars = Array.from({ length: 12 }, () => 0.14);
				const blob = new Blob(audioChunks, { type: recorder?.mimeType || 'audio/webm' });
				recorder = null;
				audioChunks = [];
				if (blob.size > 0) await submitDumpAudio(blob);
			};

			recorder.start();
			recording = true;
		} catch {
			parsePhase.set('idle');
			recordError = 'Microphone permission denied or unavailable';
		}
	}

	function stopRecording() {
		if (!recorder || recorder.state === 'inactive') return;
		recording = false;
		recorder.stop();
	}

	async function pasteClipboard() {
		if (!browser) return;
		try {
			const clip = await navigator.clipboard.readText();
			if (clip.trim()) {
				text = clip;
				expanded = true;
			}
		} catch {
			recordError = 'Clipboard unavailable';
		}
	}

	async function acceptSuggestion(item: SuggestedAction) {
		if (item.suggestionId) {
			acceptedIds = new Set([...acceptedIds, item.suggestionId]);
		}
		await applySuggestion(item, $suggestionContextStore.dumpId);
		setTimeout(() => {
			suggestionsStore.update((items) => items.filter((entry) => entry !== item));
		}, 240);
		if (item.suggestionId) {
			await setSuggestionStatus(item.suggestionId, 'accepted');
		}
		showToast('Suggestion accepted');
		checkAllProcessed();
	}

	async function dismissSuggestion(item: SuggestedAction) {
		if (item.suggestionId) {
			await setSuggestionStatus(item.suggestionId, 'dismissed');
		}
		suggestionsStore.update((items) => items.filter((entry) => entry !== item));
		checkAllProcessed();
	}

	function checkAllProcessed() {
		if ($suggestionsStore.length > 1) return;
		allProcessed = true;
		setTimeout(() => {
			allProcessed = false;
			expanded = false;
			acceptedIds = new Set();
			suggestionsStore.set([]);
			suggestionContextStore.set({ dumpId: null });
		}, 1200);
	}

	function showToast(message: string) {
		toast = message;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => {
			toast = null;
		}, 2500);
	}

	onDestroy(() => {
		if (rafId !== null) cancelAnimationFrame(rafId);
		mediaStream?.getTracks().forEach((track) => track.stop());
		if (audioCtx) void audioCtx.close();
		if (toastTimer) clearTimeout(toastTimer);
	});
</script>

<section class="dump">
	{#if $suggestionsStore.length > 0}
		<section class="suggestion-tray">
			{#each $suggestionsStore as item, i (`${item.action}-${i}`)}
				<article
					class="suggestion-card"
					class:accepted={Boolean(item.suggestionId && acceptedIds.has(item.suggestionId))}
					style={`animation-delay:${i * 50}ms`}
				>
					<div class="suggestion-head">
						<Badge
							label={
								item.action === 'add_note'
									? 'update'
									: item.action === 'open_loop'
										? 'open task'
										: item.action === 'close_loop'
											? 'archive task'
											: item.action === 'update_loop'
												? 'update task'
												: item.action.replace('_', ' ')
							}
							color={item.action === 'open_loop' ? '#a0714a' : item.action === 'close_loop' ? '#3d8a4a' : item.action === 'update_loop' ? '#6e63a0' : '#5a5651'}
						/>
						<div class="suggestion-actions">
							<ActionBtn title="Accept" onClick={() => acceptSuggestion(item)}>Accept</ActionBtn>
							<IconBtn title="Dismiss" size={26} onClick={() => dismissSuggestion(item)}>
								<X size={14} />
							</IconBtn>
						</div>
					</div>
					{#if item.action === 'add_note'}
						<p class="note-body">{item.text}</p>
					{:else if item.action === 'open_loop'}
						<p class="open-title">{item.title ?? 'Untitled loop'}</p>
						<div class="suggestion-tags">
							{#each item.people ?? [] as person}
								<Badge label={person.name} color="#6e63a0" />
							{/each}
							{#if item.project}<Badge label={item.project} color="#a0714a" />{/if}
							{#if item.priority}<Badge label={item.priority} color={item.priority === 'P0' ? '#c0453a' : item.priority === 'P1' ? '#a07c28' : '#8a857f'} />{/if}
						</div>
					{:else}
						<p class="suggestion-body">{item.title ?? item.name ?? 'Untitled suggestion'}</p>
					{/if}
				</article>
			{/each}
			{#if allProcessed}
				<div class="all-processed"><Check size={12} /> All processed</div>
			{/if}
		</section>
	{/if}

	{#if loading}
		<div class="shimmer"></div>
	{/if}

	<div class="input-shell" class:expanded class:recording={recording}>
		{#if expanded}
			<textarea
				bind:value={text}
				placeholder="What's on your mind..."
				rows="3"
				onkeydown={(event) => {
					if (event.key === 'Enter' && !event.shiftKey) {
						event.preventDefault();
						submitDumpText();
					}
				}}
			></textarea>
			<div class="toolbar">
				<div class="left">
					<IconBtn title={recording ? 'Stop recording' : 'Record voice'} active={recording} size={38} onClick={() => (recording ? stopRecording() : startRecording())}>
						{#if recording}
							<Square size={16} />
						{:else}
							<Mic size={16} />
						{/if}
					</IconBtn>
					<IconBtn title="Paste" size={38} onClick={pasteClipboard}><Clipboard size={16} /></IconBtn>
					<IconBtn title="Clear" size={38} onClick={() => (text = '')}><X size={16} /></IconBtn>
				</div>
				<ActionBtn title="Send" disabled={loading || !text.trim()} onClick={submitDumpText}>
					{#if loading}
						<Loader2 style="animation:spin 1s linear infinite" size={14} />
					{:else}
						<Send size={14} />
					{/if}
				</ActionBtn>
			</div>
		{:else}
			<div class="collapsed-row">
				<div class="faux-input" role="button" tabindex="0" onclick={() => (expanded = true)} onkeydown={() => (expanded = true)}>
					What's on your mind...
				</div>
				<div class="collapsed-actions">
					<IconBtn title={recording ? 'Stop recording' : 'Record voice'} active={recording} size={38} onClick={() => (recording ? stopRecording() : startRecording())}>
						{#if recording}
							<Square size={16} />
						{:else}
							<Mic size={16} />
						{/if}
					</IconBtn>
					<IconBtn title="Paste" size={38} onClick={pasteClipboard}><Clipboard size={16} /></IconBtn>
				</div>
			</div>
		{/if}
		{#if recording || $parsePhase === 'transcribing'}
			<div class="wave">
				{#each bars as bar, i (`bar-${i}`)}
					<span style={`--h:${Math.round(bar * 100)}%; --d:${i * 16}ms;`}></span>
				{/each}
			</div>
		{/if}
	</div>
	{#if recordError}
		<p class="error">{recordError}</p>
	{/if}
</section>

{#if toast}
	<Toast message={toast} />
{/if}

<style>
	.dump {
		background: rgba(250, 249, 247, 0.95);
		padding: 0 8px 6px;
	}

	.suggestion-tray {
		max-height: 240px;
		overflow: auto;
		display: grid;
		gap: 8px;
		padding: 8px 0;
		border-top: 1px solid rgba(0, 0, 0, 0.05);
		background: linear-gradient(to bottom, rgba(242, 240, 237, 0.5), rgba(250, 249, 247, 0.8));
	}

	.suggestion-card {
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.7);
		border: 1px solid rgba(0, 0, 0, 0.05);
		box-shadow: var(--shadow-sm);
		padding: 8px;
		animation: cardIn 0.25s var(--ease-spring);
	}

	.suggestion-card.accepted {
		border-color: color-mix(in srgb, var(--green) 30%, transparent);
		background: color-mix(in srgb, var(--green) 8%, #fff);
		opacity: 0.4;
	}

	.suggestion-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.suggestion-actions {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.suggestion-body {
		margin: 6px 0 2px;
		font-size: 13px;
		font-weight: 300;
		color: var(--text2);
	}

	.open-title {
		margin: 6px 0 4px;
		font-family: 'Instrument Serif', 'Times New Roman', serif;
		font-size: 14px;
		font-weight: 400;
		color: var(--text);
	}

	.suggestion-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
	}

	.note-body {
		margin: 6px 0 2px;
		font-size: 12px;
		font-style: italic;
		color: var(--text2);
	}

	.all-processed {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		font-weight: 300;
		color: var(--green);
		justify-self: center;
		padding: 4px 0;
		animation: fadeIn 0.2s var(--ease);
	}

	.shimmer {
		height: 2px;
		background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 40%, transparent), transparent);
		background-size: 200% 100%;
		animation: shimmer 1.2s ease infinite;
	}

	.input-shell {
		border-top: 1px solid rgba(0, 0, 0, 0.04);
		border-radius: 12px;
		display: grid;
		gap: 8px;
		padding: 8px 0 0;
	}

	.collapsed-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 8px;
		align-items: center;
	}

	.collapsed-actions {
		display: inline-flex;
		gap: 6px;
	}

	.faux-input {
		min-height: 42px;
		display: flex;
		align-items: center;
		padding: 0 12px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.5);
		border: 1px solid rgba(0, 0, 0, 0.06);
		box-shadow: var(--shadow-sm);
		font-size: 13px;
		font-weight: 300;
		color: var(--text4);
		transition: all 0.2s var(--ease-spring);
	}

	textarea {
		width: 100%;
		min-height: 60px;
		max-height: 120px;
		resize: none;
		border-radius: 12px;
		border: 1px solid rgba(0, 0, 0, 0.06);
		background: rgba(255, 255, 255, 0.75);
		padding: 10px 12px;
		font-size: 14px;
		font-weight: 300;
		line-height: 1.6;
	}

	.input-shell.recording textarea {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent);
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.left {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.wave {
		height: 22px;
		display: flex;
		gap: 3px;
		align-items: end;
	}

	.wave span {
		flex: 1;
		height: var(--h);
		min-height: 4px;
		border-radius: 999px;
		background: rgba(160, 113, 74, 0.75);
		transition: height 90ms linear;
		animation: fadeIn 0.16s var(--ease-spring);
		animation-delay: var(--d);
	}

	.error {
		margin: 4px 0 0;
		font-size: 11px;
		color: var(--red);
	}
</style>
