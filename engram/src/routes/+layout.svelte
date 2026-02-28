<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { AlertTriangle, BarChart3, Layers, Users } from 'lucide-svelte';
	import DumpBar from '$components/DumpBar.svelte';
	import { syncNow } from '$db/sync';
	import { loopsStore, pendingSyncStore, syncState } from '$stores/app';
	import { isOverdue } from '$lib/utils';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
	const tabs = [
		{ href: '/loops', label: 'Loops', icon: Layers },
		{ href: '/people', label: 'People', icon: Users },
		{ href: '/mirror', label: 'Mirror', icon: BarChart3 }
	];

	const openCount = $derived(($loopsStore ?? []).filter((loop) => loop.state === 'open').length);
	const overdueCount = $derived(($loopsStore ?? []).filter((loop) => isOverdue(loop.deadline, loop.closedAt)).length);

	onMount(() => {
		const timer = setInterval(async () => {
			if (!navigator.onLine) {
				syncState.set('offline');
				return;
			}
			try {
				syncState.set('syncing');
				await syncNow();
				syncState.set('synced');
			} catch {
				syncState.set('error');
			}
		}, 5000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<title>engram | AI-native loop tracking</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap"
	/>
	<meta
		name="description"
		content="AI-native loop tracking that clears your mind."
	/>
	<link rel="canonical" href="https://engram.adiwak.com{$page.url.pathname}" />
	<meta property="og:title" content="engram" />
	<meta
		property="og:description"
		content="AI-native loop tracking that clears your mind."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://engram.adiwak.com{$page.url.pathname}" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="engram" />
	<meta
		name="twitter:description"
		content="AI-native loop tracking that clears your mind."
	/>
	<link rel="icon" href={favicon} />
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
	<meta name="theme-color" content="#faf9f7" />
</svelte:head>

<main class="app-shell">
	<header class="app-header">
		<h1 class="app-title">engram</h1>
		<div class="app-open-meta">
			<span>{openCount} open</span>
			{#if overdueCount > 0}
				<span style="display:inline-flex;align-items:center;gap:3px;color:var(--red);">
					<AlertTriangle size={12} />
					{overdueCount}
				</span>
			{/if}
			{#if $pendingSyncStore}
				<span class="sr-only">{$syncState}</span>
			{/if}
		</div>
	</header>

	<section class="content">
		{@render children()}
	</section>

	<div class="dump-slot">
		<DumpBar />
	</div>

	<nav class="tab-bar">
		{#each tabs as tab}
			<a class="tab-item" class:active={$page.url.pathname === tab.href} href={tab.href}>
				<tab.icon size={16} strokeWidth={$page.url.pathname === tab.href ? 2 : 1.5} />
				<span>{tab.label}</span>
				<span class="tab-underline"></span>
			</a>
			{/each}
	</nav>
</main>
