import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

// Standard Starlight content collection. Tracking it explicitly makes
// `getCollection('docs')` reliable for the auto-generated homepage and gives us
// a place to extend the schema (custom frontmatter validation) later.
export const collections = {
	docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
};
