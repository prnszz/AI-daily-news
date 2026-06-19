import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT_FAMILY } from '../theme';
import type { Topic } from '../types';

export const TopicScene = ({ topic, index, total }: { topic: Topic; index: number; total: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6 } });
	const x = interpolate(enter, [0, 1], [70, 0]);
	const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
	const badgePop = spring({ frame, fps, config: { damping: 12, mass: 0.4 } });

	return (
		<AbsoluteFill style={{ justifyContent: 'center', padding: '0 110px 120px' }}>
			<div style={{ transform: `translateX(${x}px)`, opacity }}>
				{/* badge + index */}
				<div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 34 }}>
					<div
						style={{
							transform: `scale(${interpolate(badgePop, [0, 1], [0.6, 1])})`,
							transformOrigin: 'left center',
							background: topic.accent,
							color: COLORS.bg,
							fontFamily: FONT_FAMILY,
							fontSize: 30,
							fontWeight: 800,
							letterSpacing: 2,
							padding: '10px 26px',
							borderRadius: 999,
						}}
					>
						{topic.category.toUpperCase()}
					</div>
					<span style={{ fontFamily: FONT_FAMILY, fontSize: 28, color: COLORS.muted, letterSpacing: 1 }}>
						{String(index).padStart(2, '0')} / {String(total).padStart(2, '0')}
					</span>
				</div>

				{/* heading — CSS handles Japanese wrapping natively */}
				<div
					style={{
						fontFamily: FONT_FAMILY,
						fontSize: 68,
						fontWeight: 800,
						color: COLORS.text,
						lineHeight: 1.28,
						maxWidth: 1500,
						display: '-webkit-box',
						WebkitLineClamp: 3,
						WebkitBoxOrient: 'vertical',
						overflow: 'hidden',
					}}
				>
					{topic.heading}
				</div>

				<div style={{ width: 130, height: 6, borderRadius: 3, background: topic.accent, margin: '38px 0' }} />

				{/* summary */}
				<div
					style={{
						fontFamily: FONT_FAMILY,
						fontSize: 40,
						color: COLORS.subtle,
						lineHeight: 1.5,
						maxWidth: 1500,
						display: '-webkit-box',
						WebkitLineClamp: 5,
						WebkitBoxOrient: 'vertical',
						overflow: 'hidden',
					}}
				>
					{topic.summary}
				</div>
			</div>

			{topic.sources?.length ? (
				<div
					style={{
						position: 'absolute',
						left: 110,
						bottom: 150,
						opacity,
						fontFamily: FONT_FAMILY,
						fontSize: 28,
						color: COLORS.muted,
					}}
				>
					Source:&nbsp;&nbsp;{[...new Set(topic.sources)].slice(0, 2).join('  ・  ')}
				</div>
			) : null}
		</AbsoluteFill>
	);
};
