import { useEffect, useState } from 'react';

interface NeighborhoodData {
  apn: string;
  neighborhoodLabel: string;
  neighborhoodKey: string;
  city: string;
  property: {
    renovationRatio: number | null;
    conditionScore: number | null;
    yearBuilt: number | null;
    landRatio: number | null;
    totalValue: number | null;
    detectedFeatures: string[];
    dataQuality: string;
  };
  neighborhood: {
    parcelCount: number;
    avgRenovationRatio: number | null;
    avgConditionScore: number | null;
    avgYearBuilt: number | null;
    avgLandRatio: number | null;
    medianTotalValue: number | null;
    minYearBuilt: number | null;
    maxYearBuilt: number | null;
  };
  city_stats?: {
    avgRenovationRatio: number | null;
    avgConditionScore: number | null;
    avgLandRatio: number | null;
    sampleSize: number;
  };
  ranks: {
    overall: number | null;
    overallLabel: string;
    renovationRatio: number | null;
    conditionScore: number | null;
    landRatio: number | null;
  };
  deltas: {
    renovationRatio: number | null;
    conditionScore: number | null;
    landRatio: number | null;
    totalValue: number | null;
  };
  standoutNeighbors: Array<{
    apn: string;
    conditionScore: number | null;
    renovationRatio: number | null;
    yearBuilt: number | null;
  }>;
}

const GOLD = '#C9A84C';
const DIM  = 'rgba(244,240,232,0.35)';
const FONT_SERIF = 'Cormorant Garamond, Georgia, serif';
const FONT_SANS  = 'Jost, sans-serif';

function pct(val: number | null | undefined, max = 1) {
  if (val == null) return 0;
  return Math.min(100, Math.max(0, (val / max) * 100));
}

function fmt(val: number | null, decimals = 2) {
  if (val == null) return '—';
  return val.toFixed(decimals);
}

function fmtDelta(d: number | null) {
  if (d == null) return null;
  const sign = d > 0 ? '+' : '';
  return `${sign}${d}%`;
}

function deltaColor(d: number | null) {
  if (d == null) return DIM;
  return d > 0 ? '#2D9142' : d < -5 ? '#B85245' : '#C9A84C';
}

