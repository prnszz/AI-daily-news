export type Caption = {
	text: string;
	startMs: number;
	endMs: number;
};

export type Topic = {
	category: string;
	heading: string;
	summary: string;
	sources: string[];
	accent: string;
	startMs: number;
	endMs: number;
};

export type DailyDigestProps = {
	date: string;
	brand: string;
	siteUrl: string;
	xHandle: string;
	/** Path relative to the public/ dir, resolved via staticFile(). */
	audioFile: string;
	durationInSeconds: number;
	fps: number;
	agenda: string[];
	topics: Topic[];
	captions: Caption[];
};

// --- Weekly ---------------------------------------------------------------

export type WeeklyBlock = {
	kind: 'news' | 'repo' | 'paper';
	/** Badge text shown at the top of the scene, e.g. "ニュース 1 / 5". */
	label: string;
	heading: string;
	/** Concise left-column text (1–2 sentences). */
	summary: string;
	/** Local path under public/ (preferred for render) or a remote URL. */
	image: string;
	sources: string[];
	accent: string;
	startMs: number;
	endMs: number;
};

export type WeeklyDigestProps = {
	week: string; // "2026-W25"
	brand: string;
	siteUrl: string;
	xHandle: string;
	audioFile: string;
	durationInSeconds: number;
	fps: number;
	blocks: WeeklyBlock[];
	captions: Caption[];
};
