#!/usr/bin/env node

// Thin wrapper around `remotion render` that resolves the data file and writes
// the MP4 into the repo's gitignored out/ directory.

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
const passthrough = [];
for (let i = 0; i < argv.length; i++) {
	const a = argv[i];
	if (a === '--') continue;
	else if (a.startsWith('--date=')) date = a.slice(7);
	else if (a === '--date') date = argv[++i];
	else if (!a.startsWith('--') && !date) date = a;
	else passthrough.push(a);
}
if (!date) {
	process.stderr.write('Provide --date <YYYY-MM-DD>\n');
	process.exit(1);
}

const dataFile = path.join(PROJECT, 'data', `${date}.json`);
if (!fs.existsSync(dataFile)) {
	process.stderr.write(`Data file missing: ${path.relative(REPO_ROOT, dataFile)}\nRun: pnpm build-data -- --date ${date}\n`);
	process.exit(1);
}

const output = path.join(REPO_ROOT, 'out', 'video', 'daily', `${date}.mp4`);
fs.mkdirSync(path.dirname(output), { recursive: true });

const args = ['remotion', 'render', 'src/index.ts', 'DailyDigest', output, `--props=${dataFile}`, ...passthrough];
process.stdout.write(`npx ${args.join(' ')}\n`);
const r = spawnSync('npx', args, { cwd: PROJECT, stdio: 'inherit' });
process.exit(r.status ?? 1);
