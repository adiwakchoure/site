<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import { Mic, PenLine, Plus, Send, Square, WifiOff } from 'lucide-svelte';
	import { putDump } from '$db/local';
	import { activeInsightStore, parsePhase, suggestionContextStore, suggestionsStore, transcriptStore } from '$stores/app';
	import type { SuggestedAction } from '$types/models';
	import { goto } from '$app/navigation';

	let text = $state('');
	let loading = $state(false);
	let recording = $state(false);
	let recorder: MediaRecorder | null = null;
	let audioChunks: Blob[] = [];
	let recordError = $state<string | null>(null);
	let mediaStream: MediaStream | null = null;
	let audioCtx: AudioContext | null = null;
	let analyser: AnalyserNode | null = null;
	let rafId: number | null = null;
	let micLevel = $state(0.12);
	let bars = $state<number[]>(Array.from({ length: 16 }, () => 0.14));
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
		recordError = null;
		parsePhase.set('transcribing');

		const now = new Date().toISOString();
		const dump = await putDump({ raw: '[voice]', createdAt: now, processed: 0 });
		suggestionContextStore.set({ dumpId: dump.id });

		try {
			const form = new FormData();
			form.set('audio', audio, 'dump.webm');
			const res = await fetch('/api/dump', {
				method: 'POST',
				body: form
			});
			if (!res.ok) throw new Error('parse failed');
			const body = (await res.json()) as DumpResponse;
			if (body.active) activeInsightStore.set(body.active);
			transcriptStore.set({
				text: body.transcript?.trim() || 'Could not confidently transcribe. Try speaking closer to the mic.',
				source: 'voice',
				at: new Date().toISOString()
			});
			parsePhase.set('parsing');
			await wait(850);
			parsePhase.set('suggesting');
			await wait(260);
			suggestionsStore.set(body.suggestions ?? []);
		} catch {
			transcriptStore.set({
				text: 'Could not confidently transcribe. Try speaking closer to the mic.',
				source: 'voice',
				at: new Date().toISOString()
			});
			parsePhase.set('suggesting');
			suggestionsStore.set([
				{
					action: 'open_loop',
					title: 'Review voice dump',
					priority: 'P1',
					energy: 'active',
					confidence: browser && navigator.onLine ? 'low' : 'medium'
				}
			]);
		} finally {
			parsePhase.set('idle');
			loading = false;
		}
	}

	async function submitDumpText() {
		const raw = text.trim();
		if (!raw || loading) return;

		loading = true;
		text = '';
		recordError = null;
		parsePhase.set('parsing');

		const now = new Date().toISOString();
		const dump = await putDump({ raw, createdAt: now, processed: 0 });
		suggestionContextStore.set({ dumpId: dump.id });

		try {
			const res = await fetch('/api/dump', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text: raw })
			});
			if (!res.ok) throw new Error('parse failed');
			const body = (await res.json()) as DumpResponse;
			if (body.active) activeInsightStore.set(body.active);
			transcriptStore.set({
				text: body.transcript?.trim() || raw,
				source: 'text',
				at: new Date().toISOString()
			});
			parsePhase.set('suggesting');
			await wait(160);
			suggestionsStore.set(body.suggestions ?? []);
		} catch {
			transcriptStore.set({
				text: raw,
				source: 'text',
				at: new Date().toISOString()
			});
			parsePhase.set('suggesting');
			suggestionsStore.set([
				{ action: 'open_loop', title: raw, priority: 'P1', energy: 'active', confidence: browser && navigator.onLine ? 'low' : 'medium' }
			]);
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
				const bucket = Math.floor(activeBins.length / 16);
				for (let i = 0; i < 16; i++) {
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
				bars = Array.from({ length: 16 }, () => 0.14);
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

	onDestroy(() => {
		if (rafId !== null) cancelAnimationFrame(rafId);
		mediaStream?.getTracks().forEach((track) => track.stop());
		if (audioCtx) void audioCtx.close();
	});
</script>

<section class="dump">
	<div class="row">
		<PenLine size={14} />
		{#if $parsePhase !== 'idle'}
			<span class="phase">{$parsePhase}</span>
		{/if}
		{#if browser && !navigator.onLine}
			<span class="offline"><WifiOff size={13} /> offline</span>
		{/if}
	</div>
	{#if recording || $parsePhase === 'transcribing'}
		<section class="agent" class:transcribing={$parsePhase === 'transcribing'}>
			<div class="orb-wrap" style={`--level:${micLevel};`}>
				<div class="orb"></div>
				<div class="orb-core"></div>
			</div>
			<div class="wave">
				{#each bars as bar, i (`bar-${i}`)}
					<span style={`--h:${Math.round(bar * 100)}%; --d:${i * 16}ms;`}></span>
				{/each}
			</div>
			<p>{recording ? 'Listening...' : 'Transcribing voice...'}</p>
		</section>
	{/if}
	<textarea
		bind:value={text}
		placeholder="Brain dump a commitment..."
		rows="3"
		onkeydown={(event) => {
			if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') submitDumpText();
		}}
	></textarea>
	<div class="actions">
		<button type="button" class="manual" onclick={() => goto('/loops?manual=1')}>
			<Plus size={14} /> New
		</button>
		<button
			type="button"
			class:recording
			class="mic"
			disabled={loading}
			onclick={() => (recording ? stopRecording() : startRecording())}
		>
			{#if recording}
				<Square size={14} /> Stop
			{:else}
				<Mic size={14} /> Voice
			{/if}
		</button>
		<button type="button" class="send" disabled={loading || !text.trim()} onclick={submitDumpText}>
			<Send size={14} />
			{loading ? 'Parsing...' : 'Parse dump'}
		</button>
	</div>
	{#if recordError}
		<p class="error">{recordError}</p>
	{/if}
</section>

<style>
	.dump {
		position: sticky;
		bottom: 0;
		background: rgba(250, 249, 247, 0.94);
		backdrop-filter: blur(8px);
		border-top: 1px solid rgba(0, 0, 0, 0.06);
		padding: 0.7rem;
		display: grid;
		gap: 0.5rem;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		color: #8a857f;
		font-size: 0.75rem;
	}
	textarea {
		resize: none;
		border: 1px solid rgba(0, 0, 0, 0.08);
		background: rgba(255, 255, 255, 0.85);
		border-radius: 10px;
		padding: 0.6rem;
		font: inherit;
	}
	.send {
		border: 0;
		background: #a0714a;
		color: white;
		border-radius: 10px;
		padding: 0.55rem 0.75rem;
		display: inline-flex;
		gap: 0.4rem;
		justify-content: center;
		align-items: center;
	}
	.send:disabled {
		opacity: 0.5;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
	}
	.mic {
		border: 1px solid rgba(0, 0, 0, 0.1);
		background: rgba(255, 255, 255, 0.8);
		color: #5a5651;
		border-radius: 10px;
		padding: 0.55rem 0.75rem;
		display: inline-flex;
		gap: 0.4rem;
		align-items: center;
	}
	.manual {
		border: 1px solid rgba(0, 0, 0, 0.1);
		background: rgba(255, 255, 255, 0.82);
		color: #5a5651;
		border-radius: 10px;
		padding: 0.55rem 0.75rem;
		display: inline-flex;
		gap: 0.4rem;
		align-items: center;
	}
	.mic.recording {
		background: rgba(192, 69, 58, 0.14);
		color: #8f2b22;
		border-color: rgba(192, 69, 58, 0.3);
	}
	.offline {
		display: inline-flex;
		gap: 0.3rem;
		align-items: center;
	}
	.phase {
		font-family: 'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
		color: #8a857f;
		text-transform: capitalize;
	}
	.agent {
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.64));
		border: 1px solid rgba(0, 0, 0, 0.06);
		border-radius: 12px;
		padding: 0.7rem;
		display: grid;
		gap: 0.55rem;
		animation: cardIn 240ms cubic-bezier(0.16, 1, 0.3, 1);
		position: relative;
		overflow: hidden;
	}
	.agent.transcribing::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			110deg,
			transparent 0%,
			rgba(255, 255, 255, 0.36) 30%,
			rgba(255, 255, 255, 0.5) 50%,
			rgba(255, 255, 255, 0.36) 70%,
			transparent 100%
		);
		animation: shimmerSweep 1.25s linear infinite;
		pointer-events: none;
	}
	.agent p {
		margin: 0;
		font-size: 0.77rem;
		color: #5a5651;
	}
	.orb-wrap {
		position: relative;
		width: 42px;
		height: 42px;
	}
	.orb {
		position: absolute;
		inset: 0;
		border-radius: 999px;
		background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.9), rgba(160, 113, 74, 0.38));
		transform: scale(calc(0.9 + var(--level) * 0.38));
		opacity: calc(0.55 + var(--level) * 0.45);
		animation: pulse 1.2s ease-in-out infinite;
	}
	.orb-core {
		position: absolute;
		inset: 10px;
		border-radius: 999px;
		background: #a0714a;
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.45) inset;
	}
	.wave {
		height: 30px;
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
		animation: shimmer 1.6s ease-in-out infinite;
		animation-delay: var(--d);
	}
	.error {
		margin: 0;
		font-size: 0.75rem;
		color: #8f2b22;
	}
	@keyframes pulse {
		0%,
		100% {
			filter: drop-shadow(0 0 0 rgba(160, 113, 74, 0.08));
		}
		50% {
			filter: drop-shadow(0 0 10px rgba(160, 113, 74, 0.24));
		}
	}
	@keyframes shimmer {
		0%,
		100% {
			opacity: 0.6;
		}
		50% {
			opacity: 1;
		}
	}
	@keyframes shimmerSweep {
		from {
			transform: translateX(-130%);
		}
		to {
			transform: translateX(130%);
		}
	}
	@keyframes cardIn {
		from {
			opacity: 0;
			transform: translateY(5px) scale(0.99);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
</style>
