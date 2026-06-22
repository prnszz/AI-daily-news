import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import { Background } from './components/Background';
import { Closing } from './components/Closing';
import { Cover } from './components/Cover';
import { FadeIn, FadeOutAtEnd } from './components/Fade';
import { Header } from './components/Header';
import { Recap } from './components/Recap';
import { Thumbnail } from './Thumbnail';
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
			{firstStart > 400
				? (() => {
						// First sentence = branded Cover; the rest of the intro narration
						// (today's overview) rides the thumbnail, so the visual matches.
						const introSplit = Math.min(firstStart, props.captions?.[0]?.endMs ?? 6000);
						const xfade = 14; // cross-fade frames between Cover and the overview
						const coverDur = ms(introSplit) + xfade;
						return (
							<>
								<Sequence durationInFrames={coverDur} name="cover">
									<FadeOutAtEnd durationInFrames={coverDur} frames={xfade}>
										<Cover brand={props.brand} date={props.date} />
									</FadeOutAtEnd>
								</Sequence>
								<Sequence from={ms(introSplit)} durationInFrames={Math.max(1, ms(firstStart - introSplit))} name="opening">
									<FadeIn frames={xfade}>
										<Thumbnail {...props} />
									</FadeIn>
								</Sequence>
							</>
						);
					})()
				: null}

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

			{/* Outro: a recap of the day's topics, then a short thanks card timed to the
			    "詳細は…ご覧ください" line so the site link lands with that narration. */}
			{(() => {
				const outroFrom = ms(lastEnd);
				const detail = (props.captions ?? []).find(
					(c) => c.startMs > lastEnd && (c.text.includes('詳細') || c.text.includes('ご覧')),
				);
				const closingFrom = detail
					? Math.max(outroFrom + 1, ms(detail.startMs))
					: outroFrom + Math.round((durationInFrames - outroFrom) * 0.72);
				return (
					<>
						<Sequence from={outroFrom} durationInFrames={Math.max(1, closingFrom - outroFrom)} name="recap">
							<Recap topics={topics} date={props.date} />
						</Sequence>
						<Sequence from={closingFrom} durationInFrames={Math.max(1, durationInFrames - closingFrom)} name="closing">
							<Closing brand={props.brand} date={props.date} siteUrl={props.siteUrl} xHandle={props.xHandle} />
						</Sequence>
					</>
				);
			})()}

			{/* No burned-in captions: captions.srt is uploaded to YouTube as a
			    toggleable subtitle track, so on-screen content stays unobstructed. */}
		</AbsoluteFill>
	);
};
