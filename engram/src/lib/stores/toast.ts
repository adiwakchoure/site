import { writable } from 'svelte/store';

export const toastMessage = writable<string | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, duration = 2200) {
	if (timer) clearTimeout(timer);
	toastMessage.set(message);
	timer = setTimeout(() => {
		toastMessage.set(null);
	}, duration);
}
