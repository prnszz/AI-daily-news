import { Sequence, interpolate, useCurrentFrame } from 'remotion';
import { COLORS, FONT_FAMILY } from '../theme';
import type { Caption } from '../types';

const CaptionLine = ({ text }: { text: string }) => {
	const frame = useCurrentFrame();
	const opacity = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
	const y = interpolate(frame, [0, 7], [22, 0], { extrapolateRight: 'clamp' });
	return (
		<div style={{ position: 'absolute', left: 0, right: 0, bottom: 110, display: 'flex', justifyContent: 'center', padding: '0 200px' }}>
			<div
				style={{
					opacity,
					transform: `translateY(${y}px)`,
					fontFamily: FONT_FAMILY,
					fontSize: 46,
					fontWeight: 700,
					lineHeight: 1.4,
					color: COLORS.text,
					textAlign: 'center',
					background: 'rgba(2,6,23,0.66)',
					border: `1px solid ${COLORS.panelBorder}`,
					borderRadius: 18,
					padding: '18px 36px',
					boxShadow: '0 14px 44px rgba(0,0,0,0.40)',
					maxWidth: 1480,
				}}
			>
				{text}
			</div>
		</div>
	);
};

export const Captions = ({ captions, fps }: { captions: Caption[]; fps: number }) => (
	<>
		{captions.map((c, i) => {
			const from = Math.round((c.startMs / 1000) * fps);
			const dur = Math.max(1, Math.round(((c.endMs - c.startMs) / 1000) * fps));
			return (
				<Sequence key={i} from={from} durationInFrames={dur} name={`caption-${i}`} layout="none">
					<CaptionLine text={c.text} />
				</Sequence>
			);
		})}
	</>
);
