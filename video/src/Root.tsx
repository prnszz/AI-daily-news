import { Composition } from 'remotion';
import { DailyDigest } from './DailyDigest';
import { sampleProps } from './sample';
import type { DailyDigestProps } from './types';

export const RemotionRoot = () => {
	return (
		<Composition
			id="DailyDigest"
			component={DailyDigest}
			durationInFrames={480}
			fps={30}
			width={1920}
			height={1080}
			defaultProps={sampleProps}
			calculateMetadata={({ props }: { props: DailyDigestProps }) => ({
				durationInFrames: Math.max(1, Math.round(props.durationInSeconds * props.fps)),
				fps: props.fps,
			})}
		/>
	);
};
