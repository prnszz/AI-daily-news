import { ACCENTS } from './theme';
import type { DailyDigestProps, WeeklyDigestProps } from './types';

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

// Weekly Studio preview. Real renders pass --props=data/weekly/<week>.json.
// Placeholder image uses favicon.svg; real renders use locally-downloaded images.
export const weeklySampleProps: WeeklyDigestProps = {
	week: '2026-W25',
	theme: '買収・人材流出・オープンモデル',
	brand: 'AIトレンド Digest',
	siteUrl: 'https://prnszz.github.io/AI-daily-news',
	xHandle: '@AITLND',
	audioFile: 'audio/daily/2026-06-18.mp3',
	durationInSeconds: 30,
	fps: 30,
	blocks: [
		{
			kind: 'news',
			label: 'ニュース 1 / 5',
			heading: 'SpaceXがCursor開発元Anysphereの買収を発表した',
			summary: '広く使われているコーディングエージェントの一つが大手の傘下に入り、開発ツールの勢力図に影響しうる。',
			image: 'favicon.svg',
			sources: ['x.com'],
			accent: ACCENTS[0],
			startMs: 3000,
			endMs: 9000,
		},
		{
			kind: 'repo',
			label: 'GitHub',
			heading: 'chopratejas/headroom',
			summary: 'ツール出力やログをLLMに渡す前に圧縮し、トークンを60〜95%削減するコンテキスト圧縮層。',
			image: 'favicon.svg',
			sources: ['github.com'],
			accent: ACCENTS[1],
			startMs: 9000,
			endMs: 15000,
		},
		{
			kind: 'paper',
			label: '論文',
			heading: 'SABER: コーディングエージェントの運用上の安全性を測る',
			summary: '操作後の最終的な環境状態で安全性を評価。最良のモデルでも有害な違反率は54%を超えた。',
			image: 'favicon.svg',
			sources: ['arxiv.org'],
			accent: ACCENTS[2],
			startMs: 15000,
			endMs: 21000,
		},
	],
	captions: [{ text: 'これはサンプル字幕です', startMs: 500, endMs: 3000 }],
};
