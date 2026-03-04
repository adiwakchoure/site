<section class="manage">
	<h2>Manage</h2>
	<p>This area is being rebuilt for the loop-first architecture.</p>
	<ul>
		<li>All metadata (people, projects, deadlines) now lives as tags.</li>
		<li>Management controls are moving to loop detail and inbox triage.</li>
		<li>Use the Loops and People tabs for now.</li>
	</ul>
	<a class="logout" href="/api/auth/logout">Sign out</a>
</section>

<style>
	.manage {
		padding: 12px;
		border: 1px solid var(--border-soft);
		border-radius: 12px;
		background: var(--surface-1);
		display: grid;
		gap: 8px;
	}
	h2 {
		margin: 0;
	}
	p, li {
		color: var(--text3);
	}
	ul {
		margin: 0;
		padding-left: 18px;
	}
	.logout {
		margin-top: 8px;
		color: var(--accent);
	}
</style>
