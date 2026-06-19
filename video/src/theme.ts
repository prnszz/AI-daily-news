// Brand palette + type, mirrored from src/assets/ai-trend-logo.svg.
export const COLORS = {
	bg: '#111827',
	bgDeep: '#0b1220',
	panel: 'rgba(255,255,255,0.04)',
	panelBorder: 'rgba(148,163,184,0.18)',
	text: '#f8fafc',
	subtle: '#cbd5e1',
	muted: '#94a3b8',
	teal: '#2dd4bf',
	cyan: '#67e8f9',
	lime: '#a3e635',
};

export const ACCENTS = [COLORS.teal, COLORS.cyan, COLORS.lime];

export const ACCENT_GRADIENT = `linear-gradient(90deg, ${COLORS.teal} 0%, ${COLORS.cyan} 55%, ${COLORS.lime} 100%)`;

export const FONT_FAMILY =
	"'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Yu Gothic',sans-serif";
