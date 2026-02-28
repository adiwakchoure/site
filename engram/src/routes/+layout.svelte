<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import DumpBar from '$components/DumpBar.svelte';
	import SuggestionCard from '$components/SuggestionCard.svelte';
	import { syncNow } from '$db/sync';
	import { applySuggestion } from '$lib/suggestions';
	import { activeInsightStore, parsePhase, pendingSyncStore, suggestionContextStore, suggestionsStore, syncState, transcriptStore } from '$stores/app';
	import type { SuggestedAction } from '$types/models';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
	const tabs = [
		{ href: '/loops', label: 'Loops' },
		{ href: '/people', label: 'People' },
		{ href: '/mirror', label: 'Mirror' }
	];

	async function acceptSuggestion(item: SuggestedAction) {
		await applySuggestion(item, $suggestionContextStore.dumpId);
		suggestionsStore.update((v) => v.filter((x) => x !== item));
		if ($suggestionsStore.length <= 1) {
			setTimeout(() => {
				suggestionsStore.set([]);
				suggestionContextStore.set({ dumpId: null });
			}, 1200);
		}
	}

	function dismissSuggestion(item: SuggestedAction) {
		suggestionsStore.update((v) => v.filter((x) => x !== item));
		if ($suggestionsStore.length <= 1) {
			setTimeout(() => {
				suggestionsStore.set([]);
				suggestionContextStore.set({ dumpId: null });
			}, 1200);
		}
	}

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
	<link rel="icon" href={favicon} />
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
	<meta name="theme-color" content="#faf9f7" />
</svelte:head>

<main class="app-shell">
	<header>
		<h1>Engram</h1>
		<div class="sync-status">{$syncState}{#if $pendingSyncStore}{` · ${$pendingSyncStore} pending`}{/if}</div>
		<nav>
			{#each tabs as tab}
				<a class:active={$page.url.pathname === tab.href} href={tab.href}>{tab.label}</a>
			{/each}
		</nav>
	</header>

	<section class="content">
		{@render children()}
	</section>

	{#if $activeInsightStore}
		<section class="active-insight">
			<span>Active {$activeInsightStore.openCount}</span>
			<span>Overdue {$activeInsightStore.overdueCount}</span>
		</section>
	{/if}

	{#if $transcriptStore}
		{#key $transcriptStore.at}
			<section class="transcript-card" class:shimmering={$parsePhase === 'parsing' || $parsePhase === 'suggesting'}>
				<div class="transcript-meta">{$transcriptStore.source} transcript</div>
				<p>{$transcriptStore.text}</p>
			</section>
		{/key}
	{/if}

	{#if $suggestionsStore.length > 0}
		<section class="suggestions">
			{#each $suggestionsStore as item, index (`${item.action}-${index}`)}
				<SuggestionCard item={item} onAccept={acceptSuggestion} onDismiss={dismissSuggestion} />
			{/each}
		</section>
	{/if}

	<DumpBar />
</main>
