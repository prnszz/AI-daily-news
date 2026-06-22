import { AbsoluteFill, Img, staticFile, useVideoConfig } from 'remotion';
import { ACCENTS, ACCENT_GRADIENT, COLORS, FONT_FAMILY } from './theme';
import type { DailyDigestProps } from './types';

// Leading recognizable entity: the run of chars before the first hiragana
// (particles/okurigana are hiragana). "AGENTS.mdの整え方で…" → "AGENTS.md",
// "サムスン電子が…" → "サムスン電子". Falls back to a trimmed slice.
const entityOf = (heading: string) => {
	const m = heading.match(/^[^぀-ゟ]+/);
	const e = (m ? m[0] : heading).replace(/[、。・\s]+$/, '').trim();
	return e.length >= 2 ? e : heading.slice(0, 10);
};

// Visual width in "JP-glyph units": Latin/space/digits are ~0.55 the width of a
// full-width glyph. Used to pick a hero font size that fits without truncation.
const vlen = (s: string) =>
	[...s].reduce((n, c) => n + (/[぀-ヿ一-鿿]/.test(c) ? 1 : 0.55), 0);

const heroSize = (heading: string) => {
	const v = vlen(heading);
	if (v <= 12) return 96;
	if (v <= 17) return 84;
	if (v <= 23) return 72;
	if (v <= 30) return 60;
	return 52;
};

// Single hero + supporting chips: one dominant headline (topic #1), the rest
// demoted to color-coded category chips. The hero font auto-fits by weighted
// width (max 3 lines, no ellipsis), so long headings shrink instead of getting
// chopped. Designed at 1280x720; scales to the composition width — serves both
// the YouTube thumbnail (1280) and the daily video's opening overview scene
// (1920). No captions.
export const Thumbnail = (props: DailyDigestProps) => {
	const { width } = useVideoConfig();
	const scale = width / 1280;
	const topics = props.topics ?? [];
	const hero = topics[0];
	const chips = topics.slice(1, 3);
	const rest = Math.max(0, topics.length - 1 - chips.length);
	const heroAccent = hero?.accent ?? ACCENTS[0];

	return (
		<AbsoluteFill style={{ backgroundColor: COLORS.bg, fontFamily: FONT_FAMILY, overflow: 'hidden' }}>
			<div style={{ width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'relative' }}>
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

				{/* centered content: dominant hero + supporting chips (no dead band) */}
				<div
					style={{
						position: 'absolute',
						top: 150,
						left: 70,
						right: 70,
						bottom: 46,
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'center',
						gap: 54,
					}}
				>
					{hero ? (
						<div>
							<div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
								<span
									style={{
										fontSize: 28,
										fontWeight: 800,
										color: COLORS.bg,
										background: heroAccent,
										padding: '6px 18px',
										borderRadius: 8,
										letterSpacing: 1,
									}}
								>
									{hero.category}
								</span>
								<span style={{ fontSize: 26, fontWeight: 700, color: COLORS.muted, letterSpacing: 2 }}>
									今日の注目
								</span>
							</div>
							<div style={{ display: 'flex', gap: 26 }}>
								<div style={{ width: 10, alignSelf: 'stretch', borderRadius: 6, background: heroAccent, flexShrink: 0 }} />
								<span
									style={{
										fontSize: heroSize(hero.heading),
										fontWeight: 800,
										color: COLORS.text,
										lineHeight: 1.18,
										display: '-webkit-box',
										WebkitBoxOrient: 'vertical',
										WebkitLineClamp: 3,
										overflow: 'hidden',
									}}
								>
									{hero.heading}
								</span>
							</div>
						</div>
					) : null}

					{/* supporting chips: topics #2/#3 */}
					<div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
						{chips.map((t, i) => (
							<div
								key={i}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: 14,
									background: COLORS.panel,
									border: `1px solid ${COLORS.panelBorder}`,
									borderRadius: 999,
									padding: '14px 28px 14px 20px',
								}}
							>
								<span
									style={{
										fontSize: 24,
										fontWeight: 800,
										color: COLORS.bg,
										background: t.accent ?? ACCENTS[(i + 1) % ACCENTS.length],
										padding: '5px 16px',
										borderRadius: 7,
									}}
								>
									{t.category}
								</span>
								<span style={{ fontSize: 42, fontWeight: 800, color: COLORS.text }}>{entityOf(t.heading)}</span>
							</div>
						))}
						{rest > 0 ? (
							<span style={{ fontSize: 34, fontWeight: 700, color: COLORS.muted }}>ほか {rest} 本</span>
						) : null}
					</div>
				</div>

				<div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 10, background: ACCENT_GRADIENT }} />
			</div>
		</AbsoluteFill>
	);
};
