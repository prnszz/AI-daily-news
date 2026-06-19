import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { ACCENT_GRADIENT, COLORS, FONT_FAMILY } from '../theme';

export const Cover = ({ brand, date }: { brand: string; date: string }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const enter = spring({ frame, fps, config: { damping: 200 } });
	const logoScale = interpolate(enter, [0, 1], [0.78, 1]);
	const titleOpacity = interpolate(frame, [6, 22], [0, 1], { extrapolateRight: 'clamp' });
	const titleY = interpolate(frame, [6, 22], [24, 0], { extrapolateRight: 'clamp' });

	return (
		// Sit a little above centre so the synced caption band never overlaps.
		<AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingBottom: 220 }}>
			<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
				<Img src={staticFile('favicon.svg')} style={{ width: 190, height: 190, transform: `scale(${logoScale})` }} />
				<div
					style={{
						opacity: titleOpacity,
						transform: `translateY(${titleY}px)`,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: 20,
						marginTop: 34,
					}}
				>
					<div style={{ fontFamily: FONT_FAMILY, fontSize: 96, fontWeight: 800, color: COLORS.text, letterSpacing: 1 }}>
						{brand}
					</div>
					<div style={{ width: 340, height: 8, borderRadius: 4, background: ACCENT_GRADIENT }} />
					<div style={{ fontFamily: FONT_FAMILY, fontSize: 52, fontWeight: 600, color: COLORS.cyan }}>今日のAIニュース</div>
					<div style={{ fontFamily: FONT_FAMILY, fontSize: 42, color: COLORS.muted }}>{date}</div>
				</div>
			</div>
		</AbsoluteFill>
	);
};
