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
		border-radius: var(--radius-md);
		border: 1px solid var(--border-soft);
		background: var(--surface-1);
		box-shadow: var(--shadow-sm);
		animation: cardIn 0.24s var(--ease-spring);
	}

	h3 {
		margin: 0;
		font-size: var(--text-xxs);
		color: var(--text3);
		text-transform: uppercase;
		letter-spacing: var(--tracking-caps-wide);
	}

	p {
		margin: 4px 0 0;
		font-family: var(--font-mono);
		font-size: var(--text-xl);
		font-weight: var(--weight-light);
	}
</style>
