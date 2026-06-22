#!/usr/bin/env node

// Builds video/data/weekly/<week>.json — the JSON that drives the WeeklyDigest
// render. Parses the published Weekly page into news/repo/paper blocks, downloads
// each block's image locally (so renders never depend on a live hotlink), and
// borrows timing from Whisper word-timestamps (forced alignment, shared with the
// daily build via lib/align). Anchors in the weekly podcast frontmatter pin each
// block to where it's introduced in the narration.
//
//   pnpm build-data-weekly -- --week 2026-w25
//   pnpm build-data-weekly -- --week 2026-w25 --no-whisper   # proportional timing
//   pnpm build-data-weekly -- --week 2026-w25 --force

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadDotEnv, parseFrontmatter, extractScript } from '../../lib/md.mjs';
import { site } from '../../site.config.mjs';
import {
	domainOf,
	ffprobeDuration,
	cachedWhisperWords,
	whisperCharStream,
	scriptCharStream,
	lcsAnchors,
	makeCharTime,
	chunkScript,
	forcedCaptions,
} from '../../lib/align.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(VIDEO_DIR, '..');
const DATA_DIR = path.join(VIDEO_DIR, 'data', 'weekly');
const WHISPER_CACHE_DIR = path.join(VIDEO_DIR, 'data', '.whisper-cache');
// Remotion's publicDir is ../public (repo-root public/), per video/remotion.config.ts,
// so localized images must land there for staticFile() to resolve them.
const PUBLIC_DIR = path.join(REPO_ROOT, 'public');

const FPS = 30;
const ACCENTS = ['#2dd4bf', '#67e8f9', '#a3e635'];
const MIN_GAP_MS = 3000;
const SECTION_KIND = { ニュース: 'news', 注目リポジトリ: 'repo', 論文ピックアップ: 'paper' };
const KIND_DEFAULT_LABEL = { news: 'ニュース', repo: 'GitHub', paper: '論文' };

function parseArgs(argv) {
	const o = { week: undefined, whisper: true, cache: true, force: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--') continue;
		else if (a === '--force') o.force = true;
		else if (a === '--no-whisper') o.whisper = false;
		else if (a === '--no-cache') o.cache = false;
		else if (a.startsWith('--week=')) o.week = a.slice(7);
		else if (a === '--week') o.week = argv[++i];
		else if (!a.startsWith('--') && !o.week) o.week = a;
	}
	return o;
}

const firstSentence = (s) => {
	const i = s.indexOf('。');
	return i >= 0 ? s.slice(0, i + 1) : s;
};

// Parse the Weekly page body into ordered blocks (news / repo / paper).
function parseWeekly(body) {
	const blocks = [];
	let section = null;
	let cur = null;
	const flush = () => {
		if (cur) {
			cur.summary = cur.summary.trim();
			blocks.push(cur);
			cur = null;
		}
	};
	for (const line of body.split(/\r?\n/)) {
		const t = line.trim();
		if (t.startsWith('## ')) {
			flush();
			section = t.slice(3).trim();
		} else if (t.startsWith('### ')) {
			flush();
			const kind = SECTION_KIND[section];
			if (kind) cur = { kind, headingRaw: t.slice(4).trim(), summary: '', imageUrl: null, sources: [] };
		} else if (cur) {
			const img = t.match(/!\[[^\]]*\]\(([^)]+)\)/);
			if (img) {
				if (!cur.imageUrl) cur.imageUrl = img[1];
			} else if (t.startsWith('>')) {
				const m = t.match(/https?:\/\/[^\s]+/);
				if (m) cur.sources.push(domainOf(m[0]));
			} else if (!t.startsWith('<') && t) {
				cur.summary += (cur.summary ? ' ' : '') + t;
			}
		}
	}
	flush();
	return blocks;
}

function cleanHeading(kind, raw) {
	if (kind === 'news') return raw.replace(/^\d+[.．]\s*/, '');
	if (kind === 'repo') return raw.split(/\s+—\s+/)[0].trim(); // drop "— ⭐ …・lang"
	return raw;
}

