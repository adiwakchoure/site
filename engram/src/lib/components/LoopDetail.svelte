<script lang="ts">
	import ThreadDetail from '$components/ThreadDetail.svelte';
	import type { Loop, LoopEvent } from '$types/models';

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
</script>

<ThreadDetail {loop} {events} {open} {onClose} />
