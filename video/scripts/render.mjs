#!/usr/bin/env node

// Thin wrapper around `remotion render`. Daily: --date <YYYY-MM-DD>.
// Weekly: --week <YYYY-Www>. Writes the MP4 into the gitignored out/ tree.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PROJECT, '..');

const argv = process.argv.slice(2);
let date;
let weekly = false;
const passthrough = [];
for (let i = 0; i < argv.length; i++) {
	const a = argv[i];
	if (a === '--') continue;
	else if (a.startsWith('--week=')) {
		date = a.slice(7);
		weekly = true;
	} else if (a === '--week') {
		date = argv[++i];
		weekly = true;
	} else if (a.startsWith('--date=')) date = a.slice(7);
	else if (a === '--date') date = argv[++i];
	else if (a === '--weekly') weekly = true;
	else if (!a.startsWith('--') && !date) date = a;
	else passthrough.push(a);
}
if (!date) {
	process.stderr.write('Provide --date <YYYY-MM-DD> (daily) or --week <YYYY-Www> (weekly)\n');
	process.exit(1);
}

const composition = weekly ? 'WeeklyDigest' : 'DailyDigest';
const dataFile = weekly
	? path.join(PROJECT, 'data', 'weekly', `${date}.json`)
	: path.join(PROJECT, 'data', `${date}.json`);
if (!fs.existsSync(dataFile)) {
	const cmd = weekly ? `pnpm build-data-weekly -- --week ${date}` : `pnpm build-data -- --date ${date}`;
	process.stderr.write(`Data file missing: ${path.relative(REPO_ROOT, dataFile)}\nRun: ${cmd}\n`);
	process.exit(1);
}

const output = weekly
	? path.join(REPO_ROOT, 'out', 'video', 'weekly', date, 'video.mp4')
	: path.join(REPO_ROOT, 'out', 'video', 'daily', date, 'video.mp4');
fs.mkdirSync(path.dirname(output), { recursive: true });

const args = ['remotion', 'render', 'src/index.ts', composition, output, `--props=${dataFile}`, ...passthrough];
process.stdout.write(`npx ${args.join(' ')}\n`);
const r = spawnSync('npx', args, { cwd: PROJECT, stdio: 'inherit' });
process.exit(r.status ?? 1);
