import { AbsoluteFill, Img, staticFile } from 'remotion';
import { ACCENTS, ACCENT_GRADIENT, COLORS, FONT_FAMILY } from './theme';
import type { DailyDigestProps } from './types';

// Short, punchy label for a topic: the subject before the first 「が」particle
// (headings are written as "<主語>が…"), e.g. "Claude Code Artifactsが…" → "Claude Code Artifacts".
const subjectOf = (heading: string) => {
	const i = heading.indexOf('が');
	return (i > 0 ? heading.slice(0, i) : heading).trim();
};

// 1280x720 YouTube thumbnail. No captions — built for readability at small size.
export const Thumbnail = (props: DailyDigestProps) => {
	const topics = props.topics ?? [];
	const leads = topics.slice(0, 3).map((t) => subjectOf(t.heading));
	const rest = Math.max(0, topics.length - leads.length);

	return (
		<AbsoluteFill style={{ backgroundColor: COLORS.bg, fontFamily: FONT_FAMILY }}>
			<AbsoluteFill
				style={{ background: 'radial-gradient(95% 75% at 12% 0%, rgba(28,44,73,0.95) 0%, rgba(17,24,39,0) 60%)' }}
			/>
			{/* faint brand watermark */}
			<Img
				src={staticFile('favicon.svg')}
				style={{ position: 'absolute', right: -90, bottom: -90, width: 520, height: 520, opacity: 0.08 }}
			/>

			{/* top row: brand + date */}
			<div style={{ position: 'absolute', top: 48, left: 70, right: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
					<Img src={staticFile('favicon.svg')} style={{ width: 60, height: 60 }} />
					<span style={{ fontSize: 32, fontWeight: 800, color: COLORS.text, letterSpacing: 1 }}>{props.brand}</span>
				</div>
				<span
					style={{
						fontSize: 30,
						fontWeight: 700,
						color: COLORS.bg,
						background: ACCENT_GRADIENT,
						padding: '8px 22px',
						borderRadius: 999,
					}}
				>
					{props.date}
				</span>
			</div>

			{/* main hook block */}
			<div style={{ position: 'absolute', top: 196, left: 70, right: 70 }}>
				<div style={{ fontSize: 40, fontWeight: 800, color: COLORS.cyan, marginBottom: 26 }}>
					今日のAIニュース ・ {topics.length}トピック
				</div>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
					{leads.map((s, i) => (
						<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
							<div style={{ width: 18, height: 18, borderRadius: 9, background: ACCENTS[i % ACCENTS.length], flexShrink: 0 }} />
							<span
								style={{
									fontSize: 70,
									fontWeight: 800,
									color: COLORS.text,
									lineHeight: 1.12,
									whiteSpace: 'nowrap',
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									maxWidth: 1080,
								}}
							>
								{s}
							</span>
						</div>
					))}
				</div>
				{rest > 0 ? (
					<div style={{ fontSize: 36, fontWeight: 600, color: COLORS.muted, marginTop: 22, marginLeft: 40 }}>
						ほか {rest} 本のアップデート
					</div>
				) : null}
			</div>

			<div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 10, background: ACCENT_GRADIENT }} />
		</AbsoluteFill>
	);
};
