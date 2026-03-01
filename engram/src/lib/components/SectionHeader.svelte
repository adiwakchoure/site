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
		font-size: var(--text-xs);
		font-weight: var(--weight-normal);
		text-transform: uppercase;
		letter-spacing: var(--tracking-caps-wide);
	}
</style>
