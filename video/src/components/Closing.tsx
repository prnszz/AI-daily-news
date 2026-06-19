import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT_FAMILY } from '../theme';

export const Closing = ({
	brand,
	date,
	siteUrl,
	xHandle,
}: {
	brand: string;
	date: string;
	siteUrl: string;
	xHandle: string;
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const enter = spring({ frame, fps, config: { damping: 200 } });
	const scale = interpolate(enter, [0, 1], [0.85, 1]);
	const opacity = interpolate(frame, [4, 20], [0, 1], { extrapolateRight: 'clamp' });

	return (
		<AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
			<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, transform: `scale(${scale})`, opacity }}>
				<Img src={staticFile('favicon.svg')} style={{ width: 150, height: 150 }} />
				<div style={{ fontFamily: FONT_FAMILY, fontSize: 62, fontWeight: 800, color: COLORS.text, marginTop: 16 }}>
					ご視聴ありがとうございました
				</div>
				<div style={{ fontFamily: FONT_FAMILY, fontSize: 38, color: COLORS.cyan }}>詳細はサイトで &nbsp;{siteUrl}</div>
				<div style={{ fontFamily: FONT_FAMILY, fontSize: 34, color: COLORS.muted }}>
					X: {xHandle}　·　{brand} {date}
				</div>
			</div>
		</AbsoluteFill>
	);
};
