import { handleAuth } from '@kinde-oss/kinde-auth-sveltekit';
import type { RequestEvent } from './$types';

export function GET(event: RequestEvent) {
	return handleAuth(event);
}
