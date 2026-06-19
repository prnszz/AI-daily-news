#!/usr/bin/env node

// Builds video/data/<date>.json — the single JSON that drives the Remotion
// render.
//
// Captions use FORCED ALIGNMENT: we keep the exact台本 (script) text and borrow
// only the *timing* from Whisper. Whisper word timestamps are aligned to the
// known script via an LCS so every caption shows the correct words at the moment
// they are actually spoken — Whisper mis-recognitions (agent→エージャント etc.)
// never reach the screen. Topic cards are anchored by locating each topic's
// keyword in the clean script and mapping that position onto the same timeline.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.resolve(__dirname, '..', 'data');

const BRAND = 'AIトレンド Digest';
const SITE_URL = 'https://prnszz.github.io/AI-daily-news';
const X_HANDLE = '@AITLND';
const FPS = 30;
const ACCENTS = ['#2dd4bf', '#67e8f9', '#a3e635'];
const MIN_GAP_MS = 4000;
// Generic tokens that appear in many headings/the intro; never anchor on these.
const STOP_TOKENS = new Set([
	'ai', 'api', 'llm', 'ml', 'gpt', 'app', 'apps', 'the', 'and', 'for', 'ios', 'ui', 'os',
	'one', 'sdk', 'agent', 'agents', 'framework', 'video', 'data', 'model', 'models', 'tasks', 'stack',
]);

function usage() {
	return `Usage:
  pnpm build-data -- --date 2026-06-18
  pnpm build-data -- --date 2026-06-18 --force
  pnpm build-data -- --date 2026-06-18 --no-whisper   # proportional timing, no API call

Options:
  --date <YYYY-MM-DD>   Build data for this day.
  --input <path>        Podcast Markdown (default: platforms/podcast/daily/<date>.md).
  --audio <path>        Narration MP3 (default: frontmatter audio: or public/audio/daily/<date>.mp3).
  --no-whisper          Skip Whisper; time the script proportionally by character.
  --force               Overwrite an existing data file.
  --help
`;
}

function parseArgs(argv) {
	const o = { date: undefined, input: undefined, audio: undefined, whisper: true, force: false, help: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--') continue;
		else if (a === '--help' || a === '-h') o.help = true;
		else if (a === '--force') o.force = true;
		else if (a === '--no-whisper') o.whisper = false;
		else if (a.startsWith('--date=')) o.date = a.slice(7);
		else if (a === '--date') o.date = argv[++i];
		else if (a.startsWith('--input=')) o.input = a.slice(8);
		else if (a === '--input') o.input = argv[++i];
		else if (a.startsWith('--audio=')) o.audio = a.slice(8);
		else if (a === '--audio') o.audio = argv[++i];
		else if (!a.startsWith('--') && !o.date) o.date = a;
		else throw new Error(`Unknown argument: ${a}`);
	}
	return o;
}

// --- tiny .env + frontmatter parsers (same conventions as the audio script) ---

function loadDotEnv(envPath) {
	if (!fs.existsSync(envPath)) return;
	for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
		const t = line.trim();
		if (!t || t.startsWith('#')) continue;
		const eq = t.indexOf('=');
		if (eq === -1) continue;
		const k = t.slice(0, eq).trim();
		let v = t.slice(eq + 1).trim();
		if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
		if (k && process.env[k] === undefined) process.env[k] = v;
	}
}

function parseFrontmatter(md) {
	if (!md.startsWith('---\n') && !md.startsWith('---\r\n')) return { data: {}, body: md };
	const nl = md.startsWith('---\r\n') ? '\r\n' : '\n';
	const marker = `${nl}---${nl}`;
	const end = md.indexOf(marker, 3);
	if (end === -1) throw new Error('Unterminated frontmatter');
	const data = {};
	for (const line of md.slice(4, end).split(/\r?\n/)) {
		const t = line.trim();
		if (!t || t.startsWith('#')) continue;
		const c = t.indexOf(':');
		if (c === -1) continue;
		let v = t.slice(c + 1).trim();
		if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
		data[t.slice(0, c).trim()] = v;
	}
	return { data, body: md.slice(end + marker.length) };
}

