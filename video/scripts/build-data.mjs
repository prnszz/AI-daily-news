#!/usr/bin/env node

// Builds video/data/<date>.json — the single JSON that drives the Remotion
// render.
//
// Captions use FORCED ALIGNMENT: we keep the exact台本 (script) text and borrow
// only the *timing* from Whisper. Whisper word timestamps are aligned to the
// known script via an LCS so every caption shows the correct words at the moment
// they are actually spoken — Whisper mis-recognitions (agent→エージャント etc.)
// never reach the screen. Topic cards ride the SAME forced-aligned timeline: each
// card pins to where its topic is introduced. Preferred path is an explicit anchor
// in the podcast frontmatter ("<heading key> :: <exact opening sentence>") matched
// as a substring — zero guessing. Without anchors it falls back to a keyword
// heuristic (distinctive Latin/katakana token, monotonic search). Either way the
// position is snapped to its sentence start so cards flip in on cue.

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
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.resolve(__dirname, '..', 'data');
// Whisper word-timestamps cached by audio content hash. Re-running build-data (e.g.
// to iterate on anchors) then costs no API call as long as the .mp3 is unchanged;
// regenerating the audio changes the hash and transparently re-transcribes.
const WHISPER_CACHE_DIR = path.resolve(DATA_DIR, '.whisper-cache');

const BRAND = site.brand;
const SITE_URL = site.baseUrl;
const X_HANDLE = site.xHandle;
const FPS = 30;
const ACCENTS = ['#2dd4bf', '#67e8f9', '#a3e635'];
const MIN_GAP_MS = 4000;
// A keyword used more than this many times in the script is too ambiguous to mark
// a topic's introduction precisely; we still keep it as a last-resort anchor.
const DISTINCTIVE_CAP = 3;
// Generic tokens that appear in many headings/the intro; never anchor on these.
const STOP_TOKENS = new Set([
	'ai', 'api', 'llm', 'ml', 'gpt', 'app', 'apps', 'the', 'and', 'for', 'ios', 'ui', 'os',
	'one', 'sdk', 'agent', 'agents', 'framework', 'video', 'data', 'model', 'models', 'tasks', 'stack',
]);
// Generic katakana that shows up in many headings; never anchor on these.
const KATAKANA_STOP = new Set([
	'アップデート', 'プロダクト', 'ツール', 'モデル', 'リリース', 'サービス', 'ユーザー',
	'オープン', 'データ', 'エージェント', 'コーディング', 'アクセス', 'タスク',
]);

// Distinctive anchor candidates for a heading: Latin/number tokens AND katakana
// runs (proper nouns like ホワイトハウス / セッション). Headings are mostly Japanese,
// so Latin-only extraction would leave many topics with no usable anchor.
function topicKeywords(heading) {
	const latin = (heading.match(/[A-Za-z0-9][A-Za-z0-9.\-]{1,}/g) || [])
		.map((k) => k.toLowerCase())
		.filter((k) => !STOP_TOKENS.has(k));
	const kata = (heading.match(/[゠-ヿ]{3,}/g) || [])
		.filter((k) => !KATAKANA_STOP.has(k))
		.map((k) => k.toLowerCase());
	return [...new Set([...latin, ...kata])];
}

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
  --no-cache            Ignore the Whisper cache and re-transcribe.
  --force               Overwrite an existing data file.
  --help
