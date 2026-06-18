#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_MODEL = 'gpt-4o-mini-tts';
const DEFAULT_VOICE = 'marin';
const DEFAULT_FORMAT = 'mp3';
const DEFAULT_INSTRUCTIONS =
	'Speak in calm, clear Japanese, like a concise daily news briefing. Keep service names and English technical terms distinct, and avoid sounding overly dramatic.';
const MAX_INPUT_CHARS = 4096;

function usage() {
	return `Usage:
  pnpm podcast:audio -- --date 2026-06-18
  pnpm podcast:audio -- --input platforms/podcast/daily/2026-06-18.md
  pnpm podcast:audio -- --date 2026-06-18 --force
  pnpm podcast:audio -- --date 2026-06-18 --dry-run

Options:
  --date <YYYY-MM-DD>       Use platforms/podcast/daily/<date>.md as input.
  --input <path>            Read a specific podcast Markdown file.
  --output <path>           Write a specific audio file path.
  --model <model>           Override voice_model frontmatter.
  --voice <voice>           Override voice frontmatter.
  --format <format>         Audio format: mp3, opus, aac, flac, wav, or pcm.
  --instructions <text>     Override the default voice instructions.
  --force                   Overwrite an existing output file.
  --dry-run                 Validate inputs without calling the OpenAI API.
  --help                    Show this help text.
`;
}

function parseArgs(argv) {
	const options = {
		date: undefined,
		input: undefined,
		output: undefined,
		model: undefined,
		voice: undefined,
		format: undefined,
		instructions: undefined,
		force: false,
		dryRun: false,
		help: false,
	};

	const readValue = (args, index, name) => {
		const value = args[index + 1];
		if (!value || value.startsWith('--')) {
			throw new Error(`Missing value for ${name}`);
		}
		return value;
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--') {
			continue;
		} else if (arg === '--help' || arg === '-h') {
			options.help = true;
		} else if (arg === '--force') {
			options.force = true;
		} else if (arg === '--dry-run') {
			options.dryRun = true;
		} else if (arg.startsWith('--date=')) {
			options.date = arg.slice('--date='.length);
		} else if (arg === '--date') {
			options.date = readValue(argv, index, arg);
			index += 1;
		} else if (arg.startsWith('--input=')) {
			options.input = arg.slice('--input='.length);
		} else if (arg === '--input') {
			options.input = readValue(argv, index, arg);
			index += 1;
		} else if (arg.startsWith('--output=')) {
			options.output = arg.slice('--output='.length);
		} else if (arg === '--output') {
			options.output = readValue(argv, index, arg);
			index += 1;
		} else if (arg.startsWith('--model=')) {
			options.model = arg.slice('--model='.length);
		} else if (arg === '--model') {
			options.model = readValue(argv, index, arg);
			index += 1;
		} else if (arg.startsWith('--voice=')) {
			options.voice = arg.slice('--voice='.length);
		} else if (arg === '--voice') {
			options.voice = readValue(argv, index, arg);
			index += 1;
		} else if (arg.startsWith('--format=')) {
			options.format = arg.slice('--format='.length);
		} else if (arg === '--format') {
			options.format = readValue(argv, index, arg);
			index += 1;
		} else if (arg.startsWith('--instructions=')) {
			options.instructions = arg.slice('--instructions='.length);
		} else if (arg === '--instructions') {
			options.instructions = readValue(argv, index, arg);
			index += 1;
		} else if (!arg.startsWith('--') && !options.date) {
			options.date = arg;
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}

	return options;
}

