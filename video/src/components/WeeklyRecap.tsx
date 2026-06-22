import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT_FAMILY } from '../theme';
import type { WeeklyBlock } from '../types';

const visualWidth = (s: string) => [...s].reduce((w, ch) => w + (/[ -~｡-ﾟ]/.test(ch) ? 0.55 : 1), 0);
const KIND_LABEL: Record<WeeklyBlock['kind'], string> = { news: 'NEWS', repo: 'GITHUB', paper: 'PAPER' };

// Closing recap: lists ALL blocks (news + repos + paper), staggered in.
export const WeeklyRecap = ({ blocks, week }: { blocks: WeeklyBlock[]; week: string }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const titleOpacity = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
	const titleY = interpolate(frame, [0, 16], [24, 0], { extrapolateRight: 'clamp' });
	const gap = blocks.length > 7 ? 24 : 28;

	return (
		<AbsoluteFill style={{ justifyContent: 'center', padding: '72px 130px 72px' }}>
			<div style={{ opacity: titleOpacity, transform: `translateY(${titleY}px)`, marginBottom: 40 }}>
				<div style={{ fontFamily: FONT_FAMILY, fontSize: 28, fontWeight: 700, letterSpacing: 6, color: COLORS.cyan }}>
					RECAP
				</div>
				<div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 8 }}>
					<div style={{ fontFamily: FONT_FAMILY, fontSize: 60, fontWeight: 800, color: COLORS.text }}>今週のまとめ</div>
					<div style={{ fontFamily: FONT_FAMILY, fontSize: 30, color: COLORS.muted }}>{week}</div>
				</div>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap }}>
				{blocks.map((b, i) => {
					const start = 12 + i * 6;
					const rowEnter = spring({ frame: frame - start, fps, config: { damping: 200, mass: 0.5 } });
					const rowOpacity = interpolate(frame - start, [0, 10], [0, 1], {
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
					});
					const x = interpolate(rowEnter, [0, 1], [36, 0]);
					const w = visualWidth(b.heading);
					const font = w > 46 ? 26 : w > 34 ? 29 : 32;
					return (
						<div
							key={i}
							style={{ display: 'flex', alignItems: 'center', gap: 22, opacity: rowOpacity, transform: `translateX(${x}px)` }}
						>
							<div
								style={{
									flex: '0 0 130px',
									fontFamily: FONT_FAMILY,
									fontSize: 18,
									fontWeight: 800,
									letterSpacing: 1,
									color: b.accent,
								}}
							>
								{KIND_LABEL[b.kind]}
							</div>
							<div
								style={{
									flex: 1,
									fontFamily: FONT_FAMILY,
									fontSize: font,
									fontWeight: 700,
									color: COLORS.text,
									lineHeight: 1.3,
									display: '-webkit-box',
									WebkitLineClamp: 2,
									WebkitBoxOrient: 'vertical',
									overflow: 'hidden',
								}}
							>
								{b.heading}
							</div>
						</div>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};
