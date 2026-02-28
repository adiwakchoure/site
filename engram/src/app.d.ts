import type { Ai, D1Database } from '@cloudflare/workers-types';

declare global {
	namespace App {
		interface Platform {
			env: {
				DB: D1Database;
				AI?: Ai;
			};
			context: ExecutionContext;
			cf: IncomingRequestCfProperties;
		}
	}
}

export {};
