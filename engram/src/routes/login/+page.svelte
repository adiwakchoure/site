<script lang="ts">
	import { page } from '$app/stores';
	import favicon from '$lib/assets/favicon.svg';
	import { siApple, siGoogle, siX } from 'simple-icons';

	const APPLE_CONNECTION_ID = 'conn_019ca7f4f458e63c59ae7601ea0ef7d8';
	const GOOGLE_CONNECTION_ID = 'conn_019ca7f4f4524964a33cda6dff4ab478';
	const X_CONNECTION_ID = 'conn_019ca7f4f4585d8d019cd8dd6b5f9901';

	const next = $derived($page.url.searchParams.get('next') ?? '/loops');

	const appleHref = $derived(`/api/auth/register?connection_id=${APPLE_CONNECTION_ID}&post_login_redirect_url=${encodeURIComponent(next)}`);
	const googleHref = $derived(`/api/auth/register?connection_id=${GOOGLE_CONNECTION_ID}&post_login_redirect_url=${encodeURIComponent(next)}`);
	const xHref = $derived(`/api/auth/register?connection_id=${X_CONNECTION_ID}&post_login_redirect_url=${encodeURIComponent(next)}`);
</script>

<svelte:head>
	<title>Sign in | engram</title>
</svelte:head>

<main class="login-wrap">
	<section class="login-card">
		<img src={favicon} alt="engram" class="logo" />
		<h1>engram</h1>
		<p>Continue with a provider to sign in or create an account.</p>

		<div class="actions">
			<a class="provider" href={googleHref}>
				<svg viewBox="0 0 24 24" aria-hidden="true" class="brand brand-google">
					<path d={siGoogle.path} />
				</svg>
				<span>Continue with Google</span>
			</a>
			<a class="provider" href={appleHref}>
				<svg viewBox="0 0 24 24" aria-hidden="true" class="brand brand-apple">
					<path d={siApple.path} />
				</svg>
				<span>Continue with Apple</span>
			</a>
			<a class="provider" href={xHref}>
				<svg viewBox="0 0 24 24" aria-hidden="true" class="brand brand-x">
					<path d={siX.path} />
				</svg>
				<span>Continue with X</span>
			</a>
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
		gap: 8px;
		border-radius: 12px;
		padding: 10px 14px;
		font: 500 14px/1 var(--font-sans);
		text-decoration: none;
	}

	.provider {
		color: var(--ink);
		border: 1px solid var(--line);
		background: #fff;
	}

	.brand {
		width: 16px;
		height: 16px;
		display: inline-block;
		flex: 0 0 16px;
	}

	.brand-google {
		color: #4285f4;
	}

	.brand-apple,
	.brand-x {
		color: #0f0b07;
	}
</style>
