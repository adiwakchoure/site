<script lang="ts">
	import { Check } from 'lucide-svelte';

	let {
		message
	}: {
		message: string;
	} = $props();
</script>

<div class="toast">
	<Check size={14} />
	<span>{message}</span>
</div>

<style>
	.toast {
		position: fixed;
		left: 50%;
		bottom: 80px;
		transform: translateX(-50%);
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border-radius: 14px;
		background: rgba(26, 26, 26, 0.92);
		backdrop-filter: blur(16px);
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: var(--shadow-xl);
		color: #f2f0ed;
		font-size: 13px;
		animation: toast-in 0.35s var(--ease-spring);
		z-index: 200;
	}
</style>
