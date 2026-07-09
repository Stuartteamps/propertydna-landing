// ─────────────────────────────────────────────────────────────────────────────
// PropertyDNA — shared design tokens & tiny formatters for the public property
// page components. Dark-luxury inline-style language (matches ReportView /
// CityLanding). No Tailwind. Keep this dependency-free and pure.
// ─────────────────────────────────────────────────────────────────────────────
import type { CSSProperties } from 'react';

export const T = {
  bg: '#0F0E0D',
  bgDeep: '#0A0908',
  panel: '#111',
  panelAlt: '#1a1a1a',
  border: 'rgba(255,255,255,0.08)',
  borderSoft: 'rgba(255,255,255,0.05)',
  gold: '#C9A84C',
  cream: '#F0EBE0',
  cream2: '#F4F0E8',
  muted: '#6B6252',
  good: '#2D9142',
  goodSoft: '#74C69D',
  warn: '#C9A84C',
  bad: '#B85245',
  serif: 'Cormorant Garamond, Georgia, serif',
  sans: 'Jost, sans-serif',
} as const;

export const eyebrow: CSSProperties = {
  fontFamily: T.sans,
  fontSize: 10,
  letterSpacing: 3,
  textTransform: 'uppercase',
  color: T.gold,
};

export const labelStyle: CSSProperties = {
  fontFamily: T.sans,
  fontSize: 9,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: T.muted,
};

/** "$1,200,000" — coerces numbers or numeric-ish strings; missing → em-dash. */
export const money = (v: unknown): string => {
  if (v == null || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n !== 0 ? `$${Math.round(n).toLocaleString()}` : '—';
};

/** Any real display value or an em-dash. */
export const dash = (v: unknown): string =>
  v == null || v === '' || v === '—' ? '—' : String(v);

/** Confidence badge color by 0–100 score. */
export const confColor = (pct: number | null | undefined): string =>
  pct == null ? T.muted : pct >= 66 ? T.good : pct >= 40 ? T.gold : T.bad;

/** Score color respecting direction (higherIsBetter). */
export function scoreColor(score: number, higherIsBetter: boolean): string {
  const good = higherIsBetter ? score >= 66 : score <= 34;
  const bad = higherIsBetter ? score <= 34 : score >= 66;
  return good ? T.good : bad ? T.bad : T.gold;
}

export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? String(iso).slice(0, 10)
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};