`;
}

function parseArgs(argv) {
	const o = { date: undefined, input: undefined, audio: undefined, whisper: true, cache: true, force: false, help: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--') continue;
		else if (a === '--help' || a === '-h') o.help = true;
		else if (a === '--force') o.force = true;
		else if (a === '--no-whisper') o.whisper = false;
		else if (a === '--no-cache') o.cache = false;
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

// Resolve `cards: ["<heading key> :: <concise line>", ...]` (podcast frontmatter)
// to a map of topic index → card text. Same key matching as anchors: the key must
// uniquely identify one heading. Lets each card show a tight, self-contained summary
// instead of the full body paragraph.
function resolveCards(topics, cards) {
	const map = new Map();
	if (!Array.isArray(cards)) return map;
	for (const c of cards) {
		const sep = String(c).indexOf('::');
		if (sep < 0) continue;
		const key = c.slice(0, sep).trim().toLowerCase();
		const text = c.slice(sep + 2).trim();
		if (!key || !text) continue;
		const matches = [...topics.keys()].filter((i) => topics[i].heading.toLowerCase().includes(key));
		if (matches.length !== 1) {
			process.stderr.write(`  ! card key "${key}" matched ${matches.length} topics — ignored\n`);
			continue;
		}
		map.set(matches[0], text);
	}
	return map;
}

// Anchor each topic to where it is spoken, then ORDER cards by spoken time.
// The published Markdown may list topics in a different order than the
// narration (e.g. by category), so we must not assume the two orders match.
//
// Two anchoring strategies, in order of trust:
//   1. Explicit anchors (podcast frontmatter `anchors: ["<heading key> :: <exact
//      opening sentence>", ...]`). The cue is matched as an exact substring of the
//      script, so the card pins to the topic's first spoken line with zero
//      guessing. This is the recommended path — author it when writing the script.
//   2. Keyword fallback (rarest distinctive Latin/katakana token, monotonic search)
//      for any topic without a usable anchor, or days with no anchors at all.
function anchorTopics(topics, cp, charTime, durationMs, topicAnchors) {
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

	// Sentence boundaries — the SAME grid the captions snap to. Snapping a card to
	// the start of the sentence that introduces its topic makes it flip in exactly
	// when that line begins, instead of a beat later when the keyword is uttered.
	const chunks = chunkScript(cp);
	const snapToSentence = (idx) => {
		let best = 0;
		for (const c of chunks) {
			if (c.start <= idx) best = c.start;
			else break;
		}
		return best;
	};

	// Each topic's anchor candidates, ranked rarest-first (then longest = most
	// specific). Both Latin and katakana keywords are considered, so a heading
	// like "ホワイトハウスとAnthropicの協議…" anchors on ホワイトハウス (appears once)
	// rather than the very common Anthropic.
	const keywordsOf = topics.map((t) =>
		topicKeywords(t.heading)
			.map((k) => ({ k, f: occurrences(k) }))
			.filter((x) => x.f > 0)
			.sort((a, b) => a.f - b.f || b.k.length - a.k.length),
	);

	// 1) Coarse ordering: each topic's rarest keyword, first occurrence anywhere.
	const coarse = keywordsOf.map((ks) => (ks.length ? lower.indexOf(ks[0].k) : lastBodyIdx));
	const order = [...topics.keys()].sort((a, b) => coarse[a] - coarse[b]);

	// 2) Refine in narration order with a MONOTONIC cursor: resolve each topic's
	//    keywords only at/after the previous topic's position, so an early
	//    duplicate mention (e.g. an earlier "Anthropic") can't steal a later card.
	//    Among the distinctive keywords found after the cursor, take the EARLIEST
	//    so the card lands on the topic's first mention, not a later restatement.
	const pos = new Array(n).fill(null);
	let cursor = 0;
	for (const idx of order) {
		const ks = keywordsOf[idx];
		const distinctive = ks.filter((x) => x.f <= DISTINCTIVE_CAP);
		const pool = distinctive.length ? distinctive : ks;
		const hits = pool.map((x) => lower.indexOf(x.k, cursor)).filter((p) => p >= 0);
		let p = hits.length ? Math.min(...hits) : ks.length ? lower.indexOf(ks[0].k) : cursor;
		if (p < 0) p = cursor;
		p = snapToSentence(p);
		pos[idx] = p;
		cursor = Math.max(cursor, p);
	}

	// 2b) Explicit anchor overrides. "<heading key> :: <opening cue>" pins a topic
	//     to the exact sentence that introduces it — an exact substring match on the
	//     same forced-aligned timeline, which can't be fooled by duplicate keywords.
	//     Topics without an anchor keep their keyword position (steps 1-2).
	let anchored = 0;
	if (Array.isArray(topicAnchors)) {
		for (const a of topicAnchors) {
			const sep = String(a).indexOf('::');
			if (sep < 0) continue;
			const key = a.slice(0, sep).trim().toLowerCase();
			const cue = a.slice(sep + 2).trim().toLowerCase();
			if (!key || !cue) continue;
			const matches = [...topics.keys()].filter((i) => topics[i].heading.toLowerCase().includes(key));
			if (matches.length !== 1) {
				process.stderr.write(`  ! anchor key "${key}" matched ${matches.length} topics — ignored\n`);
				continue;
			}
			const at = lower.indexOf(cue);
			if (at < 0) {
				process.stderr.write(`  ! anchor cue not found in script: "${cue.slice(0, 24)}…" — ignored\n`);
				continue;
			}
			pos[matches[0]] = snapToSentence(at);
			anchored++;
		}
	}

	// 3) Final order + times from the refined positions.
	const finalOrder = [...topics.keys()].sort((a, b) => pos[a] - pos[b]);
	const ordered = finalOrder.map((idx) => topics[idx]);
	const ms = finalOrder.map((idx) => Math.round(charTime(pos[idx])));

	// 4) Enforce ordering + a minimum on-screen gap, kept before the outro.
	for (let i = 0; i < n; i++) {
		const floor = i > 0 ? ms[i - 1] + MIN_GAP_MS : 0;
		ms[i] = Math.min(Math.max(ms[i], floor), outroStartMs - (n - i) * MIN_GAP_MS);
	}
	for (let i = 1; i < n; i++) if (ms[i] <= ms[i - 1]) ms[i] = ms[i - 1] + MIN_GAP_MS;

	const list = ordered.map((t, i) => ({
		category: t.category,
		heading: t.heading,
		summary: t.summary,
		sources: [...new Set(t.sources)].slice(0, 2),
		accent: ACCENTS[i % ACCENTS.length],
		startMs: ms[i],
		endMs: i < n - 1 ? ms[i + 1] : outroStartMs,
	}));
	return { list, anchored };
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

	// Card text = a concise, complete line per topic. Prefer an explicit
	// `cards: ["<heading key> :: <text>"]` from the podcast frontmatter; otherwise
	// fall back to the body's first sentence (kept whole — never cut mid-thought).
	// The full body still lives on the website; the card is just the visual summary.
	const cardMap = resolveCards(rawTopics, podcast.data.cards);
	const firstSentence = (s) => {
		const i = s.indexOf('。');
		return i >= 0 ? s.slice(0, i + 1) : s;
	};
	let carded = 0;
	rawTopics.forEach((t, i) => {
		if (cardMap.has(i)) {
			t.summary = cardMap.get(i);
			carded++;
		} else {
			t.summary = firstSentence(t.summary);
		}
	});

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
		const words = await cachedWhisperWords(audioPath, apiKey, { useCache: opts.cache, cacheDir: WHISPER_CACHE_DIR });
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
	const { list: topics, anchored } = anchorTopics(rawTopics, cp, charTime, durationMs, podcast.data.anchors);

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
	const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
	process.stdout.write(
		`Wrote ${path.relative(REPO_ROOT, outFile)}\n` +
			`  duration: ${durationSec.toFixed(1)}s  topics: ${topics.length} (${anchored} anchored, ${topics.length - anchored} keyword)  captions: ${captions.length}\n` +
			`  timing: ${timingMode}\n`,
	);
	// Quality-gate aid: eyeball that cards track the narration and captions are clean.
	process.stdout.write(`  card text: ${carded}/${topics.length} from frontmatter, ${topics.length - carded} first-sentence fallback\n`);
	process.stdout.write('  topic cards (spoken order):\n');
	for (const t of topics) process.stdout.write(`    ${mmss(t.startMs).padStart(5)}  ${t.heading}\n`);
	process.stdout.write('  first captions:\n');
	for (const c of captions.slice(0, 3)) process.stdout.write(`    ${mmss(c.startMs).padStart(5)}  ${c.text}\n`);
	if (anchored < topics.length && Array.isArray(podcast.data.anchors) && podcast.data.anchors.length) {
		process.stderr.write(
			`  ! ${topics.length - anchored} topic(s) fell back to keyword anchoring — check the anchors list for typos.\n`,
		);
	}
}

main().catch((e) => {
	process.stderr.write(`${e.message}\n`);
	process.exit(1);
});