function parseEnvValue(value) {
	const trimmed = value.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

function loadDotEnv(envPath) {
	if (!fs.existsSync(envPath)) return;

	const env = fs.readFileSync(envPath, 'utf8');
	for (const line of env.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;

		const equalIndex = trimmed.indexOf('=');
		if (equalIndex === -1) continue;

		const key = trimmed.slice(0, equalIndex).trim();
		const value = parseEnvValue(trimmed.slice(equalIndex + 1));
		if (key && process.env[key] === undefined) {
			process.env[key] = value;
		}
	}
}

function parseFrontmatter(markdown) {
	if (!markdown.startsWith('---\n') && !markdown.startsWith('---\r\n')) {
		return { data: {}, body: markdown };
	}

	const newline = markdown.startsWith('---\r\n') ? '\r\n' : '\n';
	const marker = `${newline}---${newline}`;
	const endIndex = markdown.indexOf(marker, 3);
	if (endIndex === -1) {
		throw new Error('Frontmatter starts with --- but has no closing --- marker');
	}

	const rawFrontmatter = markdown.slice(4, endIndex);
	const body = markdown.slice(endIndex + marker.length);
	const data = {};

	for (const line of rawFrontmatter.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;

		const colonIndex = trimmed.indexOf(':');
		if (colonIndex === -1) continue;

		const key = trimmed.slice(0, colonIndex).trim();
		const value = parseEnvValue(trimmed.slice(colonIndex + 1));
		data[key] = value;
	}

	return { data, body };
}

function extractScript(markdownBody) {
	const match = markdownBody.match(/^## Script\s*$/m);
	if (!match || match.index === undefined) {
		throw new Error('Podcast Markdown must contain a "## Script" heading');
	}

	return markdownBody.slice(match.index + match[0].length).trim();
}

function inferDateFromInput(inputPath) {
	const basename = path.basename(inputPath, path.extname(inputPath));
	return /^\d{4}-\d{2}-\d{2}$/.test(basename) ? basename : undefined;
}

function inferFormat(outputPath) {
	const ext = path.extname(outputPath).slice(1).toLowerCase();
	return ext || DEFAULT_FORMAT;
}

async function createSpeech({ apiKey, input, output, model, voice, format, instructions }) {
	const response = await fetch('https://api.openai.com/v1/audio/speech', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model,
			voice,
			input,
			instructions,
			response_format: format,
		}),
	});

	if (!response.ok) {
		const details = await response.text();
		throw new Error(`OpenAI speech request failed: ${response.status} ${response.statusText}\n${details}`);
	}

	const buffer = Buffer.from(await response.arrayBuffer());
	fs.mkdirSync(path.dirname(output), { recursive: true });
	fs.writeFileSync(output, buffer);
	return buffer.length;
}

async function main() {
	const options = parseArgs(process.argv.slice(2));

	if (options.help) {
		process.stdout.write(usage());
		return;
	}

	const inputPath =
		options.input ?? (options.date ? `platforms/podcast/daily/${options.date}.md` : undefined);

	if (!inputPath) {
		throw new Error('Provide --date <YYYY-MM-DD> or --input <path>');
	}

	if (!fs.existsSync(inputPath)) {
		throw new Error(`Input file not found: ${inputPath}`);
	}

	loadDotEnv('.env');

	const markdown = fs.readFileSync(inputPath, 'utf8');
	const { data: frontmatter, body } = parseFrontmatter(markdown);
	const script = extractScript(body);
	const date = options.date ?? inferDateFromInput(inputPath);
	const outputPath =
		options.output ??
		frontmatter.audio ??
		(date ? `public/audio/daily/${date}.${options.format ?? DEFAULT_FORMAT}` : undefined);

	if (!outputPath) {
		throw new Error('Provide --output <path> or add audio: <path> to frontmatter');
	}

	const model = options.model ?? frontmatter.voice_model ?? DEFAULT_MODEL;
	const voice = options.voice ?? frontmatter.voice ?? DEFAULT_VOICE;
	const format = options.format ?? inferFormat(outputPath);
	const instructions = options.instructions ?? frontmatter.voice_instructions ?? DEFAULT_INSTRUCTIONS;

	if (script.length > MAX_INPUT_CHARS) {
		throw new Error(
			`Script is ${script.length} characters, but the OpenAI speech input limit is ${MAX_INPUT_CHARS}. Shorten the script before generating audio.`,
		);
	}

	if (fs.existsSync(outputPath) && !options.force && !options.dryRun) {
		throw new Error(`Output already exists: ${outputPath}. Use --force to overwrite it.`);
	}

	const summary = [
		`Input: ${inputPath}`,
		`Output: ${outputPath}`,
		`Model: ${model}`,
		`Voice: ${voice}`,
		`Format: ${format}`,
		`Characters: ${script.length}`,
	].join('\n');

	if (options.dryRun) {
		process.stdout.write(`${summary}\nDry run complete. No audio generated.\n`);
		return;
	}

	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error('OPENAI_API_KEY is missing. Add it to .env or export it in the shell.');
	}

	process.stdout.write(`${summary}\nGenerating audio...\n`);
	const bytes = await createSpeech({
		apiKey,
		input: script,
		output: outputPath,
		model,
		voice,
		format,
		instructions,
	});
	process.stdout.write(`Wrote ${outputPath} (${bytes} bytes)\n`);
}

main().catch((error) => {
	process.stderr.write(`${error.message}\n`);
	process.exit(1);
});
