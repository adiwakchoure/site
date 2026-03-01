export function uid(prefix = 'id') {
	return `${prefix}_${crypto.randomUUID()}`;
}

export function ageInDays(iso: string) {
	const ms = Date.now() - new Date(iso).getTime();
	return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function isOverdue(deadline: string | null, closedAt: string | null) {
	if (!deadline || closedAt) return false;
	return new Date(deadline).getTime() < Date.now();
}

export function haptic(pattern: number | number[]) {
	if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
}
