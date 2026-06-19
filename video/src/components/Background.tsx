import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { COLORS } from '../theme';

export const Background = () => {
	const frame = useCurrentFrame();
	// Slow breathing glow so the static background never feels frozen.
	const t = frame % 600;
	const x = interpolate(t, [0, 300, 600], [16, 24, 16]);
	const o = interpolate(t, [0, 300, 600], [0.85, 1, 0.85]);
	return (
		<AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
			<AbsoluteFill
				style={{
					background: `radial-gradient(120% 85% at ${x}% 4%, rgba(28,44,73,${o}) 0%, rgba(17,24,39,0) 58%)`,
				}}
			/>
			<AbsoluteFill
				style={{
					background: `radial-gradient(90% 70% at 95% 100%, rgba(45,212,191,0.10) 0%, rgba(17,24,39,0) 55%)`,
				}}
			/>
		</AbsoluteFill>
	);
};
