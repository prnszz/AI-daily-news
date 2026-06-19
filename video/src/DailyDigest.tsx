import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import { Background } from './components/Background';
import { Captions } from './components/Captions';
import { Closing } from './components/Closing';
import { Cover } from './components/Cover';
import { Header } from './components/Header';
import { ProgressBar } from './components/ProgressBar';
import { TopicScene } from './components/TopicScene';
import type { DailyDigestProps } from './types';

export const DailyDigest = (props: DailyDigestProps) => {
	const { fps, durationInFrames } = useVideoConfig();
	const ms = (m: number) => Math.round((m / 1000) * fps);

	const topics = props.topics ?? [];
	const firstStart = topics.length ? topics[0].startMs : 0;
	const lastEnd = topics.length ? topics[topics.length - 1].endMs : props.durationInSeconds * 1000;

	return (
		<AbsoluteFill>
			<Audio src={staticFile(props.audioFile)} />
			<Background />
			<Header brand={props.brand} date={props.date} />

			{/* Intro (only if there is meaningful lead-in narration) */}
			{firstStart > 400 ? (
				<Sequence durationInFrames={ms(firstStart)} name="cover">
					<Cover brand={props.brand} date={props.date} />
				</Sequence>
			) : null}

			{/* One scene per topic, timed to the narration via Whisper anchors */}
			{topics.map((t, i) => (
				<Sequence
					key={i}
					from={ms(t.startMs)}
					durationInFrames={Math.max(1, ms(t.endMs - t.startMs))}
					name={`topic-${i + 1}`}
				>
					<TopicScene topic={t} index={i + 1} total={topics.length} />
				</Sequence>
			))}

			{/* Outro */}
			<Sequence from={ms(lastEnd)} durationInFrames={Math.max(1, durationInFrames - ms(lastEnd))} name="closing">
				<Closing brand={props.brand} date={props.date} siteUrl={props.siteUrl} xHandle={props.xHandle} />
			</Sequence>

			{/* Precise captions ride on top of every scene */}
			<Captions captions={props.captions ?? []} fps={fps} />

			<ProgressBar />
		</AbsoluteFill>
	);
};
