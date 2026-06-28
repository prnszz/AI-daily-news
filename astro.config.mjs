// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { site } from './site.config.mjs';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Build a sidebar group from the files in a docs subdirectory, newest-first by
// filename — so Daily/Weekly order is derived automatically and no page needs a
// hand-written `sidebar.order`. The slug IS the human label (Daily "2026-06-28",
// Weekly "2026-0622-0628"), so the nav reads as a date with no formatting.
function archiveItems(dir) {
  const abs = fileURLToPath(new URL(`./src/content/docs/${dir}`, import.meta.url));
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => f.replace(/\.mdx?$/, ''))
    .sort()
    .reverse()
    .map((slug) => ({ label: slug, link: `/${dir}/${slug}/` }));
}

// Newest Daily page. The homepage hero points at a fixed "/daily/latest" URL
// that redirects here, so the hero never needs a manual date edit.
const latestDaily = archiveItems('daily')[0]?.link;

// https://astro.build/config
export default defineConfig({
  site: site.origin,
  base: site.base,
  // Astro doesn't prefix the base onto redirect targets, so add it here.
  redirects: latestDaily ? { '/daily/latest': `${site.base}${latestDaily}` } : {},
  integrations: [
    starlight({
      title: site.brand,
      description: site.description,
      locales: {
        root: {
          label: '日本語',
          lang: 'ja',
        },
      },
      social: [
        { icon: 'github', label: 'GitHub', href: site.githubUrl },
        { icon: 'x.com', label: 'X', href: site.xUrl },
        {
          icon: 'youtube',
          label: 'YouTube',
          href: site.youtubeUrl,
        },
      ],
      sidebar: [
        { label: 'Daily', items: archiveItems('daily') },
        { label: 'Weekly', items: archiveItems('weekly') },
      ],
    }),
  ],
});
