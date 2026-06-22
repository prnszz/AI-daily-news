#!/usr/bin/env node

// YouTube publishing assets for the weekly video, from video/data/weekly/<week>.json:
//   out/video/weekly/<week>/chapters.txt      ← paste into the description
//   out/video/weekly/<week>/captions.srt      ← upload as subtitles/CC
//   out/video/weekly/<week>/description.txt    ← description template
//   out/video/weekly/<week>/thumbnail.png      ← a split-scene frame
// Finally deletes public/weekly-assets/<week> — those localized images are now
// baked into the mp4, so they're no longer needed (re-creatable via build-data-weekly).
//
//   pnpm publish-assets-weekly -- --week 2026-w25

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PROJECT, '..');
const KIND = { news: 'News', repo: 'GitHub', paper: 'Paper' };

let week;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
	const a = argv[i];
	if (a.startsWith('--week=')) week = a.slice(7);
	else if (a === '--week') week = argv[++i];
	else if (!a.startsWith('-') && !week) week = a;
}
if (!week) {
	process.stderr.write('Provide --week <YYYY-Www>\n');
	process.exit(1);
}

const dataFile = path.join(PROJECT, 'data', 'weekly', `${week}.json`);
if (!fs.existsSync(dataFile)) {
	process.stderr.write(`Data file missing: ${path.relative(REPO_ROOT, dataFile)}\nRun: pnpm build-data-weekly -- --week ${week}\n`);
	process.exit(1);
}
const d = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const outDir = path.join(REPO_ROOT, 'out', 'video', 'weekly', week);
fs.mkdirSync(outDir, { recursive: true });

const clock = (ms) => {
	const s = Math.floor(ms / 1000);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	return h > 0
		? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
		: `${m}:${String(sec).padStart(2, '0')}`;
};
const srtTime = (ms) => {
	const h = Math.floor(ms / 3600000);
	const m = Math.floor((ms % 3600000) / 60000);
	const s = Math.floor((ms % 60000) / 1000);
	const mm = Math.floor(ms % 1000);
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(mm).padStart(3, '0')}`;
};
const shorten = (s, n = 42) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

// --- chapters ---
const lastEndMs = d.blocks.length ? d.blocks[d.blocks.length - 1].endMs : 0;
const chapterRows = [
	{ ms: 0, label: 'オープニング' },
	...d.blocks.map((b) => ({ ms: b.startMs, label: shorten(b.heading) })),
	{ ms: lastEndMs, label: 'まとめ・エンディング' },
];
const chapters = chapterRows.map((c) => `${clock(c.ms)} ${c.label}`).join('\n');

const warnings = [];
for (let i = 1; i < chapterRows.length; i++) {
	if (chapterRows[i].ms - chapterRows[i - 1].ms < 10000) {
		warnings.push(`  chapter "${chapterRows[i].label}" is <10s after the previous one — YouTube may reject chapters.`);
	}
}

// --- SRT ---
const srt = d.captions.map((c, i) => `${i + 1}\n${srtTime(c.startMs)} --> ${srtTime(c.endMs)}\n${c.text}\n`).join('\n');

// --- description ---
const sources = [...new Set(d.blocks.flatMap((b) => b.sources))];
const description = [
	`${d.brand} — ${d.week} の週次AIまとめ。`,
	'',
	'今週のトピック:',
	...d.blocks.map((b) => `・[${KIND[b.kind] ?? b.kind}] ${b.heading}`),
	'',
	'🔖 チャプター',
	chapters,
	'',
	'📰 ソース',
	...sources.map((s) => `・${s}`),
	'',
	`サイト: ${d.siteUrl}/weekly/${week}/`,
	`X: ${d.xHandle}`,
	'',
	'#AI #AIニュース #生成AI #AIエージェント',
	'',
	'※ナレーションは音声合成（AI音声）で生成しています。',
].join('\n');

fs.writeFileSync(path.join(outDir, 'chapters.txt'), chapters + '\n');
fs.writeFileSync(path.join(outDir, 'captions.srt'), srt);
fs.writeFileSync(path.join(outDir, 'description.txt'), description + '\n');

// --- thumbnail: the branded WeeklyThumbnail cover (no third-party news images) ---
const thumb = path.join(outDir, 'thumbnail.png');
const r = spawnSync('npx', ['remotion', 'still', 'src/index.ts', 'WeeklyThumbnail', thumb, `--props=${dataFile}`], {
	cwd: PROJECT,
	encoding: 'utf8',
});
const thumbNote = r.status === 0 ? path.relative(REPO_ROOT, thumb) : `remotion still failed: ${r.stderr || r.stdout}`;

// --- delete localized images (now baked into the mp4) ---
const imgDir = path.join(REPO_ROOT, 'public', 'weekly-assets', week);
let imgNote = 'no images to delete';
if (fs.existsSync(imgDir)) {
	fs.rmSync(imgDir, { recursive: true, force: true });
	imgNote = `deleted ${path.relative(REPO_ROOT, imgDir)}`;
}

process.stdout.write(
	`Wrote into ${path.relative(REPO_ROOT, outDir)}/ :\n` +
		`  chapters.txt\n` +
		`  captions.srt  (${d.captions.length} cues)\n` +
		`  description.txt\n` +
		`  thumbnail: ${thumbNote}\n` +
		`  images: ${imgNote}\n\n` +
		`--- chapters ---\n${chapters}\n`,
);
if (warnings.length) process.stderr.write(`\nWARNING:\n${warnings.join('\n')}\n`);