function extractScript(body) {
	const m = body.match(/^## Script\s*$/m);
	if (!m) throw new Error('Podcast Markdown must contain a "## Script" heading');
	return body.slice(m.index + m[0].length).trim();
}

function domainOf(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

function parseDaily(body) {
	const agenda = [];
	const topics = [];
	let section = null;
	let topic = null;
	const flush = () => {
		if (topic) {
			topic.summary = topic.summary.trim();
			topics.push(topic);
			topic = null;
		}
	};
	for (const line of body.split(/\r?\n/)) {
		const t = line.trim();
		if (t.startsWith('## ')) {
			flush();
			section = t.slice(3).trim();
		} else if (t.startsWith('### ')) {
			flush();
			if (section && section !== '今日の話題' && section !== '音声版') {
				topic = { category: section, heading: t.slice(4).trim(), summary: '', sources: [] };
			}
		} else if (section === '今日の話題' && t.startsWith('- ')) {
			agenda.push(t.slice(2).trim());
		} else if (topic) {
			if (t.startsWith('>')) {
				const m = t.match(/https?:\/\/[^\s]+/);
				if (m) topic.sources.push(domainOf(m[0]));
			} else if (!t.startsWith('<') && t) {
				topic.summary += (topic.summary ? ' ' : '') + t;
			}
		}
	}
	flush();
	return { agenda, topics };
}

function ffprobeDuration(audioPath) {
	const r = spawnSync(
		'ffprobe',
		['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioPath],
		{ encoding: 'utf8' },
	);
	if (r.status !== 0) throw new Error(`ffprobe failed: ${r.stderr || r.error}`);
	const d = parseFloat(String(r.stdout).trim());
	if (!Number.isFinite(d) || d <= 0) throw new Error(`Bad audio duration from ${audioPath}`);
	return d;
}

async function whisperWords(audioPath, apiKey) {
	const buf = fs.readFileSync(audioPath);
	const form = new FormData();
	form.append('file', new Blob([buf]), path.basename(audioPath));
	form.append('model', 'whisper-1');
	form.append('language', 'ja');
	form.append('response_format', 'verbose_json');
	form.append('timestamp_granularities[]', 'word');
	form.append('timestamp_granularities[]', 'segment');
	const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
		method: 'POST',
		headers: { Authorization: `Bearer ${apiKey}` },
		body: form,
	});
	if (!res.ok) throw new Error(`Whisper failed: ${res.status} ${res.statusText}\n${await res.text()}`);
	const json = await res.json();
	return Array.isArray(json.words) ? json.words : [];
}

// --- forced alignment ---------------------------------------------------------

// Per-character timeline from Whisper words: each word's characters get times
// spread across the word's [start,end] span.
function whisperCharStream(words) {
	const out = [];
	for (const w of words) {
		const text = String(w.word || '').replace(/\s+/g, '');
		if (!text || !Number.isFinite(w.start) || !Number.isFinite(w.end)) continue;
		const start = w.start * 1000;
		const span = Math.max(0, w.end * 1000 - start);
		const chars = [...text];
		chars.forEach((ch, k) => out.push({ ch: ch.toLowerCase(), t: start + (span * (k + 0.5)) / chars.length }));
	}
	return out;
}

// Non-space characters of the script, remembering their index in `cp`.
function scriptCharStream(cp) {
	const out = [];
	for (let i = 0; i < cp.length; i++) {
		if (!/\s/.test(cp[i])) out.push({ ch: cp[i].toLowerCase(), origIdx: i });
	}
	return out;
}

// Longest common subsequence → matched (scriptIdx, timeMs) anchor pairs.
function lcsAnchors(scriptChars, whisperChars) {
	const n = scriptChars.length;
	const m = whisperChars.length;
	if (!n || !m || n * m > 12_000_000) return [];
	const w = m + 1;
	const dp = new Uint16Array((n + 1) * w);
	for (let i = 1; i <= n; i++) {
		const ai = scriptChars[i - 1].ch;
		const row = i * w;
		const prev = (i - 1) * w;
		for (let j = 1; j <= m; j++) {
			if (ai === whisperChars[j - 1].ch) dp[row + j] = dp[prev + j - 1] + 1;
			else {
				const up = dp[prev + j];
				const left = dp[row + j - 1];
				dp[row + j] = up >= left ? up : left;
			}
		}
	}
	const anchors = [];
	let i = n;
	let j = m;
	while (i > 0 && j > 0) {
		if (scriptChars[i - 1].ch === whisperChars[j - 1].ch) {
			anchors.push({ i: scriptChars[i - 1].origIdx, t: whisperChars[j - 1].t });
			i--;
			j--;
		} else if (dp[(i - 1) * w + j] >= dp[i * w + (j - 1)]) i--;
		else j--;
	}
	anchors.reverse();
	for (let k = 1; k < anchors.length; k++) if (anchors[k].t < anchors[k - 1].t) anchors[k].t = anchors[k - 1].t;
	return anchors;
}

// Build idx→ms lookup by interpolating between anchors (endpoints pinned).
function makeCharTime(anchors, cpLen, durationMs) {
	if (!anchors.length) return (idx) => (durationMs * idx) / Math.max(1, cpLen);
	const pts = [{ i: 0, t: 0 }, ...anchors, { i: cpLen, t: durationMs }];
	return (idx) => {
		if (idx <= pts[0].i) return pts[0].t;
		if (idx >= pts[pts.length - 1].i) return pts[pts.length - 1].t;
		let lo = 0;
		let hi = pts.length - 1;
		while (lo < hi - 1) {
			const mid = (lo + hi) >> 1;
			if (pts[mid].i <= idx) lo = mid;
			else hi = mid;
		}
		const a = pts[lo];
		const b = pts[hi];
		return b.i === a.i ? a.t : a.t + ((b.t - a.t) * (idx - a.i)) / (b.i - a.i);
	};
}

// Split the script into readable caption lines, keeping char indices into `cp`.
function chunkScript(cp) {
	const chunks = [];
	let start = 0;
	let len = 0;
	for (let i = 0; i < cp.length; i++) {
		len++;
		const hard = /[。！？]/.test(cp[i]);
		const soft = /[、]/.test(cp[i]) && len >= 18;
		if (hard || soft) {
			chunks.push({ start, end: i + 1 });
			start = i + 1;
			len = 0;
		}
	}
	if (start < cp.length) chunks.push({ start, end: cp.length });
	return chunks.filter((c) => cp.slice(c.start, c.end).join('').trim());
}

function forcedCaptions(cp, charTime, durationMs) {
	const chunks = chunkScript(cp);
	const starts = chunks.map((c) => {
		let s = c.start;
		while (s < c.end && /\s/.test(cp[s])) s++;
		return Math.max(0, Math.round(charTime(s)));
	});
	return chunks
		.map((c, i) => ({
			text: cp.slice(c.start, c.end).join('').trim(),
			startMs: starts[i],
			endMs: i < chunks.length - 1 ? Math.max(starts[i] + 200, starts[i + 1]) : Math.round(durationMs),
		}))
		.filter((c) => c.text);
}

// Anchor each topic to where it is spoken, then ORDER cards by spoken time.
// The published Markdown may list topics in a different order than the
// narration (e.g. by category), so we must not assume the two orders match.
function anchorTopics(topics, cp, charTime, durationMs) {
	const lower = cp.join('').toLowerCase();
	const n = topics.length;
	const matomeIdx = lower.indexOf('まとめ');
	const outroStartMs = matomeIdx >= 0 ? Math.round(charTime(matomeIdx)) : Math.round(durationMs * 0.9);
	const lastBodyIdx = matomeIdx >= 0 ? matomeIdx : cp.length;

	const occurrences = (k) => {
		let c = 0;
		let i = 0;
		while ((i = lower.indexOf(k, i)) >= 0) {
			c++;
			i += k.length;
		}
		return c;
	};

	// 1) For each topic, pick its MOST distinctive keyword (rarest, then longest)
	//    and take that keyword's position anywhere in the script.
	const charPos = topics.map((t) => {
		const cands = (t.heading.match(/[A-Za-z0-9][A-Za-z0-9.\-]{1,}/g) || [])
			.map((k) => k.toLowerCase())
			.filter((k) => !STOP_TOKENS.has(k))
			.map((k) => ({ k, f: occurrences(k) }))
			.filter((x) => x.f > 0);
		if (!cands.length) return null;
		cands.sort((a, b) => a.f - b.f || b.k.length - a.k.length);
		return lower.indexOf(cands[0].k);
	});

	// 2) Fill any topic without a findable keyword by interpolating between its
	//    Markdown neighbours (rare; keeps it in a sensible spot).
	for (let i = 0; i < n; i++) {
		if (charPos[i] == null) {
			const prev = i > 0 && charPos[i - 1] != null ? charPos[i - 1] : 0;
			let j = i + 1;
			while (j < n && charPos[j] == null) j++;
			const next = j < n && charPos[j] != null ? charPos[j] : lastBodyIdx;
			charPos[i] = Math.round(prev + (next - prev) / (j - i + 1));
		}
	}

	// 3) Reorder cards by spoken position (narration order, NOT Markdown order).
	const order = [...topics.keys()].sort((a, b) => charPos[a] - charPos[b]);
	const ordered = order.map((idx) => topics[idx]);
	const ms = order.map((idx) => Math.round(charTime(charPos[idx])));

	// 4) Enforce ordering + a minimum on-screen gap, kept before the outro.
	for (let i = 0; i < n; i++) {
		const floor = i > 0 ? ms[i - 1] + MIN_GAP_MS : 0;
		ms[i] = Math.min(Math.max(ms[i], floor), outroStartMs - (n - i) * MIN_GAP_MS);
	}
	for (let i = 1; i < n; i++) if (ms[i] <= ms[i - 1]) ms[i] = ms[i - 1] + MIN_GAP_MS;

	return ordered.map((t, i) => ({
		category: t.category,
		heading: t.heading,
		summary: t.summary,
		sources: [...new Set(t.sources)].slice(0, 2),
		accent: ACCENTS[i % ACCENTS.length],
		startMs: ms[i],
		endMs: i < n - 1 ? ms[i + 1] : outroStartMs,
	}));
}

async function main() {
	const opts = parseArgs(process.argv.slice(2));
	if (opts.help) {
		process.stdout.write(usage());
		return;
	}
	if (!opts.date) throw new Error('Provide --date <YYYY-MM-DD>');

	loadDotEnv(path.join(REPO_ROOT, '.env'));

	const inputPath = path.join(REPO_ROOT, opts.input ?? `platforms/podcast/daily/${opts.date}.md`);
	if (!fs.existsSync(inputPath)) throw new Error(`Podcast Markdown not found: ${inputPath}`);
	const podcast = parseFrontmatter(fs.readFileSync(inputPath, 'utf8'));
	const scriptClean = extractScript(podcast.body).replace(/\s+/g, ' ').trim();
	const cp = [...scriptClean];

	const sourceRel = podcast.data.source ?? `src/content/docs/daily/${opts.date}.md`;
	const sourcePath = path.join(REPO_ROOT, sourceRel);
	if (!fs.existsSync(sourcePath)) throw new Error(`Daily source Markdown not found: ${sourcePath}`);
	const { agenda, topics: rawTopics } = parseDaily(parseFrontmatter(fs.readFileSync(sourcePath, 'utf8')).body);
	if (!rawTopics.length) throw new Error(`No topics parsed from ${sourcePath}`);

	const audioRel = opts.audio ?? podcast.data.audio ?? `public/audio/daily/${opts.date}.mp3`;
	const audioPath = path.join(REPO_ROOT, audioRel);
	if (!fs.existsSync(audioPath)) throw new Error(`Audio not found: ${audioPath}`);

	const outFile = path.join(DATA_DIR, `${opts.date}.json`);
	if (fs.existsSync(outFile) && !opts.force) throw new Error(`Data exists: ${outFile}. Use --force.`);

	const durationSec = ffprobeDuration(audioPath);
	const durationMs = Math.round(durationSec * 1000);

	let charTime;
	let timingMode;
	if (opts.whisper) {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) throw new Error('OPENAI_API_KEY missing (add to .env) or pass --no-whisper.');
		process.stdout.write(`Transcribing ${audioRel} with Whisper (word timestamps)...\n`);
		const words = await whisperWords(audioPath, apiKey);
		const anchors = words.length ? lcsAnchors(scriptCharStream(cp), whisperCharStream(words)) : [];
		charTime = makeCharTime(anchors, cp.length, durationMs);
		timingMode = anchors.length
			? `forced-alignment (${anchors.length} anchors / ${cp.length} chars)`
			: 'proportional (alignment produced no anchors)';
	} else {
		charTime = (idx) => (durationMs * idx) / Math.max(1, cp.length);
		timingMode = 'proportional (--no-whisper)';
	}

	const captions = forcedCaptions(cp, charTime, durationMs);
	const topics = anchorTopics(rawTopics, cp, charTime, durationMs);

	const data = {
		date: opts.date,
		brand: BRAND,
		siteUrl: SITE_URL,
		xHandle: X_HANDLE,
		audioFile: audioRel.replace(/^public\//, ''),
		durationInSeconds: durationSec,
		fps: FPS,
		agenda,
		topics,
		captions,
	};

	fs.mkdirSync(DATA_DIR, { recursive: true });
	fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
	process.stdout.write(
		`Wrote ${path.relative(REPO_ROOT, outFile)}\n` +
			`  duration: ${durationSec.toFixed(1)}s  topics: ${topics.length}  captions: ${captions.length}\n` +
			`  timing: ${timingMode}\n`,
	);
}

main().catch((e) => {
	process.stderr.write(`${e.message}\n`);
	process.exit(1);
});
