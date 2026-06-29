// ─────────────────────────────────────────────────────────────────────────────
// PropertyValueChart — Fidelity-clean value chart.
//
// One clean line, a DASHED baseline at the reference value, right-side $ axis
// labels, date labels at the ends, and an optional moving-average overlay
// (e.g. 90-day + 1-year MA) behind a toggle + legend. White background,
// high-contrast, mobile-first. Powers value history, neighborhood index,
// comparable trend, risk trend, and future projection.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SeriesPoint, TimeRange, ValueSeries } from '@/lib/property-dna/types';

const GOLD = '#B89355';
const INK = '#2C2825';
const MUTED = '#6B5F55';
const FID_GREEN = '#1E8E5A';
const FID_RED = '#C94B3A';

export interface ChartSeries {
  /** Series id / legend label. */
  label: string;
  points: SeriesPoint[];
  color?: string;
  /** Render as a faint dashed comparison line (no fill). */
  comparison?: boolean;
}

interface Props {
  /** Either a flat list of points, or range-bucketed series for the toggle. */
  series?: ValueSeries[];
  points?: SeriesPoint[];
  /** Extra comparison lines (e.g. city / zip index). */
  overlays?: ChartSeries[];
  /** Moving-average lines, shown behind a toggle + legend. */
  maOverlays?: ChartSeries[];
  /** Render the moving-average toggle control. */
  showMAToggle?: boolean;
  height?: number;
  color?: string;
  /** Show the 1M / 6M / 1Y / 3Y / 5Y range toggle (requires `series`). */
  showRangeToggle?: boolean;
  ranges?: TimeRange[];
  defaultRange?: TimeRange;
  /** Lifted range state (so a parent header can read the active range). */
  range?: TimeRange;
  onRangeChange?: (r: TimeRange) => void;
  /** Format a value for the axis + tooltip. */
  valueFormat?: (n: number) => string;
  /** Fill the area under the primary line. */
  filled?: boolean;
  /** Optional baseline (e.g. last sale price, or index = 100) → dashed line. */
  baseline?: number;
  /** Label for the dashed baseline (rendered at the line). */
  baselineLabel?: string;
}

const DEFAULT_RANGES: TimeRange[] = ['1M', '6M', '1Y', '3Y', '5Y'];

