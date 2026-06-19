import { ACCENTS } from './theme';
import type { DailyDigestProps } from './types';

// Minimal props so `remotion studio` renders without a data file.
// Real renders pass --props=data/<date>.json (see scripts/render.mjs).
export const sampleProps: DailyDigestProps = {
	date: '2026-06-18',
	brand: 'AIトレンド Digest',
	siteUrl: 'https://prnszz.github.io/AI-daily-news',
	xHandle: '@AITLND',
	audioFile: 'audio/daily/2026-06-18.mp3',
	durationInSeconds: 16,
	fps: 30,
	agenda: ['サンプル: 今日の話題その一', 'サンプル: 今日の話題その二', 'サンプル: 今日の話題その三'],
	topics: [
		{
			category: 'Hot',
			heading: 'サンプル見出し: ここに今日のトピックが入ります',
			summary: 'これはStudioプレビュー用のサンプル要約です。実際のデータは build-data で生成されます。',
			sources: ['example.com'],
			accent: ACCENTS[0],
			startMs: 3000,
			endMs: 10000,
		},
	],
	captions: [
		{ text: 'これはサンプル字幕です', startMs: 500, endMs: 3000 },
		{ text: 'Whisperで音声に合わせて生成されます', startMs: 3000, endMs: 8000 },
	],
};
