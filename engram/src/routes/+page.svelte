<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import ActionBtn from '$components/ActionBtn.svelte';
	import Badge from '$components/Badge.svelte';
	import SectionHeader from '$components/SectionHeader.svelte';
	import StatCard from '$components/StatCard.svelte';
	import {
		ArrowRight,
		AudioLines,
		Brain,
		CheckCircle2,
		Orbit,
		Radar,
		ShieldCheck,
		Sparkles,
		Tags
	} from 'lucide-svelte';

	const journey = [
		{
			step: '01',
			title: 'Capture instantly',
			description: 'Drop voice or text thoughts in seconds before context disappears.'
		},
		{
			step: '02',
			title: 'Reflect with AI',
			description: 'See patterns, unresolved threads, and recurring friction in one view.'
		},
		{
			step: '03',
			title: 'Act with confidence',
			description: 'Close loops, retag priorities, and keep your mental stack intentionally light.'
		}
	];

	const pillars = [
		{
			label: 'Capture',
			icon: AudioLines,
			headline: 'Never lose a raw thought',
			description: 'Engram is built for low-friction input when your head is busy.',
			points: ['Voice and text capture', 'Fast suggestion handoff', 'Context-aware loop creation']
		},
		{
			label: 'Reflect',
			icon: Brain,
			headline: 'Understand your thinking patterns',
			description: 'Mirror mode turns scattered updates into clear trends and signals.',
			points: ['Pattern detection across loops', 'Review rhythm that compounds', 'AI-native synthesis']
		},
		{
			label: 'Act',
			icon: Orbit,
			headline: 'Convert insight into momentum',
			description: 'Make decisions faster without sacrificing depth or context.',
			points: ['Tag by project and people', 'Archive and restore effortlessly', 'Visible loop health over time']
		}
	];

	function openPrimaryCta() {
		return goto($page.data.user?.id ? '/loops' : '/login');
	}
</script>

<svelte:head>
	<title>engram | Think in loops, not tabs</title>
	<meta
		name="description"
		content="Engram is an AI-native loop tracker for capturing thoughts, reviewing patterns, and keeping your mind clear."
	/>
</svelte:head>