function rankColor(pct: number | null) {
  if (pct == null) return DIM;
  if (pct >= 70) return '#2D9142';
  if (pct >= 40) return GOLD;
  return '#B85245';
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${w}%`, height: '100%', background: color, transition: 'width 0.6s ease' }} />
    </div>
  );
}

function CompareRow({
  label,
  thisVal,
  neighborhoodVal,
  cityVal,
  max,
  rank,
  delta,
  format = 'decimal',
}: {
  label: string;
  thisVal: number | null;
  neighborhoodVal: number | null;
  cityVal?: number | null;
  max: number;
  rank: number | null;
  delta: number | null;
  format?: 'decimal' | 'int' | 'pct';
}) {
  const fmtVal = (v: number | null) => {
    if (v == null) return '—';
    if (format === 'int') return Math.round(v).toString();
    if (format === 'pct') return `${Math.round(v * 100)}%`;
    return fmt(v);
  };

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: DIM }}>
          {label}
        </span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {delta != null && (
            <span style={{ fontFamily: FONT_SANS, fontSize: 10, color: deltaColor(delta), letterSpacing: 0.5 }}>
              {fmtDelta(delta)} vs neighborhood
            </span>
          )}
          {rank != null && (
            <span style={{ fontFamily: FONT_SANS, fontSize: 10, color: rankColor(rank) }}>
              {rank}th pct
            </span>
          )}
        </div>
      </div>

      {/* This property */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontFamily: FONT_SANS, fontSize: 9, color: GOLD, width: 90, textAlign: 'right' }}>This property</span>
        <Bar value={thisVal || 0} max={max} color={GOLD} />
        <span style={{ fontFamily: FONT_SERIF, fontSize: 14, color: '#F0EBE0', width: 46, textAlign: 'right' }}>
          {fmtVal(thisVal)}
        </span>
      </div>

      {/* Neighborhood avg */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: cityVal != null ? 4 : 0 }}>
        <span style={{ fontFamily: FONT_SANS, fontSize: 9, color: DIM, width: 90, textAlign: 'right' }}>Neighborhood avg</span>
        <Bar value={neighborhoodVal || 0} max={max} color='rgba(255,255,255,0.2)' />
        <span style={{ fontFamily: FONT_SANS, fontSize: 12, color: DIM, width: 46, textAlign: 'right' }}>
          {fmtVal(neighborhoodVal)}
        </span>
      </div>

      {/* City avg */}
      {cityVal != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: FONT_SANS, fontSize: 9, color: 'rgba(244,240,232,0.18)', width: 90, textAlign: 'right' }}>
            {' '}City avg
          </span>
          <Bar value={cityVal || 0} max={max} color='rgba(255,255,255,0.09)' />
          <span style={{ fontFamily: FONT_SANS, fontSize: 12, color: 'rgba(244,240,232,0.22)', width: 46, textAlign: 'right' }}>
            {fmtVal(cityVal)}
          </span>
        </div>
      )}
    </div>
  );
}

export function NeighborhoodBreakdown({ apn, city }: { apn: string; city?: string }) {
  const [data, setData] = useState<NeighborhoodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apn) return;
    const cleanApn = apn.replace(/[^0-9]/g, '');
    if (cleanApn.length < 6) return;

    fetch(`/.netlify/functions/neighborhood-compare?apn=${cleanApn}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [apn]);

  if (loading) {
    return (
      <div style={{ padding: '28px 0', textAlign: 'center' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: DIM, letterSpacing: 1.5 }}>
          LOADING NEIGHBORHOOD DATA...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px 0' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: 'rgba(184,82,69,0.6)' }}>
          Neighborhood comparison unavailable — assessor data not yet indexed for this property.
        </div>
      </div>
    );
  }

  // Insufficient peer data — show graceful placeholder, not broken UI
  if (!data || (data as any).insufficientData) {
    const count = (data as any)?.validPeerCount ?? 0;
    const label = (data as any)?.neighborhoodLabel || 'This neighborhood';
    return (
      <div style={{ padding: '20px 0' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: DIM, marginBottom: 10 }}>
          {label}
        </div>
        <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: DIM, lineHeight: 1.7 }}>
          {count > 0
            ? `${count} neighboring parcel${count === 1 ? '' : 's'} indexed so far — neighborhood comparison activates at 5+. Check back as the assessor index grows.`
            : 'Assessor records for this parcel and its neighbors are not yet indexed. Neighborhood comparison will appear automatically once indexing is complete.'}
        </div>
      </div>
    );
  }

  const { property: p, neighborhood: n, ranks, deltas } = data;
  const cityStats = (data as any).city || data.city_stats;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: DIM, marginBottom: 5 }}>
            Neighborhood
          </div>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 22, fontWeight: 300, color: '#F0EBE0' }}>
            {data.neighborhoodLabel}
          </div>
          <div style={{ fontFamily: FONT_SANS, fontSize: 10, color: DIM, marginTop: 3 }}>
            {n.parcelCount} comparable parcels · Assessor Book+Page {data.neighborhoodKey}
          </div>
        </div>

        {/* Overall rank badge */}
        {ranks.overall != null && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${rankColor(ranks.overall)}40`,
            padding: '14px 20px',
            textAlign: 'center',
            minWidth: 110,
          }}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: 32, fontWeight: 300, color: rankColor(ranks.overall), lineHeight: 1 }}>
              {ranks.overall}
              <span style={{ fontSize: 14, color: DIM }}>th</span>
            </div>
            <div style={{ fontFamily: FONT_SANS, fontSize: 9, letterSpacing: 1.5, color: DIM, marginTop: 4, textTransform: 'uppercase' }}>
              Percentile
            </div>
            <div style={{ fontFamily: FONT_SANS, fontSize: 10, color: rankColor(ranks.overall), marginTop: 3 }}>
              {ranks.overallLabel.split('—')[0].trim()}
            </div>
          </div>
        )}
      </div>

      {/* Era context */}
      {n.minYearBuilt && n.maxYearBuilt && (
        <div style={{
          background: 'rgba(201,168,76,0.06)',
          border: '1px solid rgba(201,168,76,0.12)',
          padding: '12px 16px',
          marginBottom: 28,
          fontFamily: FONT_SANS,
          fontSize: 11,
          color: DIM,
          lineHeight: 1.6,
        }}>
          <span style={{ color: GOLD }}>Neighborhood era:</span> Built {n.minYearBuilt}–{n.maxYearBuilt} · Avg year {n.avgYearBuilt}.
          {p.yearBuilt && (
            <span>
              {' '}This property ({p.yearBuilt}) is{' '}
              <span style={{ color: '#F0EBE0' }}>
                {p.yearBuilt < (n.avgYearBuilt || 0)
                  ? `${(n.avgYearBuilt || 0) - p.yearBuilt} years older`
                  : p.yearBuilt > (n.avgYearBuilt || 0)
                  ? `${p.yearBuilt - (n.avgYearBuilt || 0)} years newer`
                  : 'the same age'}
              </span>
              {' '}than the neighborhood average.
            </span>
          )}
        </div>
      )}

      {/* Comparison bars */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, marginBottom: 8 }}>

        <CompareRow
          label="Renovation & Improvement Ratio"
          thisVal={p.renovationRatio}
          neighborhoodVal={n.avgRenovationRatio}
          cityVal={cityStats?.avgRenovationRatio}
          max={2}
          rank={ranks.renovationRatio}
          delta={deltas.renovationRatio}
          format="decimal"
        />

        <CompareRow
          label="Condition Score"
          thisVal={p.conditionScore}
          neighborhoodVal={n.avgConditionScore}
          cityVal={cityStats?.avgConditionScore}
          max={100}
          rank={ranks.conditionScore}
          delta={deltas.conditionScore}
          format="int"
        />

        <CompareRow
          label="Land-to-Total Value Ratio"
          thisVal={p.landRatio}
          neighborhoodVal={n.avgLandRatio}
          cityVal={cityStats?.avgLandRatio}
          max={1}
          rank={ranks.landRatio}
          delta={deltas.landRatio}
          format="pct"
        />
      </div>

      {/* What this means */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 20px',
        marginTop: 8,
        marginBottom: 20,
      }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 9, letterSpacing: 2, color: DIM, textTransform: 'uppercase', marginBottom: 8 }}>
          What This Means
        </div>
        <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: '#F0EBE0', lineHeight: 1.8 }}>
          {ranks.overall != null && ranks.overall >= 70 && (
            <>This property ranks in the top {100 - ranks.overall}% of its immediate neighborhood on key assessor metrics. Buyers and investors comparing two doors down will see a measurable advantage here.</>
          )}
          {ranks.overall != null && ranks.overall >= 40 && ranks.overall < 70 && (
            <>This property performs at or near neighborhood standard. The renovation ratio and condition score are consistent with surrounding parcels — neither a premium nor a discount vs immediate neighbors.</>
          )}
          {ranks.overall != null && ranks.overall < 40 && (
            <>This property ranks in the lower tier of its immediate neighborhood by assessor metrics. Buyers pulling CREST data will see this gap vs neighbors — worth addressing improvement permits or condition documentation before listing.</>
          )}
          {ranks.overall == null && (
            <>Neighborhood ranking requires complete assessor records for this parcel and its neighbors. Data may be available after the next assessor update cycle.</>
          )}
        </div>
      </div>

      {/* Detected features */}
      {p.detectedFeatures && p.detectedFeatures.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: 9, letterSpacing: 2, color: DIM, textTransform: 'uppercase', marginBottom: 10 }}>
            Assessor-Detected Features
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {p.detectedFeatures.map((f: string) => (
              <span key={f} style={{
                fontFamily: FONT_SANS,
                fontSize: 10,
                color: '#F0EBE0',
                background: 'rgba(201,168,76,0.08)',
                border: '1px solid rgba(201,168,76,0.2)',
                padding: '4px 10px',
              }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top neighbors */}
      {data.standoutNeighbors && data.standoutNeighbors.length > 0 && (
        <div>
          <div style={{ fontFamily: FONT_SANS, fontSize: 9, letterSpacing: 2, color: DIM, textTransform: 'uppercase', marginBottom: 10 }}>
            Best-Condition Neighbors (Same Block)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {data.standoutNeighbors.map(nb => (
              <div key={nb.apn} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                padding: '12px 14px',
              }}>
                <div style={{ fontFamily: FONT_SANS, fontSize: 9, color: DIM, marginBottom: 4 }}>APN {nb.apn}</div>
                <div style={{ fontFamily: FONT_SERIF, fontSize: 16, color: '#F0EBE0' }}>
                  {nb.conditionScore != null ? Math.round(nb.conditionScore) : '—'}
                  <span style={{ fontFamily: FONT_SANS, fontSize: 9, color: DIM }}> cond</span>
                </div>
                <div style={{ fontFamily: FONT_SANS, fontSize: 10, color: DIM }}>
                  Renov {nb.renovationRatio != null ? nb.renovationRatio.toFixed(2) : '—'} · {nb.yearBuilt || '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
