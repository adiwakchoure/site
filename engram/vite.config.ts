import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		SvelteKitPWA({
			strategies: 'generateSW',
			registerType: 'autoUpdate',
			manifest: {
				name: 'Engram',
				short_name: 'Engram',
				description: 'Commitment tracker that reflects your patterns.',
				theme_color: '#faf9f7',
				background_color: '#faf9f7',
				display: 'standalone',
				start_url: '/threads',
				icons: [{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
			},
			devOptions: {
				enabled: true
			}
		}),
		sveltekit()
	]
});
