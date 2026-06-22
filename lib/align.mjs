// Shared forced-alignment helpers for the daily & weekly video builds.
// Keeps the exact script text for captions and borrows only the *timing* from
// Whisper word-timestamps (via an LCS), so captions/cards are frame-accurate.
// Dependency-free (node builtins only) so the isolated video package can import it.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export function domainOf(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

export function ffprobeDuration(audioPath) {
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

// Whisper word-timestamps, cached by the audio file's content hash so repeated
// runs (anchor iteration, etc.) don't re-pay the API. `useCache=false` always
// re-transcribes and refreshes the cache.
export async function cachedWhisperWords(audioPath, apiKey, { useCache = true, cacheDir } = {}) {
	const hash = crypto.createHash('sha256').update(fs.readFileSync(audioPath)).digest('hex').slice(0, 16);
	const cacheFile = cacheDir ? path.join(cacheDir, `${hash}.json`) : null;
	if (useCache && cacheFile && fs.existsSync(cacheFile)) {
		process.stdout.write(`Using cached Whisper words (${hash}).\n`);
		return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
	}
	process.stdout.write(`Transcribing ${path.basename(audioPath)} with Whisper (word timestamps)...\n`);
	const words = await whisperWords(audioPath, apiKey);
	if (cacheFile) {
		fs.mkdirSync(cacheDir, { recursive: true });
		fs.writeFileSync(cacheFile, JSON.stringify(words));
	}
	return words;
}

// Per-character timeline from Whisper words: each word's characters get times
// spread across the word's [start,end] span.
export function whisperCharStream(words) {
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
export function scriptCharStream(cp) {
	const out = [];
	for (let i = 0; i < cp.length; i++) {
		if (!/\s/.test(cp[i])) out.push({ ch: cp[i].toLowerCase(), origIdx: i });
	}
	return out;
}

// Longest common subsequence → matched (scriptIdx, timeMs) anchor pairs.
export function lcsAnchors(scriptChars, whisperChars) {
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
export function makeCharTime(anchors, cpLen, durationMs) {
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
export function chunkScript(cp) {
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

export function forcedCaptions(cp, charTime, durationMs) {
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
