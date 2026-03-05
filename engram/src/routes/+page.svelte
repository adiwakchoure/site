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
		CircleGauge,
		Compass,
		FlaskConical,
		NotebookPen,
		Orbit,
		PenLine,
		Radar,
		Repeat2,
		ShieldCheck,
		Sparkles,
		Tags
	} from 'lucide-svelte';

	const introPillars = [
		{
			title: 'Time reclaimed',
			description: 'Capture and triage loops in seconds so your highest-leverage work stays in focus.'
		},
		{
			title: 'Signal amplified',
			description: 'Mirror patterns and unresolved threads before they become hidden drag on execution.'
		},
		{
			title: 'Decisions accelerated',
			description: 'Turn reflection into concrete next actions with context-aware loop workflows.'
		}
	];

	const useCases = [
		{
			icon: PenLine,
			title: 'Founder operating system',
			description: 'Track strategic loops, team follow-ups, and decisions without losing narrative context.',
			cta: 'Explore founder workflow',
			href: '#how'
		},
		{
			icon: NotebookPen,
			title: 'Creative project flow',
			description: 'Capture ideas quickly, structure them into threads, and keep momentum across drafts.',
			cta: 'See creative flow',
			href: '#how'
		},
		{
			icon: FlaskConical,
			title: 'Research and synthesis',
			description: 'Map signals across notes, extract recurring patterns, and turn insight into experiments.',
			cta: 'Open research mode',
			href: '#how'
		},
		{
			icon: Compass,
			title: 'Leadership clarity',
			description: 'Hold long-horizon loops in one place while keeping short-horizon actions executable.',
			cta: 'Understand leadership fit',
			href: '#who'
		}
	];

	const journey = [
		{
			step: '01',
			title: 'Capture instantly',
			description: 'Drop voice or text thoughts before context disappears.'
		},
		{
			step: '02',
			title: 'Reflect with AI',
			description: 'Surface patterns, unresolved threads, and recurring friction.'
		},
		{
			step: '03',
			title: 'Act with confidence',
			description: 'Close loops, retag priorities, and move forward with intention.'
		}
	];

	const benefits = [
		{
			label: 'Capture',
			icon: AudioLines,
			headline: 'Never lose a high-value thought',
			description: 'Low-friction input tuned for real cognitive load.',
			points: ['Voice and text capture', 'Fast suggestion handoff', 'Context-aware loop creation']
		},
		{
			label: 'Reflect',
			icon: Brain,
			headline: 'Understand your thinking patterns',
			description: 'Mirror mode turns scattered updates into clear trends.',
			points: ['Pattern detection across loops', 'Review rhythm that compounds', 'AI-native synthesis']
		},
		{
			label: 'Act',
			icon: Orbit,
			headline: 'Convert insight into momentum',
			description: 'Move from reflection to action without losing context.',
			points: ['Tag by project and people', 'Archive and restore effortlessly', 'Visible loop health over time']
		}
	];

	const audiences = [
		{
			icon: CircleGauge,
			title: 'Founders and operators',
			description: 'You carry strategy, execution, and team context simultaneously.'
		},
		{
			icon: Repeat2,
			title: 'Builders and creators',
			description: 'You need a system that supports iteration without creating note clutter.'
		},
		{
			icon: Radar,
			title: 'Researchers and analysts',
			description: 'You need to track evolving signals and convert them into decisions.'
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
	<section class="hero section-enter section-spacious">
		<div class="hero-ambient" aria-hidden="true"></div>
		<div class="hero-copy stagger">
			<h1><em>Engram</em></h1>
			<h2>Think in loops. Decide with clarity.</h2>
			<p>
				Capture quickly, reflect deeply, and move from mental noise to confident next actions.
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
		</div>
		<div class="hero-preview stagger">
			<article class="preview-window panel-soft">
				<header>
					<Badge label="Live loop snapshot" color="var(--green)" />
					<span>Today</span>
				</header>
				<div class="preview-body reveal-grid">
					<div class="preview-row reveal-item">
						<p>Finalize narrative for Q2 review</p>
						<small>strategy, writing</small>
					</div>
					<div class="preview-row reveal-item">
						<p>Recurring friction: async updates</p>
						<small>mirror insight</small>
					</div>
					<div class="preview-row reveal-item">
						<p>Suggested next action: 20-min synthesis block</p>
						<small>high signal</small>
					</div>
				</div>
			</article>
			<div class="hero-stats">
				<StatCard label="Capture latency" value="~5 sec" color="var(--accent)" />
				<StatCard label="Core modes" value="5" color="var(--purple)" />
				<StatCard label="Review rhythm" value="daily" color="var(--green)" />
			</div>
		</div>
	</section>

	<section class="intro section-enter section-compact stagger">
		<div class="section-top">
			<SectionHeader label="What changes with Engram" color="var(--accent)" />
			<h2>A calmer system for complex thinking.</h2>
			<p class="section-support">
				A premium loop workflow with strong negative space, clear signal hierarchy, and deliberate motion.
			</p>
		</div>
		<div class="intro-grid reveal-grid">
			{#each introPillars as pillar}
				<article class="intro-card panel-soft reveal-item">
					<h3>{pillar.title}</h3>
					<p>{pillar.description}</p>
				</article>
			{/each}
		</div>
	</section>

	<section id="use-cases" class="use-cases section-enter section-spacious">
		<div class="section-top stagger">
			<SectionHeader label="Use cases" />
			<h2>Different ways to work, one loop-native foundation.</h2>
			<p class="section-support">
				Choose your operating mode and keep context consistent from first thought to final decision.
			</p>
		</div>
		<div class="use-cases-grid reveal-grid">
			{#each useCases as useCase}
				<article class="use-case-card panel-soft reveal-item">
					<div class="use-case-head">
						<div class="feature-icon">
							<useCase.icon size={16} />
						</div>
						<Badge label="Use case" />
					</div>
					<h3>{useCase.title}</h3>
					<p>{useCase.description}</p>
					<a class="inline-link cta-link" href={useCase.href}>
						<span>{useCase.cta}</span>
						<ArrowRight size={14} />
					</a>
				</article>
			{/each}
		</div>
	</section>

	<section id="how" class="how section-enter section-compact stagger">
		<div class="section-top">
			<SectionHeader label="How it works" color="var(--accent)" />
			<h2>A simple loop: capture, reflect, decide.</h2>
			<p class="section-support">
				Repeat daily and your loop system compounds.
			</p>
		</div>
		<div class="journey-grid reveal-grid">
			{#each journey as item}
				<article class="journey-card panel-soft reveal-item">
					<span class="journey-step">{item.step}</span>
					<h3>{item.title}</h3>
					<p>{item.description}</p>
					<div class="journey-line" aria-hidden="true"></div>
				</article>
			{/each}
		</div>
	</section>

	<section class="capabilities section-enter section-compact">
		<div class="section-top stagger">
			<SectionHeader label="Benefits" />
			<h2>Invisible workflow power, tangible daily output.</h2>
			<p class="section-support">
				Compact capabilities designed for sustained thinking and fast execution.
			</p>
		</div>
		<div class="capability-grid reveal-grid">
			{#each benefits as benefit}
				<article class="capability-card panel-soft stagger reveal-item">
					<div class="capability-head">
						<div class="feature-icon">
							<benefit.icon size={16} />
						</div>
						<Badge label={benefit.label} />
					</div>
					<h3>{benefit.headline}</h3>
					<p>{benefit.description}</p>
					<ul>
						{#each benefit.points as point}
							<li><CheckCircle2 size={13} /> {point}</li>
						{/each}
					</ul>
				</article>
			{/each}
		</div>
	</section>

	<section id="who" class="who section-enter section-compact stagger">
		<div class="section-top">
			<SectionHeader label="Who it is for" color="var(--accent)" />
			<h2>Built for people running complex systems in their head.</h2>
			<p class="section-support">
				If your work spans strategy and execution, Engram gives your thinking a durable operating layer.
			</p>
		</div>
		<div class="who-grid reveal-grid">
			{#each audiences as audience}
				<article class="who-card panel-soft reveal-item">
					<div class="feature-icon">
						<audience.icon size={16} />
					</div>
					<h3>{audience.title}</h3>
					<p>{audience.description}</p>
				</article>
			{/each}
		</div>
	</section>

	<section class="proof section-enter section-spacious stagger">
		<div class="section-top">
			<SectionHeader label="Proof and principles" />
			<h2>Calm interface. Serious depth.</h2>
			<p class="section-support">
				Framer-inspired layout rhythm with Engram-native behavior and discipline.
			</p>
		</div>
		<div class="proof-grid reveal-grid">
			<article class="proof-quote panel-soft reveal-item">
				<p>
					"Engram gives me the feeling of a second brain that actually helps me close loops, not collect clutter."
				</p>
				<small>Early user feedback</small>
			</article>
			<div class="proof-points">
				<div class="panel-soft reveal-item"><Sparkles size={14} /> Refined, medium-intensity microinteractions</div>
				<div class="panel-soft reveal-item"><ShieldCheck size={14} /> Public homepage, authenticated workspace</div>
				<div class="panel-soft reveal-item"><Radar size={14} /> Signal-first review workflows</div>
				<div class="panel-soft reveal-item"><Tags size={14} /> Lightweight, contextual tagging model</div>
			</div>
		</div>
	</section>

	<section class="final-cta section-enter section-compact stagger">
		<SectionHeader label="Start now" color="var(--accent)" />
		<h2>Start with one thought. Build a better loop system.</h2>
		<p>
			Explore the flow on this public page, then continue in your encrypted workspace when ready.
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
		width: min(100%, 1280px);
		margin: 0 auto;
		padding: clamp(44px, 8vw, 118px) clamp(20px, 4.8vw, 72px) clamp(70px, 11vw, 170px);
		display: grid;
		gap: clamp(60px, 14vh, 190px);
	}

	.panel-soft {
		border: 1px solid var(--border-soft);
		border-radius: var(--radius-lg);
		background: color-mix(in srgb, var(--surface-3) 94%, white);
		box-shadow: none;
	}

	.section-enter {
		animation: fadeUp var(--dur-slow) var(--ease-spring) both;
	}

	.section-spacious {
		gap: clamp(24px, 3vw, 36px);
	}

	.section-compact {
		gap: clamp(16px, 2.2vw, 24px);
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
		padding: clamp(20px, 2vw, 32px) 0;
		display: grid;
		grid-template-columns: 1.05fr 0.95fr;
		gap: clamp(26px, 4.5vw, 78px);
		overflow: hidden;
	}

	.hero-ambient {
		display: none;
	}

	.hero-copy {
		position: relative;
		z-index: 1;
		display: grid;
		gap: 20px;
		align-content: start;
		padding-top: clamp(16px, 2vw, 28px);
	}

	h1,
	h2,
	h3,
	p {
		margin: 0;
	}

	.hero h1 {
		font-family: var(--font-serif);
		font-size: clamp(56px, 9.6vw, 132px);
		line-height: 0.84;
		letter-spacing: 0.01em;
		font-weight: var(--weight-light);
		max-width: 9.5ch;
	}

	.hero p {
		max-width: 42ch;
		font-size: clamp(16px, 1.9vw, 22px);
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
			color var(--dur-fast) var(--ease);
	}

	.hero-link:hover {
		transform: translateY(-1px);
		border-color: var(--border-strong);
		color: var(--text);
	}

	.cta-link :global(svg) {
		transition: transform var(--dur-fast) var(--ease-spring);
	}

	.cta-link:hover :global(svg) {
		transform: translateX(2px);
	}

	.hero-preview {
		display: grid;
		gap: 14px;
		align-content: start;
		padding-top: clamp(16px, 2.2vw, 34px);
	}

	.preview-window {
		border-radius: var(--radius-xl);
		padding: 14px;
		display: grid;
		gap: 10px;
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

	.section-support {
		max-width: 62ch;
		font-size: clamp(14px, 1.5vw, 17px);
		color: var(--text2);
		line-height: var(--leading-relaxed);
	}

	.reveal-grid > .reveal-item {
		animation: fadeUp var(--dur-base) var(--ease-spring) both;
	}

	.reveal-grid > .reveal-item:nth-child(1) {
		animation-delay: 30ms;
	}

	.reveal-grid > .reveal-item:nth-child(2) {
		animation-delay: 80ms;
	}

	.reveal-grid > .reveal-item:nth-child(3) {
		animation-delay: 130ms;
	}

	.reveal-grid > .reveal-item:nth-child(4) {
		animation-delay: 180ms;
	}

	.reveal-grid > .reveal-item:nth-child(5) {
		animation-delay: 230ms;
	}

	.reveal-grid > .reveal-item:nth-child(6) {
		animation-delay: 280ms;
	}

	.section-top h2,
	.final-cta h2 {
		font-family: var(--font-serif);
		font-size: clamp(40px, 6vw, 76px);
		line-height: 0.9;
		letter-spacing: 0.01em;
		max-width: 12ch;
	}

	.how {
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

	.intro,
	.who,
	.proof,
	.final-cta {
		padding: 0;
	}

	.intro-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}

	.intro-card {
		padding: 16px;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-soft);
		background: color-mix(in srgb, var(--surface-2) 88%, white);
		display: grid;
		gap: 8px;
		transition: transform var(--dur-fast) var(--ease-spring);
	}

	.intro-card:hover {
		transform: translateY(-1px);
	}

	.intro-card h3 {
		font-size: var(--text-xl);
		font-weight: var(--weight-normal);
		line-height: 1.2;
	}

	.intro-card p {
		font-size: var(--text-md);
		color: var(--text2);
	}

	.use-cases {
		display: grid;
		gap: 18px;
	}

	.use-cases-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}

	.use-case-card {
		padding: 22px;
		display: grid;
		gap: 14px;
		transition:
			transform var(--dur-fast) var(--ease-spring),
			box-shadow var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease);
	}

	.use-case-card:hover {
		transform: translateY(-2px) scale(1.002);
		border-color: color-mix(in srgb, var(--accent) 22%, var(--border-soft));
	}

	.use-case-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.use-case-card h3 {
		font-size: clamp(22px, 2.4vw, 30px);
		font-family: var(--font-serif);
		font-weight: var(--weight-normal);
		line-height: 1;
		letter-spacing: 0.01em;
	}

	.use-case-card p {
		font-size: var(--text-md);
		color: var(--text2);
		line-height: var(--leading-relaxed);
	}

	.inline-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: var(--text-sm);
		color: var(--text2);
		text-decoration: none;
		padding: 6px 0;
	}

	.inline-link:hover {
		color: var(--text);
	}

	.capability-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}

	.capability-card {
		padding: 20px;
		display: grid;
		gap: 12px;
		transition:
			transform var(--dur-fast) var(--ease-spring),
			box-shadow var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease);
	}

	.capability-card:hover {
		transform: translateY(-2px) scale(1.002);
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
		padding: 18px;
	}

	.proof-quote {
		display: grid;
		gap: 8px;
	}

	.proof-quote p {
		font-family: var(--font-serif);
		font-size: clamp(30px, 4.5vw, 56px);
		line-height: 1.05;
		letter-spacing: 0.005em;
		max-width: 14ch;
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
		padding: 12px;
		font-size: var(--text-sm);
		color: var(--text2);
	}

	.who-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}

	.who-card {
		padding: 20px;
		display: grid;
		gap: 10px;
		transition: transform var(--dur-fast) var(--ease-spring);
	}

	.who-card:hover {
		transform: translateY(-1px);
	}

	.who-card h3 {
		font-size: var(--text-xl);
		font-weight: var(--weight-normal);
	}

	.who-card p {
		font-size: var(--text-md);
		color: var(--text2);
	}

	.final-cta {
		display: grid;
		gap: 18px;
	}

	.final-cta p {
		max-width: 44ch;
		color: var(--text2);
		font-size: clamp(16px, 1.8vw, 21px);
	}

	@media (max-width: 1080px) {
		.hero,
		.proof-grid {
			grid-template-columns: 1fr;
		}

		.intro-grid,
		.who-grid,
		.use-cases-grid,
		.capability-grid,
		.journey-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 920px) {
		.hero-stats,
		.intro-grid,
		.who-grid,
		.use-cases-grid,
		.capability-grid,
		.journey-grid,
		.proof-grid {
			grid-template-columns: 1fr;
		}

		.hero h1 {
			font-size: clamp(32px, 11vw, 52px);
		}

		.home-page {
			gap: 60px;
			padding-top: 14px;
			padding-bottom: 28px;
		}

		.section-support {
			max-width: 100%;
		}
	}

	@media (max-width: 560px) {
		.hero,
		.intro,
		.how,
		.who,
		.proof,
		.final-cta,
		.capability-card {
			padding: 0;
		}

		.section-top h2,
		.final-cta h2 {
			font-size: clamp(28px, 10vw, 40px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.section-enter,
		.stagger > :global(*),
		.reveal-grid > .reveal-item,
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
