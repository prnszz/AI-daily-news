#!/usr/bin/env node

// Generates YouTube publishing assets from video/data/<date>.json:
//   out/video/daily/<date>.chapters.txt      ← paste into the description (chapters)
//   out/video/daily/<date>.srt               ← upload as subtitles/CC (accurate, from the 台本)
//   out/video/daily/<date>.description.txt    ← description template
//   out/video/daily/<date>.thumb.png          ← 1280x720 baseline thumbnail (cover frame)

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PROJECT, '..');

const date = process.argv.slice(2).find((a) => !a.startsWith('-')) ?? process.argv.slice(2).find((a) => /^--date=/.test(a))?.slice(7);
const dateArg = process.argv.includes('--date') ? process.argv[process.argv.indexOf('--date') + 1] : date;
if (!dateArg) {
	process.stderr.write('Provide --date <YYYY-MM-DD>\n');
	process.exit(1);
}

const dataFile = path.join(PROJECT, 'data', `${dateArg}.json`);
if (!fs.existsSync(dataFile)) {
	process.stderr.write(`Data file missing: ${dataFile}\nRun: pnpm build-data -- --date ${dateArg}\n`);
	process.exit(1);
}
const d = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const outDir = path.join(REPO_ROOT, 'out', 'video', 'daily');
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
const lastEndMs = d.topics.length ? d.topics[d.topics.length - 1].endMs : 0;
const chapterRows = [
	{ ms: 0, label: 'オープニング' },
	...d.topics.map((t) => ({ ms: t.startMs, label: shorten(t.heading) })),
	{ ms: lastEndMs, label: 'まとめ・エンディング' },
];
const chapters = chapterRows.map((c) => `${clock(c.ms)} ${c.label}`).join('\n');

// YouTube rule: each chapter must be >= 10s. Warn if any segment is too short.
const warnings = [];
for (let i = 1; i < chapterRows.length; i++) {
	if (chapterRows[i].ms - chapterRows[i - 1].ms < 10000) {
		warnings.push(`  chapter "${chapterRows[i].label}" is <10s after the previous one — YouTube may reject chapters.`);
	}
}

// --- SRT ---
const srt = d.captions
	.map((c, i) => `${i + 1}\n${srtTime(c.startMs)} --> ${srtTime(c.endMs)}\n${c.text}\n`)
	.join('\n');

// --- description template ---
const sources = [...new Set(d.topics.flatMap((t) => t.sources))];
const description = [
	`${d.brand} — ${d.date} のAIニュースまとめ。`,
	'',
	'今日のトピック:',
	...d.topics.map((t) => `・[${t.category}] ${t.heading}`),
	'',
	'🔖 チャプター',
	chapters,
	'',
	'📰 ソース',
	...sources.map((s) => `・${s}`),
	'',
	`サイト: ${d.siteUrl}`,
	`X: ${d.xHandle}`,
	'',
	'#AI #AIニュース #生成AI #AItrends',
	'',
	'※ナレーションは音声合成（AI音声）で生成しています。',
].join('\n');

fs.writeFileSync(path.join(outDir, `${dateArg}.chapters.txt`), chapters + '\n');
fs.writeFileSync(path.join(outDir, `${dateArg}.srt`), srt);
fs.writeFileSync(path.join(outDir, `${dateArg}.description.txt`), description + '\n');

// --- thumbnail: render the dedicated Thumbnail composition (1280x720) ---
const thumb = path.join(outDir, `${dateArg}.thumb.png`);
const r = spawnSync('npx', ['remotion', 'still', 'src/index.ts', 'Thumbnail', thumb, `--props=${dataFile}`], {
	cwd: PROJECT,
	encoding: 'utf8',
});
const thumbNote = r.status === 0 ? path.relative(REPO_ROOT, thumb) : `remotion still failed: ${r.stderr || r.stdout}`;

process.stdout.write(
	`Wrote:\n` +
		`  ${path.relative(REPO_ROOT, path.join(outDir, `${dateArg}.chapters.txt`))}\n` +
		`  ${path.relative(REPO_ROOT, path.join(outDir, `${dateArg}.srt`))}  (${d.captions.length} cues)\n` +
		`  ${path.relative(REPO_ROOT, path.join(outDir, `${dateArg}.description.txt`))}\n` +
		`  thumbnail: ${thumbNote}\n\n` +
		`--- chapters ---\n${chapters}\n`,
);
if (warnings.length) process.stderr.write(`\nWARNING:\n${warnings.join('\n')}\n`);
