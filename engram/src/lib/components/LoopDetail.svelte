<script lang="ts">
	import ThreadDetail from '$components/ThreadDetail.svelte';
	import type { LoopEvent, LoopView } from '$types/models';

	let {
		loop,
		events,
		open = false,
		onClose
	}: {
		loop: LoopView | null;
		events: LoopEvent[];
		open: boolean;
		onClose: () => void;
	} = $props();
</script>

<ThreadDetail {loop} {events} {open} {onClose} />
