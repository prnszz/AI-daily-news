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
