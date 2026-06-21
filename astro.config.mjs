// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { site } from './site.config.mjs';

// https://astro.build/config
export default defineConfig({
  site: site.origin,
  base: site.base,
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
