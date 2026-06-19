import { Composition } from 'remotion';
import { DailyDigest } from './DailyDigest';
import { Thumbnail } from './Thumbnail';
import { sampleProps } from './sample';
import type { DailyDigestProps } from './types';

export const RemotionRoot = () => {
	return (
		<>
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
			<Composition
				id="Thumbnail"
				component={Thumbnail}
				durationInFrames={1}
				fps={30}
				width={1280}
				height={720}
				defaultProps={sampleProps}
			/>
		</>
	);
};
