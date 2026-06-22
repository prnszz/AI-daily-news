import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import type { ReactNode } from 'react';

// Fade a scene in over its first `frames`.
export const FadeIn = ({ children, frames = 14 }: { children: ReactNode; frames?: number }) => {
	const f = useCurrentFrame();
	const opacity = interpolate(f, [0, frames], [0, 1], { extrapolateRight: 'clamp' });
	return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

// Fade a scene out over its last `frames` (pass the Sequence's durationInFrames).
export const FadeOutAtEnd = ({
	children,
	durationInFrames,
	frames = 14,
}: {
	children: ReactNode;
	durationInFrames: number;
	frames?: number;
}) => {
	const f = useCurrentFrame();
	const opacity = interpolate(f, [durationInFrames - frames, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });
	return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};
