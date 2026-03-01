<script lang="ts">
	import { page } from '$app/stores';
	import favicon from '$lib/assets/favicon.svg';

	const next = $derived($page.url.searchParams.get('next') ?? '/loops');
	const loginHref = $derived(`/api/auth/login?post_login_redirect_url=${encodeURIComponent(next)}`);
	const registerHref = $derived(`/api/auth/register?post_login_redirect_url=${encodeURIComponent(next)}`);
</script>

<svelte:head>
	<title>Sign in | engram</title>
</svelte:head>

<main class="login-wrap">
	<section class="login-card">
		<img src={favicon} alt="engram" class="logo" />
		<h1>engram</h1>
		<p>AI-native loop tracking, now with secure sign-in.</p>

		<div class="actions">
			<a class="primary" href={loginHref}>Continue with Kinde</a>
			<a class="secondary" href={registerHref}>Create account</a>
		</div>
	</section>
</main>

<style>
	.login-wrap {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 24px;
		background: var(--bg);
	}

	.login-card {
		width: min(460px, 100%);
		padding: 28px;
		border: 1px solid var(--line);
		border-radius: var(--radius-lg);
		background: var(--card);
		box-shadow: 0 12px 40px rgba(15, 11, 7, 0.06);
		text-align: center;
		display: grid;
		gap: 12px;
	}

	.logo {
		width: 42px;
		height: 42px;
		margin: 0 auto 6px;
	}

	h1 {
		margin: 0;
		font: 500 30px/1.05 var(--font-serif);
		letter-spacing: -0.01em;
	}

	p {
		margin: 0;
		color: var(--muted);
		font: 400 14px/1.4 var(--font-sans);
	}

	.actions {
		margin-top: 10px;
		display: grid;
		gap: 8px;
	}

	.actions a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
		padding: 10px 14px;
		font: 500 14px/1 var(--font-sans);
		text-decoration: none;
	}

	.primary {
		color: #fff;
		background: #0f0b07;
	}

	.secondary {
		color: var(--ink);
		border: 1px solid var(--line);
		background: transparent;
	}
</style>
