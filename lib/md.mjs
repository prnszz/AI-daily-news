// Shared Markdown / .env helpers used by both the audio script (script/) and the
// video build (video/scripts/). Keep this dependency-free (node builtins only) so
// it can be imported from the isolated video package without pulling anything in.

import fs from 'node:fs';
import process from 'node:process';

const unquote = (v) =>
	(v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")) ? v.slice(1, -1) : v;

// Load KEY=VALUE pairs from a .env file into process.env (without overriding
// values already set in the environment).
export function loadDotEnv(envPath) {
	if (!fs.existsSync(envPath)) return;
	for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
		const t = line.trim();
		if (!t || t.startsWith('#')) continue;
		const eq = t.indexOf('=');
		if (eq === -1) continue;
		const k = t.slice(0, eq).trim();
		const v = unquote(t.slice(eq + 1).trim());
		if (k && process.env[k] === undefined) process.env[k] = v;
	}
}

// Minimal YAML frontmatter parser: scalars plus simple `key:` + `- item` lists
// (used for the podcast `anchors:` / `cards:` lists). Returns { data, body }.
export function parseFrontmatter(md) {
	if (!md.startsWith('---\n') && !md.startsWith('---\r\n')) return { data: {}, body: md };
	const nl = md.startsWith('---\r\n') ? '\r\n' : '\n';
	const marker = `${nl}---${nl}`;
	const end = md.indexOf(marker, 3);
	if (end === -1) throw new Error('Unterminated frontmatter');
	const data = {};
	let listKey = null; // a "key:" with empty value, collecting following "- item" lines
	for (const line of md.slice(4, end).split(/\r?\n/)) {
		const t = line.trim();
		if (!t || t.startsWith('#')) continue;
		if (listKey && t.startsWith('- ')) {
			data[listKey].push(unquote(t.slice(2).trim()));
			continue;
		}
		const c = t.indexOf(':');
		if (c === -1) {
			listKey = null;
			continue;
		}
		const key = t.slice(0, c).trim();
		const v = t.slice(c + 1).trim();
		if (v === '') {
			data[key] = []; // a simple YAML list may follow on subsequent "- " lines
			listKey = key;
			continue;
		}
		listKey = null;
		data[key] = unquote(v);
	}
	return { data, body: md.slice(end + marker.length) };
}

// Everything after the `## Script` heading, trimmed.
export function extractScript(body) {
	const m = body.match(/^## Script\s*$/m);
	if (!m) throw new Error('Podcast Markdown must contain a "## Script" heading');
	return body.slice(m.index + m[0].length).trim();
}
