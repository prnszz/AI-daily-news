// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://prnszz.github.io',
	base: '/AI-daily-news',
	integrations: [
		starlight({
			title: 'AIトレンド Digest',
			description: 'AI開発、研究、プロダクト、コミュニティの重要トピックを日本語で短く整理するデイリー/ウィークリーDigest。',
			locales: {
				root: {
					label: '日本語',
					lang: 'ja',
				},
			},
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/prnszz/AI-daily-news' }],
			sidebar: [
				{
					label: 'Daily',
					items: [{ autogenerate: { directory: 'daily' } }],
				},
				{
					label: 'Weekly',
					items: [{ autogenerate: { directory: 'weekly' } }],
				},
			],
		}),
	],
});
