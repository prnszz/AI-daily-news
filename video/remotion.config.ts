import { Config } from '@remotion/cli/config';

// Slides/audio live in the Astro site's public/ folder; point Remotion's
// staticFile() resolver there so we don't duplicate the audio.
Config.setPublicDir('../public');
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
