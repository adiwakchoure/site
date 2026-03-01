<script lang="ts">
	let {
		label,
		value,
		color = 'var(--text)'
	}: {
		label: string;
		value: string | number;
		color?: string;
	} = $props();
</script>

<article class="stat">
	<h3>{label}</h3>
	<p style:color>{value}</p>
</article>

<style>
	.stat {
		padding: 12px;
		border-radius: 12px;
		border: 1px solid rgba(0, 0, 0, 0.05);
		background: rgba(255, 255, 255, 0.5);
		box-shadow: var(--shadow-sm);
		animation: cardIn 0.24s var(--ease-spring);
	}

	h3 {
		margin: 0;
		font-size: 9px;
		color: var(--text3);
		text-transform: uppercase;
		letter-spacing: var(--tracking-caps-wide);
	}

	p {
		margin: 4px 0 0;
		font-family: var(--font-mono);
		font-size: 18px;
		font-weight: 300;
	}
</style>
