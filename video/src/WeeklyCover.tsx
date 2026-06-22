import { AbsoluteFill, Img, staticFile, useVideoConfig } from 'remotion';
import { ACCENTS, ACCENT_GRADIENT, COLORS, FONT_FAMILY } from './theme';
import type { WeeklyDigestProps } from './types';

const subjectOf = (heading: string) => {
	const i = heading.indexOf('が');
	return (i > 0 ? heading.slice(0, i) : heading).trim();
};
const KIND_ORDER: Array<'news' | 'repo' | 'paper'> = ['news', 'repo', 'paper'];
const KIND_LABEL = { news: 'News', repo: 'Repo', paper: 'Paper' } as const;
const DESIGN_W = 1280;

// Branded weekly cover. Designed at 1280x720 and scaled to the composition width,
// so the SAME component serves the YouTube thumbnail (1280x720) and the video
// intro (1920x1080). Big hook = the week's theme keywords (・-separated);
// below them a News/Repo/Paper count strip. Falls back to topic subjects.
export const WeeklyCover = (props: WeeklyDigestProps) => {
	const { width } = useVideoConfig();
	const scale = width / DESIGN_W;
	const blocks = props.blocks ?? [];
	const keywords = (props.theme ?? '')
		.split(/[・,、]/)
		.map((s) => s.trim())
		.filter(Boolean);
	const leads = keywords.length ? keywords : blocks.slice(0, 3).map((b) => subjectOf(b.heading));
	const counts = KIND_ORDER.map((k) => ({ label: KIND_LABEL[k], n: blocks.filter((b) => b.kind === k).length })).filter(
		(c) => c.n > 0,
	);

	return (
		<AbsoluteFill style={{ backgroundColor: COLORS.bg, fontFamily: FONT_FAMILY, overflow: 'hidden' }}>
			<div style={{ width: DESIGN_W, height: 720, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'relative' }}>
				<AbsoluteFill style={{ background: 'radial-gradient(95% 75% at 12% 0%, rgba(28,44,73,0.95) 0%, rgba(17,24,39,0) 60%)' }} />
				<Img src={staticFile('favicon.svg')} style={{ position: 'absolute', right: -90, bottom: -90, width: 520, height: 520, opacity: 0.08 }} />

				<div style={{ position: 'absolute', top: 48, left: 70, right: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
						<Img src={staticFile('favicon.svg')} style={{ width: 60, height: 60 }} />
						<span style={{ fontSize: 32, fontWeight: 800, color: COLORS.text, letterSpacing: 1 }}>{props.brand}</span>
					</div>
					<span style={{ fontSize: 30, fontWeight: 700, color: COLORS.bg, background: ACCENT_GRADIENT, padding: '8px 22px', borderRadius: 999 }}>
						{props.week}
					</span>
				</div>

				<div style={{ position: 'absolute', top: 178, left: 70, right: 70 }}>
					<div style={{ fontSize: 34, fontWeight: 800, color: COLORS.cyan, marginBottom: 22 }}>今週のまとめ</div>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
						{leads.map((s, i) => (
							<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
								<div style={{ width: 18, height: 18, borderRadius: 9, background: ACCENTS[i % ACCENTS.length], flexShrink: 0 }} />
								<span style={{ fontSize: 68, fontWeight: 800, color: COLORS.text, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 1080 }}>
									{s}
								</span>
							</div>
						))}
					</div>
				</div>

				<div style={{ position: 'absolute', left: 70, right: 70, bottom: 46, fontSize: 30, fontWeight: 600, color: COLORS.muted }}>
					{counts.map((c) => `${c.label} ${c.n}`).join('  ・  ')}
				</div>

				<div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 10, background: ACCENT_GRADIENT }} />
			</div>
		</AbsoluteFill>
	);
};
