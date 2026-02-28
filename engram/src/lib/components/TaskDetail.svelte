<script lang="ts">
	import ThreadDetail from '$components/ThreadDetail.svelte';
	import type { Loop, LoopEvent } from '$types/models';

	let {
		task,
		events,
		open = false,
		onClose
	}: {
		task: Loop | null;
		events: LoopEvent[];
		open: boolean;
		onClose: () => void;
	} = $props();
</script>

<ThreadDetail loop={task} events={events} {open} {onClose} />
