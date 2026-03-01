<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { BarChart3, Layers, Settings2, Users } from 'lucide-svelte';
	import DumpBar from '$components/DumpBar.svelte';
	import Toast from '$components/Toast.svelte';
	import { syncNow } from '$db/sync';
	import { syncState, refreshFromServer } from '$stores/app';
	import { toastMessage } from '$stores/toast';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
	const tabs = [
		{ href: '/loops', label: 'Loops', icon: Layers },
		{ href: '/people', label: 'People', icon: Users },
		{ href: '/mirror', label: 'Mirror', icon: BarChart3 },
		{ href: '/manage', label: 'Manage', icon: Settings2 }
	];

	onMount(() => {
		const isLoginRoute = () => window.location.pathname === '/login';

		// Boot: full refresh from D1 (Dexie/liveQuery provides instant render from cache)
		if (navigator.onLine && !isLoginRoute()) {
			syncState.set('syncing');
			refreshFromServer().then((ok) => syncState.set(ok ? 'synced' : 'error'));
		}

		// Periodic refresh: catch any external D1 changes
		const timer = setInterval(async () => {
			if (!navigator.onLine || isLoginRoute()) {
				syncState.set('offline');
				return;
			}
			syncState.set('syncing');
			const ok = await refreshFromServer();
			syncState.set(ok ? 'synced' : 'error');
		}, 10_000);

		// Reconnect handler
		const onOnline = async () => {
			if (isLoginRoute()) return;
			syncState.set('syncing');
			await syncNow();
			await refreshFromServer();
			syncState.set('synced');
		};
		const onOffline = () => syncState.set('offline');

		window.addEventListener('online', onOnline);
		window.addEventListener('offline', onOffline);

		// Dev helper: call window.__seedDexie() in console to wipe + seed local DB
		if (typeof window !== 'undefined') {
			(window as unknown as Record<string, unknown>).__seedDexie = async () => {
				const { db } = await import('$db/schema');
				const res = await fetch('/api/seed');
				const data = await res.json();
				await db.transaction('rw', [db.loops, db.events, db.loopNotes, db.people, db.projects, db.loopPeople, db.dumps, db.suggestions, db.syncQueue], async () => {
					await db.loops.clear();
					await db.events.clear();
					await db.loopNotes.clear();
					await db.people.clear();
					await db.projects.clear();
					await db.loopPeople.clear();
					await db.dumps.clear();
					await db.suggestions.clear();
					await db.syncQueue.clear();
					await db.people.bulkPut(data.people);
					await db.projects.bulkPut(data.projects);
					await db.loops.bulkPut(data.loops);
					await db.loopPeople.bulkPut(data.loopPeople);
					await db.events.bulkPut(data.events);
					await db.loopNotes.bulkPut(data.loopNotes);
				});
				console.log('Seeded: 3 people, 2 projects, 9 loops, 7 notes, 16 events');
				location.reload();
			};
		}

		return () => {
			clearInterval(timer);
			window.removeEventListener('online', onOnline);
			window.removeEventListener('offline', onOffline);
		};
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
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
	<meta name="theme-color" content="#faf9f7" />
</svelte:head>

{#if $page.url.pathname === '/login'}
	{@render children()}
{:else}
	<main class="app-shell">
		<aside class="app-sidebar">
			<h1 class="app-title">engram</h1>
			<nav class="sidebar-nav" aria-label="Primary navigation">
				{#each tabs as tab}
					<a
						class="sidebar-link"
						class:active={tab.href === '/manage' ? $page.url.pathname.startsWith('/manage') : $page.url.pathname === tab.href}
						href={tab.href}
					>
						<tab.icon size={16} strokeWidth={tab.href === '/manage' ? ($page.url.pathname.startsWith('/manage') ? 2 : 1.5) : ($page.url.pathname === tab.href ? 2 : 1.5)} />
						<span>{tab.label}</span>
					</a>
				{/each}
			</nav>
		</aside>

		<div class="app-main">
			<header class="app-header">
				<h1 class="app-title">engram</h1>
			</header>

			<section class="content">
				{#key $page.url.pathname}
					<div class="route-transition page-container" in:fade={{ duration: 160, delay: 80 }} out:fade={{ duration: 100 }}>
						{@render children()}
					</div>
				{/key}
			</section>

			{#if !$page.url.pathname.startsWith('/manage')}
				<div class="dump-slot">
					<DumpBar />
				</div>
			{/if}

			<nav class="tab-bar">
				{#each tabs as tab}
					<a
						class="tab-item"
						class:active={tab.href === '/manage' ? $page.url.pathname.startsWith('/manage') : $page.url.pathname === tab.href}
						href={tab.href}
					>
						<tab.icon size={16} strokeWidth={tab.href === '/manage' ? ($page.url.pathname.startsWith('/manage') ? 2 : 1.5) : ($page.url.pathname === tab.href ? 2 : 1.5)} />
						<span>{tab.label}</span>
						<span class="tab-underline"></span>
					</a>
				{/each}
			</nav>
		</div>
	</main>

	{#if $toastMessage}
		<Toast message={$toastMessage} />
	{/if}
{/if}
