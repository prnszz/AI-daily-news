#!/usr/bin/env node

// Pre-publish validation for one day's digest. Checks the published Daily page,
// the podcast script (TTS length + anchors/cards), and the X post (weighted
// length) — the things that have actually bitten us. Exits non-zero on errors.
//
//   pnpm validate -- --date 2026-06-21

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, extractScript } from '../lib/md.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TTS_LIMIT = 4096; // OpenAI speech input limit (characters)
const X_LIMIT = 280; // X weighted-length limit

function parseArgs(argv) {
	let date;
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--') continue;
		else if (a.startsWith('--date=')) date = a.slice(7);
		else if (a === '--date') date = argv[++i];
		else if (!a.startsWith('--') && !date) date = a;
	}
	return { date };
}

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// Twitter/X weighted length: CJK & fullwidth ≈ 2, others ≈ 1, each URL = 23.
const CJK =
	/[ᄀ-ᇿ⺀-〿぀-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;
function weightedX(text) {
	const t = text.replace(/https?:\/\/[^\s]+/g, ' '.repeat(23));
	let n = 0;
	for (const ch of t) n += CJK.test(ch) ? 2 : 1;
	return n;
}

// Headings (### …) under real content sections, with their Source URLs.
function parseDailyTopics(body) {
	const topics = [];
	let section = null;
	let cur = null;
	for (const line of body.split(/\r?\n/)) {
		const t = line.trim();
		if (t.startsWith('## ')) {
			section = t.slice(3).trim();
			cur = null;
		} else if (t.startsWith('### ')) {
			if (section && section !== '今日の話題' && section !== '音声版') {
				cur = { heading: t.slice(4).trim(), sources: [] };
				topics.push(cur);
			} else {
				cur = null;
			}
		} else if (cur && t.startsWith('>')) {
			const m = t.match(/https?:\/\/\S+/);
			if (m) cur.sources.push(m[0]);
		}
	}
	return topics;
}

function read(rel) {
	const p = path.join(REPO_ROOT, rel);
	return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function main() {
	const { date } = parseArgs(process.argv.slice(2));
	if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		process.stderr.write('Provide --date <YYYY-MM-DD>\n');
		process.exit(2);
	}

	// --- Daily page -----------------------------------------------------------
	const dailyRaw = read(`src/content/docs/daily/${date}.md`);
	let headings = [];
	if (!dailyRaw) {
		err(`Daily page missing: src/content/docs/daily/${date}.md`);
	} else {
		const { data, body } = parseFrontmatter(dailyRaw);
		if (!data.title) err('Daily frontmatter: missing title');
		if (!data.description) err('Daily frontmatter: missing description');
		if (/^# (?!#)/m.test(body)) err('Daily body has a top-level "# " H1 (duplicate title)');
		for (const m of ['需确认', '需確認', 'TODO', 'FIXME', '> Review', '已选', '候补']) {
			if (body.includes(m)) err(`Daily body contains leftover editorial marker: "${m}"`);
		}
		const topics = parseDailyTopics(body);
		headings = topics.map((t) => t.heading);
		if (!topics.length) err('Daily page has no topics (### headings)');
		for (const t of topics) if (!t.sources.length) err(`Topic has no Source: "${t.heading}"`);
	}

	// --- Podcast (script + anchors + cards) -----------------------------------
	const podRaw = read(`platforms/podcast/daily/${date}.md`);
	if (!podRaw) {
		err(`Podcast script missing: platforms/podcast/daily/${date}.md`);
	} else {
		const { data, body } = parseFrontmatter(podRaw);
		const script = extractScript(body);
		const chars = [...script].length;
		if (chars > TTS_LIMIT) err(`Podcast script is ${chars} chars > ${TTS_LIMIT} (TTS limit)`);

		const lower = script.toLowerCase();
		const matchKey = (key) => headings.filter((h) => h.toLowerCase().includes(key.toLowerCase()));
		const checkList = (list, name, checkCue) => {
			if (!Array.isArray(list) || !list.length) {
				warn(`Podcast frontmatter has no ${name}: list`);
				return new Set();
			}
			const covered = new Set();
			for (const entry of list) {
				const sep = String(entry).indexOf('::');
				if (sep < 0) {
					err(`${name}: line missing "::": ${entry}`);
					continue;
				}
				const key = entry.slice(0, sep).trim();
				const val = entry.slice(sep + 2).trim();
				const hits = matchKey(key);
				if (hits.length !== 1) err(`${name}: key "${key}" matches ${hits.length} headings (need exactly 1)`);
				else covered.add(hits[0]);
				if (!val) err(`${name}: empty value for key "${key}"`);
				else if (checkCue && !lower.includes(val.toLowerCase()))
					err(`anchors: cue not found in script: "${val.slice(0, 28)}…"`);
			}
			return covered;
		};

		const anchored = checkList(data.anchors, 'anchors', true);
		const carded = checkList(data.cards, 'cards', false);
		for (const h of headings) {
			if (!anchored.has(h)) warn(`No anchor for topic: "${h}"`);
			if (!carded.has(h)) warn(`No card for topic: "${h}"`);
		}
	}

	// --- X post ---------------------------------------------------------------
	const xRaw = read(`platforms/x/daily/${date}.md`);
	if (xRaw) {
		const { body } = parseFrontmatter(xRaw);
		const m = body.match(/##\s*Post\s*\n([\s\S]*?)(?:\n##\s|\s*$)/);
		if (!m) warn('X file present but no "## Post" section found');
		else {
			const w = weightedX(m[1].trim());
			if (w > X_LIMIT) err(`X main post is ${w} weighted > ${X_LIMIT}`);
		}
	}

	// --- Report ---------------------------------------------------------------
	for (const w of warnings) process.stdout.write(`  ⚠ ${w}\n`);
	for (const e of errors) process.stderr.write(`  ✗ ${e}\n`);
	if (errors.length) {
		process.stderr.write(`\nvalidate ${date}: ${errors.length} error(s), ${warnings.length} warning(s)\n`);
		process.exit(1);
	}
	process.stdout.write(`✓ validate ${date}: OK (${warnings.length} warning(s))\n`);
}

main();
