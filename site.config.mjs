// Single source of truth for brand + URLs. Consumed by astro.config.mjs (site
// metadata + social links) and the video build (video/scripts/build-data.mjs).
// Keep dependency-free so the isolated video package can import it directly.
export const site = {
	brand: 'AIトレンド Digest',
	description:
		'AI開発、研究、プロダクト、コミュニティの重要トピックを日本語で短く整理するデイリー/ウィークリーDigest。',
	origin: 'https://prnszz.github.io', // Astro `site`
	base: '/AI-daily-news', // Astro `base`
	baseUrl: 'https://prnszz.github.io/AI-daily-news', // origin + base (used in the video)
	xHandle: '@AITLND',
	xUrl: 'https://x.com/AITLND',
	youtubeUrl: 'https://www.youtube.com/@AITLND',
	githubUrl: 'https://github.com/prnszz/AI-daily-news',
};
