<script lang="ts">
	let {
		label,
		color = 'var(--text3)'
	}: {
		label: string;
		color?: string;
	} = $props();
</script>

<h4 style:color>{label}</h4>

<style>
	h4 {
		margin: 0 0 8px;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: var(--tracking-caps-wide);
	}
</style>
