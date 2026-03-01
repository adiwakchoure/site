import { kindeAuthClient, sessionHooks, type SessionManager } from '@kinde-oss/kinde-auth-sveltekit';
import { redirect, type Handle } from '@sveltejs/kit';

const AUTH_ROUTE_PREFIX = '/api/auth';
const LOGIN_ROUTE = '/login';

function isPublicPath(pathname: string): boolean {
	return pathname.startsWith('/_app') || pathname === '/favicon.ico' || pathname === '/manifest.webmanifest' || pathname === LOGIN_ROUTE;
}

export const handle: Handle = async ({ event, resolve }) => {
	await sessionHooks({ event: event as never });

	const pathname = event.url.pathname;
	const isAuthRoute = pathname.startsWith(AUTH_ROUTE_PREFIX);
	const sessionManager = event.request as unknown as SessionManager;

	let isAuthenticated = false;
	try {
		isAuthenticated = await kindeAuthClient.isAuthenticated(sessionManager);
	} catch {
		isAuthenticated = false;
	}

	event.locals.userId = null;
	event.locals.userEmail = null;

	if (isAuthenticated) {
		try {
			const user = await kindeAuthClient.getUser(sessionManager);
			event.locals.userId = user.id ?? null;
			event.locals.userEmail = user.email ?? null;
		} catch {
			// fall through as unauthenticated if profile cannot be loaded
			isAuthenticated = false;
		}
	}

	if (isAuthenticated && pathname === LOGIN_ROUTE) {
		throw redirect(302, '/loops');
	}

	if (!isAuthenticated && !isAuthRoute && !isPublicPath(pathname)) {
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'content-type': 'application/json' }
			});
		}

		const destination = `${pathname}${event.url.search}`;
		throw redirect(302, `/login?next=${encodeURIComponent(destination)}`);
	}

	return resolve(event);
};