<main class="home-page">
	<section class="hero panel section-enter">
		<div class="hero-ambient" aria-hidden="true"></div>
		<div class="hero-copy stagger">
			<Badge label="Public homepage" color="var(--purple)" />
			<h1>Think in loops. Work with clarity.</h1>
			<p>
				Engram helps you capture fast, reflect deeply, and keep the right loops open.
				It is an AI-native workspace for people carrying serious cognitive load.
			</p>
			<div class="hero-cta-row">
				<ActionBtn
					title={$page.data.user?.id ? 'Open my workspace' : 'Get started'}
					onClick={openPrimaryCta}
				/>
				<a class="hero-link cta-link" href="#how">
					<span>See how it works</span>
					<ArrowRight size={14} />
				</a>
			</div>
			<p class="hero-note">No auth required to explore this page.</p>
		</div>
		<div class="hero-preview stagger">
			<article class="preview-window">
				<header>
					<Badge label="Live loop snapshot" color="var(--green)" />
					<span>Today</span>
				</header>
				<div class="preview-body">
					<div class="preview-row">
						<p>Finalize narrative for Q2 review</p>
						<small>strategy, writing</small>
					</div>
					<div class="preview-row">
						<p>Recurring friction: async updates</p>
						<small>mirror insight</small>
					</div>
					<div class="preview-row">
						<p>Suggested next action: 20-min synthesis block</p>
						<small>high signal</small>
					</div>
				</div>
			</article>
			<div class="hero-stats">
				<StatCard label="Capture latency" value="~5 sec" color="var(--accent)" />
				<StatCard label="Core modes" value="4" color="var(--purple)" />
				<StatCard label="Review rhythm" value="daily" color="var(--green)" />
			</div>
		</div>
	</section>

	<section id="how" class="how panel section-enter stagger">
		<div class="section-top">
			<SectionHeader label="How it works" color="var(--accent)" />
			<h2>A simple loop: capture, reflect, decide.</h2>
		</div>
		<div class="journey-grid">
			{#each journey as item}
				<article class="journey-card">
					<span class="journey-step">{item.step}</span>
					<h3>{item.title}</h3>
					<p>{item.description}</p>
					<div class="journey-line" aria-hidden="true"></div>
				</article>
			{/each}
		</div>
	</section>

	<section class="capabilities section-enter">
		<div class="section-top stagger">
			<SectionHeader label="Why teams and founders use Engram" />
			<h2>Built for sustained thinking, not just quick notes.</h2>
		</div>
		<div class="capability-grid">
			{#each pillars as pillar}
				<article class="capability-card panel stagger">
					<div class="capability-head">
						<div class="feature-icon">
							<pillar.icon size={16} />
						</div>
						<Badge label={pillar.label} />
					</div>
					<h3>{pillar.headline}</h3>
					<p>{pillar.description}</p>
					<ul>
						{#each pillar.points as point}
							<li><CheckCircle2 size={13} /> {point}</li>
						{/each}
					</ul>
				</article>
			{/each}
		</div>
	</section>

	<section class="proof panel section-enter stagger">
		<div class="section-top">
			<SectionHeader label="Proof and principles" />
			<h2>Calm interface, serious depth.</h2>
		</div>
		<div class="proof-grid">
			<article class="proof-quote">
				<p>
					"Engram gives me the feeling of a second brain that actually helps me close loops, not collect clutter."
				</p>
				<small>Early user feedback</small>
			</article>
			<div class="proof-points">
				<div><Sparkles size={14} /> Refined, medium-intensity microinteractions</div>
				<div><ShieldCheck size={14} /> Public homepage, authenticated workspace</div>
				<div><Radar size={14} /> Signal-first review workflows</div>
				<div><Tags size={14} /> Lightweight, contextual tagging model</div>
			</div>
		</div>
	</section>

	<section class="final-cta panel section-enter stagger">
		<SectionHeader label="Start now" color="var(--accent)" />
		<h2>Start with one thought. Build a better loop system.</h2>
		<p>
			Explore freely from this public page, then move into your private workspace when you are ready.
		</p>
		<div class="hero-cta-row">
			<ActionBtn
				title={$page.data.user?.id ? 'Go to loops' : 'Get started'}
				onClick={openPrimaryCta}
			/>
			<a class="hero-link cta-link" href={$page.data.user?.id ? '/loops' : '/login'}>
				<span>{$page.data.user?.id ? 'Enter app' : 'Go to login'}</span>
				<ArrowRight size={14} />
			</a>
		</div>
	</section>
</main>

<style>
	.home-page {
		width: min(100%, 1180px);
		margin: 0 auto;
		padding: clamp(20px, 3.2vw, 52px);
		display: grid;
		gap: clamp(14px, 2.6vw, 34px);
	}

	.panel {
		border: 1px solid var(--border-soft);
		border-radius: var(--radius-xl);
		background:
			linear-gradient(160deg, color-mix(in srgb, var(--surface-3) 95%, white) 0%, var(--surface-2) 100%);
		box-shadow: var(--shadow-md);
	}

	.section-enter {
		animation: fadeUp var(--dur-slow) var(--ease-spring) both;
	}

	.stagger > :global(*) {
		animation: fadeUp var(--dur-base) var(--ease-spring) both;
	}

	.stagger > :global(*:nth-child(1)) {
		animation-delay: 20ms;
	}

	.stagger > :global(*:nth-child(2)) {
		animation-delay: 80ms;
	}

	.stagger > :global(*:nth-child(3)) {
		animation-delay: 140ms;
	}

	.stagger > :global(*:nth-child(4)) {
		animation-delay: 200ms;
	}

	.hero {
		position: relative;
		padding: clamp(20px, 4vw, 48px);
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
		gap: clamp(16px, 2.5vw, 30px);
		overflow: hidden;
	}

	.hero-ambient {
		position: absolute;
		inset: -35% auto auto -8%;
		width: clamp(260px, 44vw, 560px);
		height: clamp(250px, 40vw, 500px);
		background:
			radial-gradient(circle, color-mix(in srgb, var(--accent) 20%, transparent) 0%, transparent 64%),
			radial-gradient(circle at 70% 30%, color-mix(in srgb, var(--purple) 16%, transparent) 0%, transparent 68%);
		pointer-events: none;
		animation: fadeIn 680ms var(--ease) both;
	}

	.hero-copy {
		position: relative;
		z-index: 1;
		display: grid;
		gap: 16px;
		align-content: start;
	}

	h1,
	h2,
	h3,
	p {
		margin: 0;
	}

	.hero h1 {
		font-family: var(--font-serif);
		font-size: clamp(40px, 6.9vw, 82px);
		line-height: 0.9;
		letter-spacing: 0.01em;
	}

	.hero p {
		max-width: 58ch;
		font-size: clamp(15px, 1.6vw, 19px);
		color: var(--text2);
		line-height: var(--leading-relaxed);
	}

	.hero-note {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text3);
	}

	.hero-cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}

	.hero-link {
		min-height: 40px;
		padding: 8px 14px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-soft);
		background: color-mix(in srgb, var(--surface-2) 80%, white);
		color: var(--text2);
		text-decoration: none;
		transition:
			transform var(--dur-fast) var(--ease-spring),
			border-color var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease),
			box-shadow var(--dur-fast) var(--ease);
	}

	.hero-link:hover {
		transform: translateY(-1px);
		border-color: var(--border-strong);
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}

	.cta-link :global(svg) {
		transition: transform var(--dur-fast) var(--ease-spring);
	}

	.cta-link:hover :global(svg) {
		transform: translateX(2px);
	}

	.hero-preview {
		display: grid;
		gap: 10px;
		align-content: start;
	}

	.preview-window {
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-soft);
		background: color-mix(in srgb, var(--surface-3) 92%, white);
		padding: 12px;
		display: grid;
		gap: 10px;
		box-shadow: var(--shadow-sm);
	}

	.preview-window header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.preview-window header span {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text3);
	}

	.preview-body {
		display: grid;
		gap: 8px;
	}

	.preview-row {
		padding: 10px;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-soft);
		background: color-mix(in srgb, var(--surface-1) 82%, white);
		display: grid;
		gap: 4px;
		transition:
			transform var(--dur-fast) var(--ease-spring),
			border-color var(--dur-fast) var(--ease);
	}

	.preview-row:hover {
		transform: translateY(-1px);
		border-color: color-mix(in srgb, var(--accent) 20%, var(--border-soft));
	}

	.preview-row p {
		font-size: var(--text-sm);
		font-weight: var(--weight-normal);
		color: var(--text);
	}

	.preview-row small {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text3);
	}

	.hero-stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}

	.section-top {
		display: grid;
		gap: 10px;
	}

	.section-top h2,
	.final-cta h2 {
		font-family: var(--font-serif);
		font-size: clamp(30px, 4.8vw, 50px);
		line-height: 0.96;
		letter-spacing: 0.01em;
	}

	.how {
		padding: clamp(20px, 3.1vw, 34px);
		display: grid;
		gap: 18px;
	}

	.journey-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}

	.journey-card {
		padding: 14px;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-soft);
		background: color-mix(in srgb, var(--surface-2) 88%, white);
		display: grid;
		gap: 8px;
		position: relative;
		transition: transform var(--dur-fast) var(--ease-spring);
	}

	.journey-card:hover {
		transform: translateY(-1px);
	}

	.journey-step {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--accent);
	}

	.journey-card h3 {
		font-size: var(--text-xl);
		font-weight: var(--weight-normal);
		line-height: 1.2;
	}

	.journey-card p {
		color: var(--text2);
		font-size: var(--text-md);
		max-width: 38ch;
	}

	.journey-line {
		height: 1px;
		width: 100%;
		background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 28%, transparent), transparent);
	}

	.capabilities {
		display: grid;
		gap: 16px;
	}

	.capability-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}

	.capability-card {
		padding: 16px;
		display: grid;
		gap: 10px;
		transition:
			transform var(--dur-fast) var(--ease-spring),
			box-shadow var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease);
	}

	.capability-card:hover {
		transform: translateY(-2px) scale(1.002);
		box-shadow: var(--shadow-lg);
		border-color: color-mix(in srgb, var(--accent) 22%, var(--border-soft));
	}

	.capability-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.feature-icon {
		width: 32px;
		height: 32px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--accent) 12%, white);
		color: var(--accent);
	}

	.capability-card h3 {
		font-size: var(--text-xl);
		font-weight: var(--weight-normal);
		line-height: 1.25;
	}

	.capability-card p {
		color: var(--text2);
		font-size: var(--text-md);
	}

	.capability-card ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 6px;
	}

	.capability-card li {
		display: grid;
		grid-template-columns: 14px 1fr;
		gap: 8px;
		align-items: center;
		font-size: var(--text-sm);
		color: var(--text2);
	}

	.capability-card li :global(svg) {
		color: var(--green);
	}

	.proof {
		padding: clamp(20px, 3vw, 34px);
		display: grid;
		gap: 16px;
	}

	.proof-grid {
		display: grid;
		grid-template-columns: 1.1fr 1fr;
		gap: 10px;
	}

	.proof-quote,
	.proof-points {
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-soft);
		background: color-mix(in srgb, var(--surface-2) 88%, white);
		padding: 12px;
	}

	.proof-quote {
		display: grid;
		gap: 8px;
	}

	.proof-quote p {
		font-family: var(--font-serif);
		font-size: clamp(24px, 3vw, 34px);
		line-height: 1.05;
		letter-spacing: 0.005em;
	}

	.proof-quote small {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text2);
	}

	.proof-points {
		display: grid;
		gap: 10px;
	}

	.proof-points div {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 42px;
		padding: 8px 10px;
		font-size: var(--text-sm);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-soft);
		background: color-mix(in srgb, var(--surface-1) 74%, white);
		color: var(--text2);
	}

	.final-cta {
		padding: clamp(20px, 3.2vw, 36px);
		display: grid;
		gap: 14px;
	}

	.final-cta p {
		max-width: 64ch;
		color: var(--text2);
	}

	@media (max-width: 1080px) {
		.hero,
		.proof-grid {
			grid-template-columns: 1fr;
		}

		.capability-grid,
		.journey-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 920px) {
		.hero-stats,
		.capability-grid,
		.journey-grid,
		.proof-grid {
			grid-template-columns: 1fr;
		}

		.hero h1 {
			font-size: clamp(34px, 12vw, 58px);
		}

		.home-page {
			gap: 16px;
			padding-top: 14px;
			padding-bottom: 28px;
		}
	}

	@media (max-width: 560px) {
		.hero,
		.how,
		.proof,
		.final-cta,
		.capability-card {
			padding: 14px;
		}

		.section-top h2,
		.final-cta h2 {
			font-size: clamp(28px, 10vw, 40px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.section-enter,
		.stagger > :global(*),
		.hero-link,
		.preview-row,
		.capability-card,
		.journey-card,
		.cta-link :global(svg) {
			animation: none;
			transition: none;
		}
	}
</style>