// Download a remote image into public/weekly-assets/<week>/ so the render uses a
// local file. Returns the staticFile-relative path, or null on failure.
async function localizeImage(url, week, name) {
	try {
		const res = await fetch(url, { redirect: 'follow' });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const ct = (res.headers.get('content-type') || '').toLowerCase();
		const ext = ct.includes('svg') ? 'svg' : ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg';
		const buf = Buffer.from(await res.arrayBuffer());
		const destDir = path.join(PUBLIC_DIR, 'weekly-assets', week);
		fs.mkdirSync(destDir, { recursive: true });
		fs.writeFileSync(path.join(destDir, `${name}.${ext}`), buf);
		return `weekly-assets/${week}/${name}.${ext}`;
	} catch (e) {
		process.stderr.write(`  ! image download failed (${name}): ${e.message} — using placeholder\n`);
		return null;
	}
}

// Pin each block to where it's introduced, then order by spoken time.
function anchorBlocks(blocks, cp, charTime, durationMs, blockAnchors) {
	const lower = cp.join('').toLowerCase();
	const n = blocks.length;
	// lastIndexOf: the weekly opener also contains 「週次まとめ」, so the outro
	// marker must be the FINAL 「まとめ」 (今週のまとめです), not the first.
	const matomeIdx = lower.lastIndexOf('まとめ');
	const outroStartMs = matomeIdx >= 0 ? Math.round(charTime(matomeIdx)) : Math.round(durationMs * 0.92);
	const chunks = chunkScript(cp);
	const snap = (idx) => {
		let best = 0;
		for (const c of chunks) {
			if (c.start <= idx) best = c.start;
			else break;
		}
		return best;
	};

	const posIdx = new Array(n).fill(null);
	let anchored = 0;
	if (Array.isArray(blockAnchors)) {
		for (const a of blockAnchors) {
			const sep = String(a).indexOf('::');
			if (sep < 0) continue;
			const key = a.slice(0, sep).trim().toLowerCase();
			const cue = a.slice(sep + 2).trim().toLowerCase();
			if (!key || !cue) continue;
			const matches = [...blocks.keys()].filter(
				(i) => blocks[i].heading.toLowerCase().includes(key) || blocks[i].headingRaw.toLowerCase().includes(key),
			);
			if (matches.length !== 1) {
				process.stderr.write(`  ! anchor key "${key}" matched ${matches.length} blocks — ignored\n`);
				continue;
			}
			const at = lower.indexOf(cue);
			if (at < 0) {
				process.stderr.write(`  ! anchor cue not found in script: "${cue.slice(0, 24)}…" — ignored\n`);
				continue;
			}
			posIdx[matches[0]] = snap(at);
			anchored++;
		}
	}
	// Fallback: spread any unanchored block proportionally in page order.
	for (let i = 0; i < n; i++) if (posIdx[i] == null) posIdx[i] = Math.round((cp.length * (i + 0.5)) / n);

	const order = [...blocks.keys()].sort((a, b) => posIdx[a] - posIdx[b]);
	const ordered = order.map((i) => blocks[i]);
	const ms = order.map((i) => Math.round(charTime(posIdx[i])));
	for (let i = 0; i < n; i++) {
		const floor = i > 0 ? ms[i - 1] + MIN_GAP_MS : 0;
		ms[i] = Math.min(Math.max(ms[i], floor), outroStartMs - (n - i) * MIN_GAP_MS);
	}
	for (let i = 1; i < n; i++) if (ms[i] <= ms[i - 1]) ms[i] = ms[i - 1] + MIN_GAP_MS;

	const list = ordered.map((b, i) => ({
		kind: b.kind,
		label: b.label,
		heading: b.heading,
		summary: firstSentence(b.summary),
		image: b.image,
		sources: [...new Set(b.sources)].slice(0, 2),
		accent: ACCENTS[i % ACCENTS.length],
		startMs: ms[i],
		endMs: i < n - 1 ? ms[i + 1] : outroStartMs,
	}));
	return { list, anchored, outroStartMs };
}

