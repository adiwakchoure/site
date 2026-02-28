import type { D1Database } from '@cloudflare/workers-types';

declare global {
	namespace App {
		interface Platform {
			env: {
				DB: D1Database;
				GROQ_API_KEY?: string;
			};
			context: ExecutionContext;
			cf: IncomingRequestCfProperties;
		}
	}
}

export {};
