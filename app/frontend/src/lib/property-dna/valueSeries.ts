// ─────────────────────────────────────────────────────────────────────────────
// valueSeries — client seam for the get-value-series Netlify function.
//
// Fetches a REAL value/index time-series + moving averages + ticker momentum for
// a geo. When the endpoint returns no real data (source: 'empty'/'error'), the
// caller falls back to the locally-calculated mock series; `computeMovingAverage`
// + `windowForRange` let the UI still render MA overlays + a ticker on top of the
// fallback so the Fidelity treatment never breaks.
// ─────────────────────────────────────────────────────────────────────────────

import type { SeriesPoint, TickerEntry, TimeRange, ValueSeriesResponse } from './types';

/** Fetch the real value series for a geo. Returns null on any failure. */
export async function fetchValueSeries(params: {
  zip?: string;
  city?: string;
  state?: string;
  signal?: AbortSignal;
}): Promise<ValueSeriesResponse | null> {
  const { zip, city, state, signal } = params;
  if (!zip && !city) return null;
  const qs = new URLSearchParams();
  if (zip) qs.set('zip', zip);
  if (city) qs.set('city', city);
  if (state) qs.set('state', state);
  try {
    const res = await fetch(`/.netlify/functions/get-value-series?${qs.toString()}`, { signal });
    if (!res.ok) return null;
    const data: ValueSeriesResponse = await res.json();
    if (!data || !data.ok || !Array.isArray(data.series) || data.series.length < 2) return null;
    if (data.source === 'empty' || data.source === 'error') return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Trailing date-windowed Simple Moving Average over an ordered series — the same
 * math the server runs, used to derive MA overlays from the calculated fallback
 * series when the live endpoint has no real data.
 */
export function computeMovingAverage(points: SeriesPoint[], windowDays: number): SeriesPoint[] {
  const DAY = 86400000;
  const t = points.map((p) => (p.date ? new Date(p.date).getTime() : NaN));
  // If points carry no ISO dates, fall back to an index-count window (~1 pt/mo).
  const hasDates = t.every((x) => Number.isFinite(x));
  return points.map((p, i) => {
    let sum = 0;
    let n = 0;
    if (hasDates) {
      const cut = t[i] - windowDays * DAY;
      for (let j = i; j >= 0; j--) {
        if (t[j] < cut) break;
        sum += points[j].value;
        n++;
      }
    } else {
      const span = Math.max(1, Math.round(windowDays / 30));
      for (let j = i; j >= 0 && j > i - span; j--) {
        sum += points[j].value;
        n++;
      }
    }
    return { t: p.t, value: Math.round(n ? sum / n : p.value), date: p.date };
  });
}

/** Sensible short/long MA windows (days) for a selected time range. */
export function windowsForRange(range: TimeRange): { short: number; long: number } {
  switch (range) {
    case '1M':
      return { short: 7, long: 21 };
    case '6M':
      return { short: 30, long: 90 };
    case '1Y':
      return { short: 30, long: 90 };
    case '3Y':
      return { short: 90, long: 365 };
    case '5Y':
    default:
      return { short: 90, long: 365 };
  }
}

/** % change across a series (first → last). */
export function changePct(points: SeriesPoint[]): number {
  if (points.length < 2) return 0;
  const a = points[0].value;
  const b = points[points.length - 1].value;
  return a > 0 ? Math.round(((b - a) / a) * 1000) / 10 : 0;
}

/**
 * Slice a (typically monthly) series to the trailing portion matching a range,
 * so the same real history can drive every range tab without extra fetches.
 */
export function sliceToRange(points: SeriesPoint[], range: TimeRange): SeriesPoint[] {
  const monthsByRange: Record<TimeRange, number> = { '1M': 2, '6M': 6, '1Y': 12, '3Y': 36, '5Y': 60 };
  const want = monthsByRange[range];
  if (points.length <= want) return points;
  return points.slice(points.length - want);
}

/** Build a fallback ticker strip from neighborhood index change values. */
export function fallbackTicker(opts: {
  zip: string;
  city: string;
  neighborhoodName: string;
  zipChangePct: number;
  cityChangePct: number;
  areaChangePct: number;
}): TickerEntry[] {
  const dir = (n: number): TickerEntry['dir'] => (n > 0.15 ? 'up' : n < -0.15 ? 'down' : 'flat');
  const out: TickerEntry[] = [];
  if (opts.neighborhoodName)
    out.push({ key: 'hood', label: opts.neighborhoodName, value: null, changePct: opts.areaChangePct, dir: dir(opts.areaChangePct) });
  if (opts.city)
    out.push({ key: 'city', label: opts.city, value: null, changePct: opts.cityChangePct, dir: dir(opts.cityChangePct) });
  if (opts.zip)
    out.push({ key: 'zip', label: `ZIP ${opts.zip}`, value: null, changePct: opts.zipChangePct, dir: dir(opts.zipChangePct) });
  return out;
}
