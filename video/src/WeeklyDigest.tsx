import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import { Background } from './components/Background';
import { Closing } from './components/Closing';
import { Cover } from './components/Cover';
import { FadeIn, FadeOutAtEnd } from './components/Fade';
import { Header } from './components/Header';
import { WeeklyCover } from './WeeklyCover';
import { WeeklyRecap } from './components/WeeklyRecap';
import { WeeklySplitScene } from './components/WeeklySplitScene';
import type { WeeklyDigestProps } from './types';

export const WeeklyDigest = (props: WeeklyDigestProps) => {
	const { fps, durationInFrames } = useVideoConfig();
	const ms = (m: number) => Math.round((m / 1000) * fps);

	const blocks = props.blocks ?? [];
	const firstStart = blocks.length ? blocks[0].startMs : 0;
	const lastEnd = blocks.length ? blocks[blocks.length - 1].endMs : props.durationInSeconds * 1000;

	return (
		<AbsoluteFill>
			<Audio src={staticFile(props.audioFile)} />
			<Background />
			<Header brand={props.brand} date={props.week} />

			{firstStart > 400
				? (() => {
						// First sentence = branded Cover; the rest of the intro narration
						// (the week's overview) rides the theme cover, so the visual matches.
						const introSplit = Math.min(firstStart, props.captions?.[0]?.endMs ?? 6000);
						const xfade = 14; // cross-fade frames between Cover and the theme cover
						const coverDur = ms(introSplit) + xfade; // overlap the two scenes for the fade
						return (
							<>
								<Sequence durationInFrames={coverDur} name="cover">
									<FadeOutAtEnd durationInFrames={coverDur} frames={xfade}>
										<Cover brand={props.brand} date={props.week} subtitle="今週のまとめ" />
									</FadeOutAtEnd>
								</Sequence>
								<Sequence from={ms(introSplit)} durationInFrames={Math.max(1, ms(firstStart - introSplit))} name="theme-cover">
									<FadeIn frames={xfade}>
										<WeeklyCover {...props} />
									</FadeIn>
								</Sequence>
							</>
						);
					})()
				: null}

			{/* One split scene per block (news / repo / paper), timed to narration */}
			{blocks.map((b, i) => (
				<Sequence key={i} from={ms(b.startMs)} durationInFrames={Math.max(1, ms(b.endMs - b.startMs))} name={`block-${i + 1}`}>
					<WeeklySplitScene block={b} />
				</Sequence>
			))}

			{/* Outro: recap of all blocks, then thanks timed to the "詳細は…" line */}
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
							<WeeklyRecap blocks={blocks} week={props.week} />
						</Sequence>
						<Sequence from={closingFrom} durationInFrames={Math.max(1, durationInFrames - closingFrom)} name="closing">
							<Closing brand={props.brand} date={props.week} siteUrl={props.siteUrl} xHandle={props.xHandle} />
						</Sequence>
					</>
				);
			})()}
		</AbsoluteFill>
	);
};
