// ─────────────────────────────────────────────────────────────────────────────
// PropertyValueChart — reusable, Fidelity-clean single-line chart.
//
// One component powers: value history, neighborhood index, comparable trend,
// risk trend, and future projection. Pass a single series, or multiple series
// (e.g. property vs. city vs. zip) for a light comparison overlay.
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
  height?: number;
  color?: string;
  /** Show the 1M / 6M / 1Y / 3Y / 5Y range toggle (requires `series`). */
  showRangeToggle?: boolean;
  ranges?: TimeRange[];
  defaultRange?: TimeRange;
  /** Format a value for the axis + tooltip. */
  valueFormat?: (n: number) => string;
  /** Fill the area under the primary line. */
  filled?: boolean;
  /** Optional baseline (e.g. index = 100). */
  baseline?: number;
}

const DEFAULT_RANGES: TimeRange[] = ['1M', '6M', '1Y', '3Y', '5Y'];

export default function PropertyValueChart({
  series,
  points,
  overlays = [],
  height = 200,
  color = GOLD,
  showRangeToggle = false,
  ranges = DEFAULT_RANGES,
  defaultRange = '1Y',
  valueFormat = (n) => `$${Math.round(n).toLocaleString()}`,
  filled = true,
  baseline,
}: Props) {
  const available = useMemo(() => (series ? series.map((s) => s.range) : []), [series]);
  const initial = available.includes(defaultRange) ? defaultRange : available[0] ?? defaultRange;
  const [range, setRange] = useState<TimeRange>(initial);

  const activePoints: SeriesPoint[] = useMemo(() => {
    if (points) return points;
    if (series) return series.find((s) => s.range === range)?.points ?? series[0]?.points ?? [];
    return [];
  }, [points, series, range]);

  // Merge primary + overlays into recharts rows keyed by index.
  const data = useMemo(() => {
    return activePoints.map((p, i) => {
      const row: Record<string, number | string> = { t: p.t, primary: p.value };
      overlays.forEach((o, oi) => {
        row[`ov${oi}`] = o.points[i]?.value ?? o.points[o.points.length - 1]?.value ?? p.value;
      });
      return row;
    });
  }, [activePoints, overlays]);

  const values = activePoints.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.12 || max * 0.04 || 1;
  const up = values.length > 1 && values[values.length - 1] >= values[0];
  const lineColor = color === GOLD ? (up ? GOLD : '#C94B3A') : color;
  const gradId = useMemo(() => `pvc-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <div style={{ width: '100%' }}>
      {showRangeToggle && available.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {ranges
            .filter((r) => available.includes(r))
            .map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  fontFamily: 'Jost, sans-serif',
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: 0.4,
                  cursor: 'pointer',
                  border: 'none',
                  borderRadius: 8,
                  background: range === r ? 'rgba(184,147,85,0.14)' : 'transparent',
                  color: range === r ? GOLD : MUTED,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {r}
              </button>
            ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.22} />
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
            domain={[min - pad, max + pad]}
            tick={{ fill: MUTED, fontSize: 10, fontFamily: 'Jost, sans-serif' }}
            tickLine={false}
            axisLine={false}
            width={52}
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
            formatter={(v: number | string, name) => [valueFormat(Number(v)), name === 'primary' ? 'Value' : name]}
          />
          {baseline != null && (
            <ReferenceLine y={baseline} stroke="rgba(44,40,37,0.2)" strokeDasharray="3 3" />
          )}
          {overlays.map((o, oi) => (
            <Line
              key={oi}
              type="monotone"
              dataKey={`ov${oi}`}
              name={o.label}
              stroke={o.color ?? MUTED}
              strokeWidth={1.4}
              strokeDasharray={o.comparison ? '4 4' : undefined}
              dot={false}
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

      {overlays.length > 0 && (
        <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
          <Legend swatch={lineColor} label="This property" />
          {overlays.map((o, oi) => (
            <Legend key={oi} swatch={o.color ?? MUTED} dashed={o.comparison} label={o.label} />
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