export default function PropertyValueChart({
  series,
  points,
  overlays = [],
  maOverlays = [],
  showMAToggle = false,
  height = 200,
  color = GOLD,
  showRangeToggle = false,
  ranges = DEFAULT_RANGES,
  defaultRange = '1Y',
  range: rangeProp,
  onRangeChange,
  valueFormat = (n) => `$${Math.round(n).toLocaleString()}`,
  filled = true,
  baseline,
  baselineLabel,
}: Props) {
  // When a parent lifts range state (onRangeChange), the toggle is driven by
  // `ranges` directly; otherwise it reflects the ranges present in `series`.
  const lifted = !!onRangeChange;
  const available = useMemo(
    () => (lifted ? ranges : series ? series.map((s) => s.range) : []),
    [lifted, ranges, series],
  );
  const initial = available.includes(defaultRange) ? defaultRange : available[0] ?? defaultRange;
  const [rangeState, setRangeState] = useState<TimeRange>(initial);
  const range = rangeProp ?? rangeState;
  const setRange = (r: TimeRange) => {
    setRangeState(r);
    onRangeChange?.(r);
  };
  const [showMA, setShowMA] = useState(false);

  const activePoints: SeriesPoint[] = useMemo(() => {
    if (points) return points;
    if (series) return series.find((s) => s.range === range)?.points ?? series[0]?.points ?? [];
    return [];
  }, [points, series, range]);

  // Merge primary + comparison overlays + (toggled) MA overlays into rows.
  const visibleMA = useMemo(() => (showMA ? maOverlays : []), [showMA, maOverlays]);
  const data = useMemo(() => {
    return activePoints.map((p, i) => {
      const row: Record<string, number | string> = { t: p.t, primary: p.value };
      overlays.forEach((o, oi) => {
        row[`ov${oi}`] = o.points[i]?.value ?? o.points[o.points.length - 1]?.value ?? p.value;
      });
      visibleMA.forEach((m, mi) => {
        const v = m.points[i]?.value;
        if (v != null) row[`ma${mi}`] = v;
      });
      return row;
    });
  }, [activePoints, overlays, visibleMA]);

  const values = activePoints.map((p) => p.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const pad = (max - min) * 0.12 || max * 0.04 || 1;
  const up = values.length > 1 && values[values.length - 1] >= values[0];
  // Brand gold charts adopt Fidelity green/red by direction; custom colors pass through.
  const lineColor = color === GOLD ? (up ? FID_GREEN : FID_RED) : color;
  const gradId = useMemo(() => `pvc-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <div style={{ width: '100%' }}>
      {(showRangeToggle && available.length > 0) || (showMAToggle && maOverlays.length > 0) ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {showRangeToggle && available.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
              {ranges
                .filter((r) => available.includes(r))
                .map((r) => {
                  const activeR = range === r;
                  return (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      style={{
                        minWidth: 40,
                        padding: '6px 12px',
                        fontFamily: 'Jost, sans-serif',
                        fontSize: 12,
                        fontWeight: activeR ? 700 : 500,
                        letterSpacing: 0.3,
                        cursor: 'pointer',
                        border: 'none',
                        borderRadius: 999,
                        background: activeR ? FID_GREEN : 'transparent',
                        color: activeR ? '#fff' : MUTED,
                        transition: 'background 0.15s, color 0.15s',
                      }}
                    >
                      {r}
                    </button>
                  );
                })}
            </div>
          )}
          {showMAToggle && maOverlays.length > 0 && (
            <button
              onClick={() => setShowMA((v) => !v)}
              aria-pressed={showMA}
              style={{
                marginLeft: 'auto',
                padding: '6px 12px',
                fontFamily: 'Jost, sans-serif',
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: 0.3,
                cursor: 'pointer',
                border: `1px solid ${showMA ? FID_GREEN : 'rgba(44,40,37,0.16)'}`,
                borderRadius: 999,
                background: showMA ? 'rgba(30,142,90,0.1)' : 'transparent',
                color: showMA ? FID_GREEN : MUTED,
                whiteSpace: 'nowrap',
              }}
            >
              {showMA ? '● ' : '○ '}Moving avg
            </button>
          )}
        </div>
      ) : null}

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(44,40,37,0.06)" vertical={false} />
          <XAxis
            dataKey="t"
            tick={{ fill: MUTED, fontSize: 10, fontFamily: 'Jost, sans-serif' }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis
            orientation="right"
            domain={[min - pad, max + pad]}
            tick={{ fill: MUTED, fontSize: 10, fontFamily: 'Jost, sans-serif' }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => valueFormat(Number(v))}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(44,40,37,0.18)', strokeWidth: 1 }}
            contentStyle={{
              background: '#FFFFFF',
              border: '1px solid rgba(44,40,37,0.12)',
              borderRadius: 10,
              fontFamily: 'Jost, sans-serif',
              fontSize: 12,
              boxShadow: '0 8px 24px rgba(15,14,13,0.12)',
            }}
            labelStyle={{ color: MUTED, fontWeight: 500 }}
            formatter={(v: number | string, name) => {
              const label =
                name === 'primary'
                  ? 'Value'
                  : typeof name === 'string' && name.startsWith('ma')
                    ? maOverlays[Number(name.slice(2))]?.label ?? 'MA'
                    : typeof name === 'string' && name.startsWith('ov')
                      ? overlays[Number(name.slice(2))]?.label ?? name
                      : name;
              return [valueFormat(Number(v)), label];
            }}
          />
          {baseline != null && (
            <ReferenceLine
              y={baseline}
              stroke="rgba(44,40,37,0.32)"
              strokeDasharray="4 4"
              label={
                baselineLabel
                  ? { value: baselineLabel, position: 'insideTopLeft', fill: MUTED, fontSize: 10, fontFamily: 'Jost, sans-serif' }
                  : undefined
              }
            />
          )}
          {overlays.map((o, oi) => (
            <Line
              key={`ov${oi}`}
              type="monotone"
              dataKey={`ov${oi}`}
              name={`ov${oi}`}
              stroke={o.color ?? MUTED}
              strokeWidth={1.4}
              strokeDasharray={o.comparison ? '4 4' : undefined}
              dot={false}
              isAnimationActive={false}
            />
          ))}
          {visibleMA.map((m, mi) => (
            <Line
              key={`ma${mi}`}
              type="monotone"
              dataKey={`ma${mi}`}
              name={`ma${mi}`}
              stroke={m.color ?? (mi === 0 ? '#3D6FB0' : '#A06CC9')}
              strokeWidth={1.6}
              strokeDasharray={mi === 0 ? undefined : '5 3'}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
          <Area
            type="monotone"
            dataKey="primary"
            name="primary"
            stroke={lineColor}
            strokeWidth={2.2}
            fill={filled ? `url(#${gradId})` : 'transparent'}
            dot={false}
            activeDot={{ r: 4, fill: lineColor, stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {(overlays.length > 0 || (showMA && visibleMA.length > 0)) && (
        <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
          <Legend swatch={lineColor} label="This property" />
          {overlays.map((o, oi) => (
            <Legend key={`lov${oi}`} swatch={o.color ?? MUTED} dashed={o.comparison} label={o.label} />
          ))}
          {showMA &&
            visibleMA.map((m, mi) => (
              <Legend
                key={`lma${mi}`}
                swatch={m.color ?? (mi === 0 ? '#3D6FB0' : '#A06CC9')}
                dashed={mi !== 0}
                label={m.label}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function Legend({ swatch, label, dashed }: { swatch: string; label: string; dashed?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 14,
          height: 0,
          borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${swatch}`,
          display: 'inline-block',
        }}
      />
      <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: INK }}>{label}</span>
    </div>
  );
}
