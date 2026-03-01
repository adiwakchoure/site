<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import { Check, Clipboard, Mic, Plus, Send, X } from 'lucide-svelte';
	import { putDump, putSuggestionsForDump, setSuggestionStatus, createLoop, putLoopPerson } from '$db/local';
	import { parsePhase, suggestionContextStore, suggestionsStore, transcriptStore } from '$stores/app';
	import { applySuggestion } from '$lib/suggestions';
	import { haptic } from '$lib/utils';
	import type { SuggestedAction } from '$types/models';
	import IconBtn from '$components/IconBtn.svelte';
	import { showToast } from '$stores/toast';
	import Orb from '$components/dump/Orb.svelte';
	import PlaceholderText from '$components/dump/PlaceholderText.svelte';
	import Waveform from '$components/dump/Waveform.svelte';
	import SuggestionCard from '$components/dump/SuggestionCard.svelte';
	import QuickCreateForm from '$components/dump/QuickCreateForm.svelte';

	// --- State machine ---
	type DumpBarMode =
		| { kind: 'resting' }
		| { kind: 'text' }
		| { kind: 'voice' }
		| { kind: 'processing'; source: 'text' | 'voice'; transcript: string }
		| { kind: 'suggestions'; transcript: string; items: SuggestedAction[] }
		| { kind: 'quickcreate' };

	let mode = $state<DumpBarMode>({ kind: 'resting' });

	// --- Shared state ---
	let text = $state('');
	let durationSec = $state(0);
	let durationInterval: ReturnType<typeof setInterval> | null = null;
	let allDone = $state(false);

	// Audio recording
	let recorder: MediaRecorder | null = null;
	let audioChunks: Blob[] = [];
	let mediaStream: MediaStream | null = null;
	let audioCtx: AudioContext | null = null;
	let analyser = $state<AnalyserNode | null>(null);
	let rafId: number | null = null;

	// Processing state
	let wordReveal = $state<string[]>([]);
	let revealIndex = $state(0);
	let revealTimer: ReturnType<typeof setInterval> | null = null;
	let slowThinking = $state(false);
	let slowTimer: ReturnType<typeof setTimeout> | null = null;

	const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

	type DumpResponse = {
		transcript: string;
		source: 'text' | 'voice';
		aiAvailable: boolean;
		active?: { openCount: number; overdueCount: number };
		suggestions: SuggestedAction[];
	};

	// --- Height class for CSS ---
	let heightClass = $derived(mode.kind);

	// --- Suggestion count ---
	let suggestionCount = $derived(mode.kind === 'suggestions' ? mode.items.length : 0);

	// --- Formatted duration ---
	let durationDisplay = $derived(`${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`);

	// --- Revealed transcript ---
	let revealedText = $derived(wordReveal.slice(0, revealIndex).join(' '));

	// --- Business logic ---

	function toResting() {
		mode = { kind: 'resting' };
		text = '';
		allDone = false;
		wordReveal = [];
		revealIndex = 0;
		slowThinking = false;
		if (revealTimer) clearInterval(revealTimer);
		if (slowTimer) clearTimeout(slowTimer);
		suggestionsStore.set([]);
		suggestionContextStore.set({ dumpId: null });
	}

	async function submitDumpText() {
		const raw = text.trim();
		if (!raw) return;
		if (mode.kind === 'processing') return;

		const submitted = text;
		text = '';
		mode = { kind: 'processing', source: 'text', transcript: submitted };
		parsePhase.set('parsing');

		startSlowTimer();

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
			const items = (body.suggestions ?? []).map((item, idx) => ({
				...item,
				suggestionId: records[idx]?.id
			}));
			suggestionsStore.set(items);
			clearSlowTimer();
			mode = { kind: 'suggestions', transcript: body.transcript?.trim() || submitted, items };
		} catch {
			transcriptStore.set({ text: submitted, source: 'text', at: new Date().toISOString() });
			parsePhase.set('suggesting');
			const fallback: SuggestedAction[] = [
				{ action: 'open_loop', title: submitted, priority: 'P1', energy: 'active', confidence: browser && navigator.onLine ? 'low' : 'medium' }
			];
			const records = await putSuggestionsForDump(dump.id, fallback);
			const items = fallback.map((item, idx) => ({ ...item, suggestionId: records[idx]?.id }));
			suggestionsStore.set(items);
			clearSlowTimer();
			mode = { kind: 'suggestions', transcript: submitted, items };
		} finally {
			parsePhase.set('idle');
		}
	}

	async function submitDumpAudio(audio: Blob) {
		if (mode.kind === 'processing') return;

		mode = { kind: 'processing', source: 'voice', transcript: '' };
		parsePhase.set('transcribing');
		startSlowTimer();

		const now = new Date().toISOString();
		const dump = await putDump({ raw: '[voice]', source: 'voice', transcript: null, createdAt: now, processed: 0 });
		suggestionContextStore.set({ dumpId: dump.id });

		try {
			const form = new FormData();
			form.set('audio', audio, 'dump.webm');
			if (!browser) return;
			const res = await window.fetch('/api/dump', { method: 'POST', body: form });
			if (!res.ok) throw new Error('parse failed');
			const body = (await res.json()) as DumpResponse;
			const transcript = body.transcript?.trim() || 'Could not confidently transcribe. Try speaking closer to the mic.';
			transcriptStore.set({ text: transcript, source: 'voice', at: new Date().toISOString() });

			// Word-by-word reveal
			startWordReveal(transcript);

			parsePhase.set('parsing');
			await wait(850);
			parsePhase.set('suggesting');
			await wait(260);
			const records = await putSuggestionsForDump(dump.id, body.suggestions ?? []);
			const items = (body.suggestions ?? []).map((item, idx) => ({
				...item,
				suggestionId: records[idx]?.id
			}));
			suggestionsStore.set(items);
			clearSlowTimer();
			stopWordReveal();
			mode = { kind: 'suggestions', transcript, items };
		} catch {
			const fallbackText = 'Could not confidently transcribe. Try speaking closer to the mic.';
			transcriptStore.set({ text: fallbackText, source: 'voice', at: new Date().toISOString() });
			parsePhase.set('suggesting');
			const fallback: SuggestedAction[] = [
				{ action: 'open_loop', title: 'Review voice dump', priority: 'P1', energy: 'active', confidence: browser && navigator.onLine ? 'low' : 'medium' }
			];
			const records = await putSuggestionsForDump(dump.id, fallback);
			const items = fallback.map((item, idx) => ({ ...item, suggestionId: records[idx]?.id }));
			suggestionsStore.set(items);
			clearSlowTimer();
			stopWordReveal();
			mode = { kind: 'suggestions', transcript: fallbackText, items };
		} finally {
			parsePhase.set('idle');
		}
	}

	function startWordReveal(transcript: string) {
		wordReveal = transcript.split(/\s+/);
		revealIndex = 0;
		revealTimer = setInterval(() => {
			if (revealIndex < wordReveal.length) {
				revealIndex++;
			} else if (revealTimer) {
				clearInterval(revealTimer);
			}
		}, 20);
	}

	function stopWordReveal() {
		if (revealTimer) clearInterval(revealTimer);
		revealIndex = wordReveal.length;
	}

	function startSlowTimer() {
		slowThinking = false;
		if (slowTimer) clearTimeout(slowTimer);
		slowTimer = setTimeout(() => {
			slowThinking = true;
		}, 4000);
	}

	function clearSlowTimer() {
		slowThinking = false;
		if (slowTimer) clearTimeout(slowTimer);
	}

	async function startRecording() {
		if (!browser || mode.kind === 'processing') return;
		try {
			mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			audioCtx = new AudioContext();
			const source = audioCtx.createMediaStreamSource(mediaStream);
			const an = audioCtx.createAnalyser();
			an.fftSize = 256;
			an.smoothingTimeConstant = 0.82;
			source.connect(an);
			analyser = an;

			recorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
			audioChunks = [];

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) audioChunks.push(event.data);
			};

			recorder.onstop = async () => {
				mediaStream?.getTracks().forEach((t) => t.stop());
				mediaStream = null;
				if (rafId !== null) cancelAnimationFrame(rafId);
				rafId = null;
				analyser = null;
				if (audioCtx) {
					await audioCtx.close().catch(() => {});
					audioCtx = null;
				}
				const blob = new Blob(audioChunks, { type: recorder?.mimeType || 'audio/webm' });
				recorder = null;
				audioChunks = [];
				if (blob.size > 0) await submitDumpAudio(blob);
			};

			recorder.start();
			durationSec = 0;
			durationInterval = setInterval(() => {
				durationSec++;
			}, 1000);
			mode = { kind: 'voice' };
			haptic(30);
		} catch {
			showToast('Microphone unavailable');
		}
	}

	function stopRecording() {
		if (!recorder || recorder.state === 'inactive') return;
		if (durationInterval) clearInterval(durationInterval);
		durationInterval = null;
		recorder.stop();
		haptic([15, 50, 15]);
	}

	async function pasteClipboard() {
		if (!browser) return;
		try {
			const clip = await navigator.clipboard.readText();
			if (clip.trim()) {
				text = clip;
				mode = { kind: 'text' };
			}
		} catch {
			showToast('Clipboard unavailable');
		}
	}

	async function acceptSuggestion(item: SuggestedAction) {
		if (mode.kind !== 'suggestions') return;
		haptic(20);
		await applySuggestion(item, $suggestionContextStore.dumpId);
		if (item.suggestionId) {
			await setSuggestionStatus(item.suggestionId, 'accepted');
		}
		const remaining = mode.items.filter((entry) => entry !== item);
		suggestionsStore.set(remaining);
		showToast('Suggestion accepted');
		if (remaining.length === 0) {
			finishAllSuggestions();
		} else {
			mode = { ...mode, items: remaining };
		}
	}

	async function dismissSuggestion(item: SuggestedAction) {
		if (mode.kind !== 'suggestions') return;
		if (item.suggestionId) {
			await setSuggestionStatus(item.suggestionId, 'dismissed');
		}
		const remaining = mode.items.filter((entry) => entry !== item);
		suggestionsStore.set(remaining);
		if (remaining.length === 0) {
			finishAllSuggestions();
		} else {
			mode = { ...mode, items: remaining };
		}
	}

	function acceptAll() {
		if (mode.kind !== 'suggestions') return;
		const items = [...mode.items];
		items.forEach((item, i) => {
			setTimeout(() => {
				haptic(15);
				acceptSuggestion(item);
			}, i * 30);
		});
	}

	function finishAllSuggestions() {
		allDone = true;
		setTimeout(() => {
			toResting();
		}, 1000);
	}

	async function handleQuickCreate(data: {
		title: string;
		priority: 'P0' | 'P1' | 'P2';
		energy: 'active' | 'waiting';
		people: Array<{ id: string; name: string }>;
		project: { id: string; name: string } | null;
		deadline: string | null;
	}) {
		const loop = await createLoop({
			title: data.title,
			priority: data.priority,
			energy: data.energy,
			deadline: data.deadline,
			projectId: data.project?.id ?? null
		});
		for (const person of data.people) {
			await putLoopPerson(loop.id, person.id, 'involved');
		}
		haptic(30);
		showToast('Loop created');
		toResting();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && mode.kind !== 'resting') {
			e.preventDefault();
			if (mode.kind === 'voice') {
				stopRecording();
			} else if (mode.kind === 'processing') {
				// Can't cancel processing
			} else {
				toResting();
			}
		}
	}

	onDestroy(() => {
		if (rafId !== null) cancelAnimationFrame(rafId);
		mediaStream?.getTracks().forEach((t) => t.stop());
		if (audioCtx) void audioCtx.close();
		if (durationInterval) clearInterval(durationInterval);
		if (revealTimer) clearInterval(revealTimer);
		if (slowTimer) clearTimeout(slowTimer);
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<section class="pill {heightClass}" class:voice={mode.kind === 'voice'}>
	{#if mode.kind === 'resting'}
		<!-- Resting: orb + placeholder + quick create + mic -->
		<div class="resting-row">
			<div
				class="resting-tap"
				role="button"
				tabindex="0"
				onclick={() => (mode = { kind: 'text' })}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						mode = { kind: 'text' };
					}
				}}
			>
				<Orb mode="resting" />
				<PlaceholderText />
			</div>
			<div class="resting-actions">
				<IconBtn title="Quick create" size={40} onClick={() => (mode = { kind: 'quickcreate' })}>
					<Plus size={16} />
				</IconBtn>
				<IconBtn title="Record voice" size={40} onClick={startRecording}>
					<Mic size={16} />
				</IconBtn>
			</div>
		</div>

	{:else if mode.kind === 'text'}
		<!-- Text: textarea + toolbar -->
		<div class="text-mode">
			<textarea
				class="text-area"
				bind:value={text}
				placeholder="What's on your mind..."
				rows="3"
				autofocus
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						submitDumpText();
					}
				}}
			></textarea>
			<div class="text-toolbar">
				<div class="text-toolbar-left">
					<Orb mode="text" />
					<IconBtn title="Paste" size={40} onClick={pasteClipboard}>
						<Clipboard size={14} />
					</IconBtn>
					<IconBtn title="Clear" size={40} onClick={() => { text = ''; }}>
						<X size={14} />
					</IconBtn>
				</div>
				<button
					class="send-btn"
					class:enabled={!!text.trim()}
					disabled={!text.trim()}
					title="Send"
					onclick={submitDumpText}
				>
					<Send size={14} />
				</button>
			</div>
		</div>

	{:else if mode.kind === 'voice'}
		<!-- Voice: waveform + duration + done -->
		<div
			class="voice-mode"
			role="button"
			tabindex="0"
			onclick={stopRecording}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					stopRecording();
				}
			}}
		>
			<Waveform {analyser} active={true} />
			<div class="voice-footer">
				<Orb mode="voice" />
				<span class="duration">{durationDisplay}</span>
				<button class="done-pill" onclick={(e) => { e.stopPropagation(); stopRecording(); }}>Done</button>
			</div>
		</div>

	{:else if mode.kind === 'processing'}
		<!-- Processing: transcript reveal + orb dots -->
		<div class="processing-mode">
			{#if mode.source === 'voice' && wordReveal.length > 0}
				<p class="transcript">"{revealedText}"</p>
			{:else if mode.source === 'text'}
				<p class="transcript">"{mode.transcript}"</p>
			{/if}
			<div class="processing-footer">
				<Orb mode="processing" />
				{#if slowThinking}
					<span class="slow-text">Still thinking...</span>
				{/if}
			</div>
		</div>

	{:else if mode.kind === 'suggestions'}
		<!-- Suggestions: transcript + cards + footer -->
		<div class="suggestions-mode">
			<p class="suggestion-transcript">{mode.transcript}</p>
			<div class="suggestion-cards">
				{#if allDone}
					<div class="all-done">
						<Check size={12} /> All done
					</div>
				{:else}
					{#each mode.items as item, i (`${item.action}-${item.suggestionId ?? i}`)}
						<SuggestionCard
							{item}
							stagger={i * 50}
							onAccept={() => acceptSuggestion(item)}
							onDismiss={() => dismissSuggestion(item)}
						/>
					{/each}
				{/if}
			</div>
			<div class="suggestion-footer">
				<Orb mode="suggestions" />
				<span class="action-count">{suggestionCount} action{suggestionCount !== 1 ? 's' : ''}</span>
				{#if suggestionCount >= 2 && !allDone}
					<button class="accept-all-pill" onclick={acceptAll}>Accept all</button>
				{/if}
			</div>
		</div>

	{:else if mode.kind === 'quickcreate'}
		<!-- Quick Create form -->
		<QuickCreateForm
			onSubmit={handleQuickCreate}
			onCancel={toResting}
		/>
	{/if}
</section>

<style>
	/* --- Pill container --- */
	.pill {
		margin: 0 8px 6px;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.5);
		border: 1px solid rgba(0, 0, 0, 0.06);
		box-shadow: var(--shadow-md);
		padding: 0 14px;
		overflow: hidden;
		transition:
			min-height 0.3s var(--ease-spring),
			border-color 0.2s var(--ease);
	}

	.pill.voice {
		border-color: rgba(160, 113, 74, 0.15);
	}

	/* Height per mode */
	.pill.resting {
		min-height: 56px;
	}

	.pill.text {
		min-height: 176px;
	}

	.pill.voice {
		min-height: 132px;
	}

	.pill.processing {
		min-height: 112px;
	}

	.pill.suggestions {
		height: auto;
		max-height: min(46vh, 380px);
	}

	.pill.quickcreate {
		height: auto;
		min-height: 220px;
	}

	/* --- Resting --- */
	.resting-row {
		min-height: 56px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.resting-tap {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		min-width: 0;
	}

	.resting-actions {
		display: inline-flex;
		gap: 4px;
		flex-shrink: 0;
	}

	/* --- Text --- */
	.text-mode {
		display: flex;
		flex-direction: column;
		padding: 10px 0;
		gap: 8px;
		height: 100%;
	}

	.text-area {
		flex: 1;
		width: 100%;
		min-height: 60px;
		resize: none;
		border: none;
		background: transparent;
		font-size: 14px;
		font-weight: var(--weight-light);
		line-height: var(--leading-relaxed);
		color: var(--text);
		outline: none;
	}

	.text-area::placeholder {
		color: var(--text4);
	}

	.text-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.text-toolbar-left {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.send-btn {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: none;
		background: var(--surface);
		color: var(--text4);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: not-allowed;
		transition: all 0.2s var(--ease-spring);
	}

	.send-btn.enabled {
		background: var(--accent);
		color: #fff;
		cursor: pointer;
		box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 25%, transparent);
	}

	.send-btn.enabled:active {
		transform: scale(0.92);
	}

	/* --- Voice --- */
	.voice-mode {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 14px;
		padding: 16px 0;
		height: 100%;
		cursor: pointer;
	}

	.voice-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
	}

	.duration {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text3);
	}

	.done-pill {
		min-height: 40px;
		padding: 8px 16px;
		border-radius: 14px;
		border: none;
		background: var(--accent);
		color: #fff;
		font-size: 12px;
		font-weight: 400;
		cursor: pointer;
		transition: transform 0.15s var(--ease-spring);
	}

	.done-pill:active {
		transform: scale(0.95);
	}

	/* --- Processing --- */
	.processing-mode {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 12px;
		padding: 16px 0;
		height: 100%;
	}

	.transcript {
		font-family: var(--font-serif);
		font-size: 15px;
		font-style: italic;
		color: var(--text2);
		line-height: var(--leading-normal);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		line-clamp: 2;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.processing-footer {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.slow-text {
		font-size: 12px;
		font-weight: 300;
		color: var(--text4);
		animation: fadeIn 0.4s var(--ease);
	}

	/* --- Suggestions --- */
	.suggestions-mode {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 0;
		overflow: hidden;
	}

	.suggestion-transcript {
		font-size: 13px;
		font-style: italic;
		color: var(--text3);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.suggestion-cards {
		display: grid;
		gap: 8px;
		max-height: 200px;
		overflow-y: auto;
	}

	.all-done {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		font-weight: 300;
		color: var(--green);
		justify-self: center;
		padding: 8px 0;
		animation: fadeIn 0.2s var(--ease);
	}

	.suggestion-footer {
		display: flex;
		align-items: center;
		gap: 10px;
		padding-top: 4px;
	}

	.action-count {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text3);
		flex: 1;
	}

	.accept-all-pill {
		min-height: 40px;
		padding: 8px 14px;
		border-radius: 14px;
		border: none;
		background: var(--accent);
		color: #fff;
		font-size: 11px;
		font-weight: 400;
		cursor: pointer;
		transition: transform 0.15s var(--ease-spring);
	}

	.accept-all-pill:active {
		transform: scale(0.95);
	}

	@media (min-width: 768px) {
		.pill {
			margin: 0 12px 10px;
			padding: 0 16px;
		}

		.pill.suggestions {
			max-height: min(42vh, 420px);
		}
	}

	@media (min-width: 1024px) {
		.pill {
			margin: 0 14px 12px;
		}
	}
</style>
