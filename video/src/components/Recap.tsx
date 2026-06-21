import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT_FAMILY } from '../theme';
import type { Topic } from '../types';

// Approx rendered width in "CJK units" (fullwidth ≈ 1, ASCII/halfwidth ≈ 0.55) so a
// long heading auto-shrinks to fit its row instead of clamping to "…".
const visualWidth = (s: string) => [...s].reduce((w, ch) => w + (/[ -~｡-ﾟ]/.test(ch) ? 0.55 : 1), 0);

// Closing "recap" page: lists the day's topics, each row staggering in to match the
// "今日のまとめ、一つ目…二つ目…" narration that plays over the outro.
export const Recap = ({ topics, date }: { topics: Topic[]; date: string }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const titleOpacity = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
	const titleY = interpolate(frame, [0, 16], [24, 0], { extrapolateRight: 'clamp' });
	const rowGap = topics.length > 6 ? 16 : 22;

	return (
		<AbsoluteFill style={{ justifyContent: 'center', padding: '0 130px' }}>
			<div style={{ opacity: titleOpacity, transform: `translateY(${titleY}px)`, marginBottom: 46 }}>
				<div style={{ fontFamily: FONT_FAMILY, fontSize: 30, fontWeight: 700, letterSpacing: 6, color: COLORS.cyan }}>
					RECAP
				</div>
				<div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 8 }}>
					<div style={{ fontFamily: FONT_FAMILY, fontSize: 66, fontWeight: 800, color: COLORS.text }}>今日のまとめ</div>
					<div style={{ fontFamily: FONT_FAMILY, fontSize: 32, color: COLORS.muted }}>{date}</div>
				</div>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: rowGap }}>
				{topics.map((t, i) => {
					const start = 14 + i * 8;
					const rowEnter = spring({ frame: frame - start, fps, config: { damping: 200, mass: 0.5 } });
					const rowOpacity = interpolate(frame - start, [0, 10], [0, 1], {
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
					});
					const x = interpolate(rowEnter, [0, 1], [40, 0]);
					const w = visualWidth(t.heading);
					const titleFont = w > 40 ? 30 : w > 30 ? 34 : 38;
					return (
						<div
							key={i}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 26,
								opacity: rowOpacity,
								transform: `translateX(${x}px)`,
							}}
						>
							<div style={{ flex: '0 0 60px', fontFamily: FONT_FAMILY, fontSize: 34, fontWeight: 800, color: t.accent }}>
								{String(i + 1).padStart(2, '0')}
							</div>
							<div
								style={{
									flex: '0 0 168px',
									fontFamily: FONT_FAMILY,
									fontSize: 22,
									fontWeight: 800,
									letterSpacing: 1,
									color: t.accent,
									textTransform: 'uppercase',
								}}
							>
								{t.category}
							</div>
							<div
								style={{
									flex: 1,
									fontFamily: FONT_FAMILY,
									fontSize: titleFont,
									fontWeight: 700,
									color: COLORS.text,
									lineHeight: 1.3,
									display: '-webkit-box',
									WebkitLineClamp: 2,
									WebkitBoxOrient: 'vertical',
									overflow: 'hidden',
								}}
							>
								{t.heading}
							</div>
						</div>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};
