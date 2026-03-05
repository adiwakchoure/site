<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { BarChart3, Layers, SlidersHorizontal, Tags, UserRound, X } from 'lucide-svelte';
	import DumpBar from '$components/DumpBar.svelte';
	import Toast from '$components/Toast.svelte';
	import { syncNow } from '$db/sync';
	import { navFilterActiveByRoute, navFilterSheetNonce, syncState, refreshFromServer } from '$stores/app';
	import { toastMessage } from '$stores/toast';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
	let profileOpen = $state(false);
	const tabs = [
		{ href: '/loops', label: 'Loops', icon: Layers },
		{ href: '/tags', label: 'Tags', icon: Tags },
		{ href: '/mirror', label: 'Review', icon: BarChart3 }
	];
	let supportsNavFilters = $derived(
		$page.url.pathname.startsWith('/loops') || $page.url.pathname.startsWith('/tags')
	);
	let navFilterActive = $derived.by(() => {
		if ($page.url.pathname.startsWith('/loops')) return Boolean($navFilterActiveByRoute['/loops']);
		if ($page.url.pathname.startsWith('/tags')) return Boolean($navFilterActiveByRoute['/tags']);
		return false;
	});

	function openNavFilters() {
		navFilterSheetNonce.update((n) => n + 1);
	}

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

		// Track iOS dynamic browser bars + keyboard shifts.
		const setVisualOffset = () => {
			if (!window.visualViewport) {
				document.documentElement.style.setProperty('--visual-viewport-offset', '0px');
				return;
			}
			const active = document.activeElement as HTMLElement | null;
			const editing =
				active &&
				(active.tagName === 'INPUT' ||
					active.tagName === 'TEXTAREA' ||
					active.isContentEditable);
			const rawDelta = Math.max(
				0,
				window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop
			);
			// Only lift UI for keyboard-sized viewport changes.
			const delta = editing && rawDelta > 120 ? rawDelta : 0;
			document.documentElement.style.setProperty('--visual-viewport-offset', `${Math.round(delta)}px`);
		};
		setVisualOffset();
		window.visualViewport?.addEventListener('resize', setVisualOffset);
		window.visualViewport?.addEventListener('scroll', setVisualOffset);

		// Dev helper: call window.__seedDexie() in console to wipe + seed local DB
		if (typeof window !== 'undefined') {
			(window as unknown as Record<string, unknown>).__seedDexie = async () => {
				const { db } = await import('$db/schema');
				const res = await window.fetch('/api/seed');
				const data = await res.json();
				await db.transaction('rw', [db.loops, db.events, db.loopNotes, db.tagTypes, db.tags, db.dumps, db.suggestions, db.syncQueue], async () => {
					await db.loops.clear();
					await db.events.clear();
					await db.loopNotes.clear();
					await db.tagTypes.clear();
					await db.tags.clear();
					await db.dumps.clear();
					await db.suggestions.clear();
					await db.syncQueue.clear();
					await db.tagTypes.bulkPut(data.tagTypes);
					await db.loops.bulkPut(data.loops);
					await db.tags.bulkPut(data.tags);
					await db.events.bulkPut(data.events);
					await db.loopNotes.bulkPut(data.loopNotes);
				});
				console.log('Seeded loop-first demo data');
				location.reload();
			};
		}

		return () => {
			clearInterval(timer);
			window.removeEventListener('online', onOnline);
			window.removeEventListener('offline', onOffline);
			window.visualViewport?.removeEventListener('resize', setVisualOffset);
			window.visualViewport?.removeEventListener('scroll', setVisualOffset);
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
						class:active={$page.url.pathname === tab.href}
						href={tab.href}
					>
						<tab.icon size={16} strokeWidth={$page.url.pathname === tab.href ? 2 : 1.5} />
						<span>{tab.label}</span>
					</a>
				{/each}
			</nav>
			<button class="app-link-btn sidebar-account" type="button" onclick={() => (profileOpen = true)}>
				<UserRound size={14} />
				<span>Profile</span>
			</button>
			{#if supportsNavFilters}
				<button class="app-link-btn" class:active-filter={navFilterActive} type="button" onclick={openNavFilters}>
					<SlidersHorizontal size={14} />
					<span>Filters</span>
				</button>
			{/if}
		</aside>

		<div class="app-main">
			<header class="app-header">
				<h1 class="app-title">engram</h1>
				<div class="app-header-actions">
					{#if supportsNavFilters}
						<button class="avatar-btn" class:active-filter={navFilterActive} type="button" aria-label="Open filters" onclick={openNavFilters}>
							<SlidersHorizontal size={15} />
						</button>
					{/if}
					<button class="avatar-btn" type="button" aria-label="Open profile" onclick={() => (profileOpen = true)}>
						<UserRound size={15} />
					</button>
				</div>
			</header>

			<section class="content">
				{#key $page.url.pathname}
					<div class="route-transition page-container" in:fade={{ duration: 160, delay: 80 }} out:fade={{ duration: 100 }}>
						{@render children()}
					</div>
				{/key}
			</section>

			<div class="dump-slot">
				<DumpBar />
			</div>

			<nav class="tab-bar">
				{#each tabs as tab}
					<a
						class="tab-item"
						class:active={$page.url.pathname === tab.href}
						href={tab.href}
					>
						<tab.icon size={16} strokeWidth={$page.url.pathname === tab.href ? 2 : 1.5} />
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

	{#if profileOpen}
		<div
			class="profile-overlay"
			role="button"
			tabindex="0"
			aria-label="Close profile"
			onpointerdown={() => (profileOpen = false)}
			onkeydown={(event) => {
				if (event.key === 'Escape') profileOpen = false;
			}}
		>
			<div
				class="profile-sheet"
				role="dialog"
				aria-modal="true"
				aria-label="Profile and account"
				tabindex="-1"
				onpointerdown={(event) => event.stopPropagation()}
			>
				<header class="profile-head">
					<div class="profile-title-wrap">
						<h2>Profile</h2>
						<p>Account and preferences</p>
					</div>
					<button type="button" class="profile-close" onclick={() => (profileOpen = false)}><X size={14} /></button>
				</header>
				<div class="profile-content">
					<div class="profile-avatar">U</div>
					<div class="profile-meta">
						<strong>engram user</strong>
						<small>Loop + tags workflow</small>
					</div>
				</div>
				<footer class="profile-footer">
					<a class="profile-action muted" href="/manage">Settings</a>
					<a class="profile-action" href="/api/auth/logout">Sign out</a>
				</footer>
			</div>
		</div>
	{/if}
{/if}
