import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT_FAMILY } from '../theme';
import type { Topic } from '../types';

// Approx rendered width in "CJK units": fullwidth glyphs ≈ 1, ASCII/halfwidth ≈ 0.55.
// Lets us auto-shrink the font so long text always fits instead of clamping it to "…".
const visualWidth = (s: string) => [...s].reduce((w, ch) => w + (/[ -~｡-ﾟ]/.test(ch) ? 0.55 : 1), 0);

export const TopicScene = ({ topic, index, total }: { topic: Topic; index: number; total: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6 } });
	const x = interpolate(enter, [0, 1], [70, 0]);
	const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
	const badgePop = spring({ frame, fps, config: { damping: 12, mass: 0.4 } });

	// Long headings shrink so they stay within a couple of lines instead of clamping to "…".
	const headingW = visualWidth(topic.heading);
	const headingFont = headingW > 40 ? 50 : headingW > 30 ? 58 : 68;
	// Summary is authored concise upstream (podcast `cards:` / first sentence). Auto-shrink
	// the font so it always fits (~4.5 lines), with line-clamp as a final safety net.
	const summary = topic.summary ?? '';
	const summaryFont = Math.max(32, Math.min(40, Math.floor((4.5 * 1500) / Math.max(1, visualWidth(summary)))));

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
						fontSize: headingFont,
						fontWeight: 800,
						color: COLORS.text,
						lineHeight: 1.28,
						maxWidth: 1500,
						display: '-webkit-box',
						WebkitLineClamp: 4,
						WebkitBoxOrient: 'vertical',
						overflow: 'hidden',
					}}
				>
					{topic.heading}
				</div>

				<div style={{ width: 130, height: 6, borderRadius: 3, background: topic.accent, margin: '38px 0' }} />

				{/* summary — concise upstream + auto-shrink so it fits without an ellipsis */}
				<div
					style={{
						fontFamily: FONT_FAMILY,
						fontSize: summaryFont,
						color: COLORS.subtle,
						lineHeight: 1.5,
						maxWidth: 1500,
						display: '-webkit-box',
						WebkitLineClamp: 6,
						WebkitBoxOrient: 'vertical',
						overflow: 'hidden',
					}}
				>
					{summary}
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
