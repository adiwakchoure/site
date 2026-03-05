<script lang="ts">
	import { X } from 'lucide-svelte';
	import ActionBtn from '$components/ActionBtn.svelte';
	import Pill from '$components/Pill.svelte';

	let {
		onSubmit,
		onCancel
	}: {
		onSubmit: (data: {
			title: string;
			priority: 'P0' | 'P1' | 'P2';
			people: string[];
			project: string | null;
			deadline: string | null;
		}) => void;
		onCancel: () => void;
	} = $props();

	let title = $state('');
	let priority = $state<'P0' | 'P1' | 'P2'>('P1');
	let peopleInput = $state('');
	let projectInput = $state('');
	let deadline = $state<string | null>(null);

	function handleSubmit() {
		if (!title.trim()) return;
		const people = peopleInput.split(',').map((v) => v.trim()).filter(Boolean);
		onSubmit({ title: title.trim(), priority, people, project: projectInput.trim() || null, deadline });
	}
</script>

<div class="qc" role="group" aria-label="Quick create loop">
	<input
		class="title-input"
		bind:value={title}
		placeholder="Loop title..."
		onkeydown={(e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				handleSubmit();
			}
			if (e.key === 'Escape') onCancel();
		}}
	/>

	<div class="row g1" style="animation-delay:40ms">
		<Pill label="P0" active={priority === 'P0'} onClick={() => (priority = 'P0')} />
		<Pill label="P1" active={priority === 'P1'} onClick={() => (priority = 'P1')} />
		<Pill label="P2" active={priority === 'P2'} onClick={() => (priority = 'P2')} />
	</div>

	<div class="chips-row g3" style="animation-delay:80ms">
		<input class="search-input" bind:value={peopleInput} placeholder="People (comma separated)" />
		<input class="search-input" bind:value={projectInput} placeholder="Project (optional)" />
		<input class="date-input" type="date" bind:value={deadline} />
	</div>

	<div class="footer g4" style="animation-delay:120ms">
		<button class="cancel-btn" onclick={onCancel} title="Cancel">
			<X size={16} />
		</button>
		<ActionBtn title="Create" disabled={!title.trim()} onClick={handleSubmit}>Create</ActionBtn>
	</div>
</div>

<style>
	.qc {
		display: grid;
		gap: 10px;
		padding: 4px 0;
	}

	.title-input {
		width: 100%;
		border: none;
		background: transparent;
		font-size: var(--text-lg);
		font-weight: var(--weight-light);
		color: var(--text);
		outline: none;
		padding: 2px 0;
	}

	.title-input::placeholder {
		color: var(--text4);
	}

	.row {
		display: inline-flex;
		gap: 4px;
		animation: fadeUp 0.3s var(--ease-spring) backwards;
	}

	.chips-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		animation: fadeUp 0.3s var(--ease-spring) backwards;
	}

	.search-input {
		width: min(100%, 240px);
		max-width: 100%;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
		background: transparent;
		font-size: var(--text-sm);
		font-weight: 300;
		color: var(--text);
		outline: none;
		padding: 8px 2px;
	}

	.date-input {
		min-height: 40px;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
		background: transparent;
		font-size: var(--text-sm);
		font-weight: 300;
		color: var(--text);
		outline: none;
		padding: 8px 2px;
	}

	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		animation: fadeUp 0.3s var(--ease-spring) backwards;
	}

	.cancel-btn {
		width: 40px;
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		color: var(--text4);
		cursor: pointer;
		border-radius: var(--radius-sm);
		transition: color 0.15s var(--ease);
	}

	.cancel-btn:active {
		color: var(--text2);
	}

</style>
