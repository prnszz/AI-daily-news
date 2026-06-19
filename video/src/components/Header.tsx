import { Img, staticFile } from 'remotion';
import { COLORS, FONT_FAMILY } from '../theme';

export const Header = ({ brand, date }: { brand: string; date: string }) => (
	<div
		style={{
			position: 'absolute',
			top: 52,
			left: 80,
			right: 80,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between',
		}}
	>
		<div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
			<Img src={staticFile('favicon.svg')} style={{ width: 56, height: 56 }} />
			<span style={{ fontFamily: FONT_FAMILY, fontSize: 30, fontWeight: 700, color: COLORS.muted, letterSpacing: 1 }}>
				{brand}
			</span>
		</div>
		<span style={{ fontFamily: FONT_FAMILY, fontSize: 30, color: COLORS.muted }}>{date}</span>
	</div>
);
