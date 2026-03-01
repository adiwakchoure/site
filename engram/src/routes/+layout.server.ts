import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: {
			id: locals.userId,
			email: locals.userEmail
		}
	};
};
