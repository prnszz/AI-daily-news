import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT_FAMILY } from '../theme';
import type { WeeklyBlock } from '../types';

// Approx rendered width in "CJK units" so heading/summary fonts auto-fit.
const visualWidth = (s: string) => [...s].reduce((w, ch) => w + (/[ -~｡-ﾟ]/.test(ch) ? 0.55 : 1), 0);

// Weekly scene: a top badge, left = concise text, right = the block's image.
export const WeeklySplitScene = ({ block }: { block: WeeklyBlock }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6 } });
	const x = interpolate(enter, [0, 1], [60, 0]);
	const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
	const imgScale = interpolate(enter, [0, 1], [1.05, 1]);

	const headingW = visualWidth(block.heading);
	const headingFont = headingW > 40 ? 40 : headingW > 30 ? 46 : 54;
	const summary = block.summary ?? '';
	// Left column is ~876px wide; auto-shrink so the summary fits ~4.5 lines.
	const summaryFont = Math.max(28, Math.min(36, Math.floor((4.5 * 876) / Math.max(1, visualWidth(summary)))));
	const src = block.image.startsWith('http') ? block.image : staticFile(block.image);

	return (
		<AbsoluteFill style={{ padding: '150px 110px 90px', justifyContent: 'center' }}>
			{/* badge */}
			<div
				style={{
					opacity,
					alignSelf: 'flex-start',
					background: block.accent,
					color: COLORS.bg,
					fontFamily: FONT_FAMILY,
					fontSize: 26,
					fontWeight: 800,
					letterSpacing: 2,
					padding: '8px 22px',
					borderRadius: 999,
					marginBottom: 30,
				}}
			>
				{block.label.toUpperCase()}
			</div>

			<div style={{ display: 'flex', gap: 64, alignItems: 'center', flex: 1 }}>
				{/* left: text */}
				<div style={{ flex: '1 1 0', transform: `translateX(${x}px)`, opacity }}>
					<div
						style={{
							fontFamily: FONT_FAMILY,
							fontSize: headingFont,
							fontWeight: 800,
							color: COLORS.text,
							lineHeight: 1.3,
							marginBottom: 28,
							display: '-webkit-box',
							WebkitLineClamp: 4,
							WebkitBoxOrient: 'vertical',
							overflow: 'hidden',
						}}
					>
						{block.heading}
					</div>
					<div style={{ width: 110, height: 6, borderRadius: 3, background: block.accent, marginBottom: 28 }} />
					<div
						style={{
							fontFamily: FONT_FAMILY,
							fontSize: summaryFont,
							color: COLORS.subtle,
							lineHeight: 1.55,
							display: '-webkit-box',
							WebkitLineClamp: 6,
							WebkitBoxOrient: 'vertical',
							overflow: 'hidden',
						}}
					>
						{summary}
					</div>
					{block.sources?.length ? (
						<div style={{ marginTop: 26, fontFamily: FONT_FAMILY, fontSize: 24, color: COLORS.muted }}>
							Source:&nbsp;&nbsp;{[...new Set(block.sources)].slice(0, 2).join('  ・  ')}
						</div>
					) : null}
				</div>

				{/* right: image (contain on a panel so any aspect ratio looks intentional) */}
				<div
					style={{
						flex: '0 0 760px',
						height: 620,
						opacity,
						borderRadius: 24,
						overflow: 'hidden',
						background: COLORS.panel,
						border: `1px solid ${COLORS.panelBorder}`,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<Img src={src} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transform: `scale(${imgScale})` }} />
				</div>
			</div>
		</AbsoluteFill>
	);
};