async function main() {
	const opts = parseArgs(process.argv.slice(2));
	if (!opts.week) throw new Error('Provide --week <YYYY-Www> (e.g. 2026-w25)');
	loadDotEnv(path.join(REPO_ROOT, '.env'));

	const inputPath = path.join(REPO_ROOT, `platforms/podcast/weekly/${opts.week}.md`);
	if (!fs.existsSync(inputPath)) throw new Error(`Weekly podcast not found: ${inputPath}`);
	const podcast = parseFrontmatter(fs.readFileSync(inputPath, 'utf8'));
	const scriptClean = extractScript(podcast.body).replace(/\s+/g, ' ').trim();
	const cp = [...scriptClean];

	const sourcePath = path.join(REPO_ROOT, `src/content/docs/weekly/${opts.week}.md`);
	if (!fs.existsSync(sourcePath)) throw new Error(`Weekly page not found: ${sourcePath}`);
	const rawBlocks = parseWeekly(parseFrontmatter(fs.readFileSync(sourcePath, 'utf8')).body);
	if (!rawBlocks.length) throw new Error(`No blocks parsed from ${sourcePath}`);

	// Labels (news numbered N / total) + clean headings.
	const newsTotal = rawBlocks.filter((b) => b.kind === 'news').length;
	let newsIdx = 0;
	for (const b of rawBlocks) {
		b.heading = cleanHeading(b.kind, b.headingRaw);
		b.label = b.kind === 'news' ? `ニュース ${++newsIdx} / ${newsTotal}` : KIND_DEFAULT_LABEL[b.kind];
	}

	// Localize images (parallel); fall back to favicon.svg on failure.
	await Promise.all(
		rawBlocks.map(async (b, i) => {
			const local = b.imageUrl ? await localizeImage(b.imageUrl, opts.week, `${b.kind}-${i + 1}`) : null;
			b.image = local ?? 'favicon.svg';
		}),
	);

	const audioRel = `audio/weekly/${opts.week}.mp3`;
	const audioPath = path.join(REPO_ROOT, 'public', audioRel);
	if (!fs.existsSync(audioPath)) throw new Error(`Audio not found: ${audioPath} (run pnpm podcast:audio first)`);

	const outFile = path.join(DATA_DIR, `${opts.week}.json`);
	if (fs.existsSync(outFile) && !opts.force) throw new Error(`Data exists: ${outFile}. Use --force.`);

	const durationSec = ffprobeDuration(audioPath);
	const durationMs = Math.round(durationSec * 1000);

	let charTime;
	let timingMode;
	if (opts.whisper) {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) throw new Error('OPENAI_API_KEY missing (add to .env) or pass --no-whisper.');
		const words = await cachedWhisperWords(audioPath, apiKey, { useCache: opts.cache, cacheDir: WHISPER_CACHE_DIR });
		const anchors = words.length ? lcsAnchors(scriptCharStream(cp), whisperCharStream(words)) : [];
		charTime = makeCharTime(anchors, cp.length, durationMs);
		timingMode = anchors.length ? `forced-alignment (${anchors.length} anchors)` : 'proportional (no anchors)';
	} else {
		charTime = (idx) => (durationMs * idx) / Math.max(1, cp.length);
		timingMode = 'proportional (--no-whisper)';
	}

	const captions = forcedCaptions(cp, charTime, durationMs);
	const { list: blocks, anchored } = anchorBlocks(rawBlocks, cp, charTime, durationMs, podcast.data.anchors);

	const data = {
		week: opts.week.toUpperCase(),
		theme: podcast.data.theme ?? '',
		brand: site.brand,
		siteUrl: site.baseUrl,
		xHandle: site.xHandle,
		audioFile: audioRel,
		durationInSeconds: durationSec,
		fps: FPS,
		blocks,
		captions,
	};

	fs.mkdirSync(DATA_DIR, { recursive: true });
	fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
	const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
	process.stdout.write(
		`Wrote ${path.relative(REPO_ROOT, outFile)}\n` +
			`  duration: ${durationSec.toFixed(1)}s  blocks: ${blocks.length} (${anchored} anchored)  captions: ${captions.length}\n` +
			`  timing: ${timingMode}\n` +
			`  images: ${blocks.filter((b) => b.image !== 'favicon.svg').length}/${blocks.length} localized\n`,
	);
	process.stdout.write('  blocks (spoken order):\n');
	for (const b of blocks) process.stdout.write(`    ${mmss(b.startMs).padStart(5)}  [${b.label}] ${b.heading}\n`);
}

main().catch((e) => {
	process.stderr.write(`${e.message}\n`);
	process.exit(1);
});
