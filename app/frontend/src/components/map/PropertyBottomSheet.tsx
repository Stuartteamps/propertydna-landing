// ─────────────────────────────────────────────────────────────────────────────
// PropertyBottomSheet — draggable, Fidelity-style position card.
//
// Selecting a home should feel like opening a stock position: a big value up top,
// a confidence read, and tabbed intelligence (Overview / Sales / Risk / Permits /
// Upside / Index). White, rounded, clean charts. Empowerment copy only.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildIndexSeries,
  fmtCompactUSD,
  fmtPct,
  fmtSqft,
  fmtUSD,
} from '@/lib/property-dna/calculatePropertyDNA';
import {
  changePct as seriesChangePct,
  computeMovingAverage,
  fallbackTicker,
  fetchValueSeries,
  sliceToRange,
  windowsForRange,
} from '@/lib/property-dna/valueSeries';
import type {
  HeatLayerId,
  ImprovementOpportunity,
  PropertyDNAAsset,
  RiskFactor,
  SeriesPoint,
  TickerEntry,
  TimeRange,
  ValueSeriesResponse,
} from '@/lib/property-dna/types';
import PropertyValueChart, { type ChartSeries } from './PropertyValueChart';
import MarketTickerStrip from './MarketTickerStrip';

const GOLD = '#B89355';
const INK = '#2C2825';
const MUTED = '#6B5F55';
const RULE = 'rgba(44,40,37,0.1)';
const GREEN = '#4F8A4F';
const RED = '#C94B3A';

type Tab = 'overview' | 'sales' | 'risk' | 'permits' | 'upside' | 'index';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'sales', label: 'Sales' },
  { id: 'risk', label: 'Risk' },
  { id: 'permits', label: 'Permits' },
  { id: 'upside', label: 'Upside' },
  { id: 'index', label: 'Index' },
];

const RISK_COLOR: Record<RiskFactor['level'], string> = {
  low: GREEN,
  moderate: GOLD,
  elevated: '#D08A2C',
  high: RED,
};

interface Props {
  asset: PropertyDNAAsset | null;
  onClose: () => void;
}

/** Build value-chart props from live real data when present, else mock + client MAs. */
function buildValueChart(asset: PropertyDNAAsset, live: ValueSeriesResponse | null, range: TimeRange) {
  let points: SeriesPoint[];
  let maOverlays: ChartSeries[];
  if (live && live.series.length >= 2) {
    points = sliceToRange(live.series, range);
    const wins = windowsForRange(range);
    const short = live.movingAverages.short?.points
      ? sliceToRange(live.movingAverages.short.points, range)
      : computeMovingAverage(points, wins.short);
    const long = live.movingAverages.long?.points
      ? sliceToRange(live.movingAverages.long.points, range)
      : computeMovingAverage(points, wins.long);
    maOverlays = [
      { label: live.movingAverages.short?.label ?? `${wins.short}-Day Avg`, points: short, color: '#3D6FB0' },
      { label: live.movingAverages.long?.label ?? `${wins.long}-Day Avg`, points: long, color: '#A06CC9' },
    ];
  } else {
    points = asset.valueHistory.find((s) => s.range === range)?.points ?? asset.valueHistory[0]?.points ?? [];
    const wins = windowsForRange(range);
    maOverlays = [
      { label: `${Math.round(wins.short / 30) || 1}-Mo Avg`, points: computeMovingAverage(points, wins.short), color: '#3D6FB0' },
      { label: `${Math.round(wins.long / 30) || 1}-Mo Avg`, points: computeMovingAverage(points, wins.long), color: '#A06CC9' },
    ];
  }
  const baseline = points.length ? points[0].value : undefined;
  const change = seriesChangePct(points);
  return { points, maOverlays, baseline, change };
}

export default function PropertyBottomSheet({ asset, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [live, setLive] = useState<ValueSeriesResponse | null>(null);
  const [valueRange, setValueRange] = useState<TimeRange>('1Y');
  const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));
  // Sheet height in px; snaps between peek / half / full.
  const snaps = useMemo(() => ({ peek: Math.round(vh * 0.32), half: Math.round(vh * 0.6), full: Math.round(vh * 0.92) }), [vh]);
  const [height, setHeight] = useState(snaps.half);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Reset to half + Overview each time a new asset is opened.
  useEffect(() => {
    if (asset) {
      setTab('overview');
      setValueRange('1Y');
      setHeight(snaps.half);
    }
  }, [asset?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch the REAL value/index series + moving averages + ticker for this geo.
  // Falls back silently to the calculated series if no real data is available.
  useEffect(() => {
    setLive(null);
    if (!asset) return;
    const ctrl = new AbortController();
    fetchValueSeries({ zip: asset.zip, city: asset.city, state: asset.state, signal: ctrl.signal })
      .then((res) => {
        if (res) setLive(res);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [asset?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Value-chart props (real or fallback) + the ticker strip for the header.
  const vc = useMemo(() => (asset ? buildValueChart(asset, live, valueRange) : null), [asset, live, valueRange]);
  const ticker = useMemo<TickerEntry[]>(() => {
    if (!asset) return [];
    if (live?.ticker?.length) return live.ticker;
    const base = asset.neighborhood.changePct[valueRange];
    return fallbackTicker({
      zip: asset.zip,
      city: asset.city,
      neighborhoodName: asset.neighborhood.name,
      zipChangePct: base * 1.04,
      cityChangePct: base * 0.82,
      areaChangePct: base,
    });
  }, [asset, live, valueRange]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragRef.current = { startY: e.clientY, startH: height };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [height],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const next = dragRef.current.startH + (dragRef.current.startY - e.clientY);
      setHeight(Math.max(snaps.peek - 40, Math.min(snaps.full, next)));
    },
    [snaps],
  );
  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    // Snap to nearest; dragging below peek dismisses.
    setHeight((h) => {
      if (h < snaps.peek - 20) {
        onClose();
        return snaps.half;
      }
      const opts = [snaps.peek, snaps.half, snaps.full];
      return opts.reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a));
    });
  }, [snaps, onClose]);

  const open = !!asset;

  return (
    <>
      {/* Scrim — only when expanded past half */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'rgba(15,14,13,0.28)',
          opacity: open && height > snaps.half + 10 ? 1 : 0,
          pointerEvents: open && height > snaps.half + 10 ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          margin: '0 auto',
          maxWidth: 520,
          height,
          background: '#FFFFFF',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          boxShadow: '0 -10px 40px rgba(15,14,13,0.22)',
          transform: open ? 'translateY(0)' : 'translateY(110%)',
          transition: dragRef.current ? 'none' : 'transform 0.32s cubic-bezier(0.32,0.72,0,1), height 0.28s cubic-bezier(0.32,0.72,0,1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'Jost, sans-serif',
        }}
      >
        {/* Drag handle */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ padding: '10px 0 6px', cursor: 'grab', touchAction: 'none', flexShrink: 0 }}
        >
          <div style={{ width: 38, height: 4, borderRadius: 999, background: 'rgba(44,40,37,0.2)', margin: '0 auto' }} />
        </div>

        {asset && (
          <>
            {/* Summary header */}
            <div style={{ padding: '4px 20px 14px', flexShrink: 0, borderBottom: `1px solid ${RULE}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {asset.address}
                  </div>
                  <div style={{ fontSize: 12.5, color: MUTED, marginTop: 1 }}>
                    {asset.neighborhood.name} · {asset.city}, {asset.state} {asset.zip}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 999, border: 'none', background: 'rgba(44,40,37,0.06)', color: MUTED, fontSize: 16, cursor: 'pointer', lineHeight: 1 }}
                >
                  ×
                </button>
              </div>

              {/* Big value + period change (Fidelity-style "+$X (+Y%)") */}
              {(() => {
                const change = vc?.change ?? asset.neighborhoodTrendPct;
                const delta = Math.round((asset.dnaValue * change) / 100);
                const pos = change >= 0;
                return (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 44, fontWeight: 500, lineHeight: 1, color: INK }}>
                      {fmtUSD(asset.dnaValue)}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: pos ? GREEN : RED, fontVariantNumeric: 'tabular-nums' }}>
                      {pos ? '+' : '−'}{fmtCompactUSD(Math.abs(delta))} ({fmtPct(change)})
                      <span style={{ color: MUTED, fontWeight: 400, marginLeft: 4 }}>{valueRange}</span>
                    </div>
                    {live && (
                      <span
                        title={`Real ${live.source} series · ${live.sampleSize} samples`}
                        style={{ fontSize: 9.5, letterSpacing: 0.6, textTransform: 'uppercase', color: GREEN, fontWeight: 700, border: `1px solid ${GREEN}55`, borderRadius: 999, padding: '2px 7px' }}
                      >
                        Live data
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Market-ticker strip: neighborhood / city / metro momentum */}
              <div style={{ margin: '12px -20px 0' }}>
                <MarketTickerStrip entries={ticker} />
              </div>

              {/* Three stat chips */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
                <StatChip label="PropertyDNA Value" value={fmtCompactUSD(asset.dnaValue)} />
                <StatChip label="Risk-Adjusted" value={fmtCompactUSD(asset.riskAdjustedValue)} accent />
                <StatChip label="Confidence" value={`${asset.confidenceScore}`} suffix="/100" />
              </div>
            </div>

            {/* Tabs */}
            <div
              className="pdna-hide-scroll"
              style={{ display: 'flex', gap: 4, padding: '10px 16px 8px', overflowX: 'auto', flexShrink: 0, borderBottom: `1px solid ${RULE}` }}
            >
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    flexShrink: 0,
                    padding: '7px 14px',
                    borderRadius: 999,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: tab === t.id ? 600 : 400,
                    color: tab === t.id ? '#0F0E0D' : MUTED,
                    background: tab === t.id ? 'rgba(184,147,85,0.16)' : 'transparent',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 20px 32px' }}>
              {tab === 'overview' && vc && (
                <OverviewTab asset={asset} vc={vc} range={valueRange} onRange={setValueRange} hasLive={!!live} />
              )}
              {tab === 'sales' && <SalesTab asset={asset} />}
              {tab === 'risk' && <RiskTab asset={asset} />}
              {tab === 'permits' && <PermitsTab asset={asset} />}
              {tab === 'upside' && <UpsideTab asset={asset} />}
              {tab === 'index' && <IndexTab asset={asset} />}
            </div>
          </>
        )}

        <style>{`.pdna-hide-scroll::-webkit-scrollbar{display:none;}`}</style>
      </div>
    </>
  );
}

// ── Shared bits ────────────────────────────────────────────────────────────────

function StatChip({ label, value, suffix, accent }: { label: string; value: string; suffix?: string; accent?: boolean }) {
  return (
    <div style={{ padding: '9px 11px', borderRadius: 12, background: accent ? 'rgba(184,147,85,0.1)' : 'rgba(44,40,37,0.04)' }}>
      <div style={{ fontSize: 10, letterSpacing: 0.4, color: MUTED, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: accent ? GOLD : INK, marginTop: 3 }}>
        {value}
        {suffix && <span style={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: MUTED, fontWeight: 600, margin: '4px 0 10px' }}>
      {children}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ borderRadius: 16, border: `1px solid ${RULE}`, padding: 14, marginBottom: 14, ...style }}>{children}</div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${RULE}` }}>
      <span style={{ fontSize: 13, color: MUTED }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: valueColor ?? INK }}>{value}</span>
    </div>
  );
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

// ── Overview ────────────────────────────────────────────────────────────────────

interface ValueChartProps {
  points: SeriesPoint[];
  maOverlays: ChartSeries[];
  baseline?: number;
  change: number;
}

function OverviewTab({
  asset,
  vc,
  range,
  onRange,
  hasLive,
}: {
  asset: PropertyDNAAsset;
  vc: ValueChartProps;
  range: TimeRange;
  onRange: (r: TimeRange) => void;
  hasLive: boolean;
}) {
  return (
    <div>
      <Card style={{ background: 'rgba(184,147,85,0.06)', borderColor: 'rgba(184,147,85,0.25)' }}>
        <div style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: GOLD, fontWeight: 600 }}>Top Insight</div>
        <div style={{ fontSize: 14.5, color: INK, marginTop: 6, lineHeight: 1.45 }}>{asset.topInsight}</div>
      </Card>

      <SectionLabel>Value History{hasLive ? ' · Live' : ''}</SectionLabel>
      <Card>
        <PropertyValueChart
          points={vc.points}
          maOverlays={vc.maOverlays}
          showMAToggle
          showRangeToggle
          ranges={asset.valueHistory.map((s) => s.range)}
          range={range}
          onRangeChange={onRange}
          baseline={vc.baseline}
          baselineLabel="Period start"
          defaultRange={range}
          valueFormat={(n) => fmtCompactUSD(n)}
          height={210}
        />
      </Card>

      <Row label="Value range" value={`${fmtCompactUSD(asset.valueRange.low)} – ${fmtCompactUSD(asset.valueRange.high)}`} />
      <Row label="Price / sq ft" value={`$${asset.pricePerSqft.toLocaleString()}`} />
      <Row label="Neighborhood trend" value={fmtPct(asset.neighborhoodTrendPct)} valueColor={asset.neighborhoodTrendPct >= 0 ? GREEN : RED} />
      <Row label="Market momentum" value={asset.marketMomentum.label} valueColor={asset.marketMomentum.direction === 'up' ? GREEN : asset.marketMomentum.direction === 'down' ? RED : MUTED} />
      <Row label="Beds / baths" value={`${asset.beds} bd · ${asset.baths} ba`} />
      <Row label="Size" value={fmtSqft(asset.sqft)} />
      <Row label="Year built" value={`${asset.yearBuilt}`} />
    </div>
  );
}

// ── Sales ───────────────────────────────────────────────────────────────────────

function SalesTab({ asset }: { asset: PropertyDNAAsset }) {
  const domPoints = asset.comparableSales
    .slice()
    .sort((a, b) => +new Date(a.saleDate) - +new Date(b.saleDate))
    .map((c) => ({ t: fmtDate(c.saleDate), value: c.domDays }));

  return (
    <div>
      <SectionLabel>Sale History</SectionLabel>
      {asset.saleHistory.map((s) => (
        <Row
          key={s.id}
          label={`${fmtDate(s.date)} · ${s.event.replace('_', ' ')}`}
          value={`${fmtCompactUSD(s.price)} · $${s.pricePerSqft}/sf`}
        />
      ))}

      <div style={{ height: 18 }} />
      <SectionLabel>Nearby Closed Sales</SectionLabel>
      {asset.comparableSales.map((c) => (
        <div key={c.id} style={{ padding: '9px 0', borderBottom: `1px solid ${RULE}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.address}</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: INK, flexShrink: 0 }}>{fmtCompactUSD(c.salePrice)}</span>
          </div>
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>
            {c.distanceMi} mi · ${c.pricePerSqft}/sf · {c.beds}bd/{c.baths}ba · {c.domDays} DOM · {fmtDate(c.saleDate)}
          </div>
        </div>
      ))}

      <div style={{ height: 18 }} />
      <SectionLabel>$/Sq Ft Comparison</SectionLabel>
      <Row label="This property" value={`$${asset.pricePerSqft.toLocaleString()}/sf`} valueColor={GOLD} />
      <Row
        label="Comp average"
        value={`$${Math.round(asset.comparableSales.reduce((s, c) => s + c.pricePerSqft, 0) / Math.max(1, asset.comparableSales.length)).toLocaleString()}/sf`}
      />

      <div style={{ height: 18 }} />
      <SectionLabel>Days-on-Market Trend</SectionLabel>
      <Card>
        <PropertyValueChart points={domPoints} color="#3D6FB0" filled valueFormat={(n) => `${Math.round(n)}d`} height={150} />
      </Card>
    </div>
  );
}

// ── Risk ────────────────────────────────────────────────────────────────────────

function RiskTab({ asset }: { asset: PropertyDNAAsset }) {
  const rp = asset.riskProfile;
  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: MUTED, fontWeight: 600 }}>Overall Risk</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 500, color: INK, lineHeight: 1.1 }}>
              {rp.overall}<span style={{ fontSize: 15, color: MUTED }}>/100</span>
            </div>
          </div>
          <span style={{ padding: '6px 12px', borderRadius: 999, background: `${RISK_COLOR[rp.level]}1f`, color: RISK_COLOR[rp.level], fontSize: 12.5, fontWeight: 600, textTransform: 'capitalize' }}>
            {rp.level}
          </span>
        </div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Understand your risk before it costs you — lower is safer.</div>
      </Card>

      {rp.factors.map((f) => (
        <div key={f.key} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: INK }}>{f.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: RISK_COLOR[f.level], textTransform: 'capitalize' }}>{f.level}</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'rgba(44,40,37,0.07)', overflow: 'hidden' }}>
            <div style={{ width: `${f.score}%`, height: '100%', borderRadius: 999, background: RISK_COLOR[f.level] }} />
          </div>
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 4 }}>{f.detail}</div>
        </div>
      ))}

      <div style={{ height: 8 }} />
      <SectionLabel>Risk Trend</SectionLabel>
      <Card>
        <PropertyValueChart points={rp.trend} color={RED} filled valueFormat={(n) => `${Math.round(n)}`} height={150} />
      </Card>
    </div>
  );
}

// ── Permits ──────────────────────────────────────────────────────────────────────

function PermitsTab({ asset }: { asset: PropertyDNAAsset }) {
  const aduColor = asset.aduPotential === 'strong' ? GREEN : asset.aduPotential === 'possible' ? GOLD : MUTED;
  return (
    <div>
      <Card style={{ background: 'rgba(184,147,85,0.06)', borderColor: 'rgba(184,147,85,0.25)' }}>
        <div style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: GOLD, fontWeight: 600 }}>Next Best Permit Opportunity</div>
        <div style={{ fontSize: 14, color: INK, marginTop: 6, lineHeight: 1.45 }}>{asset.nextBestPermit}</div>
      </Card>

      <Row label="ADU potential" value={asset.aduPotential} valueColor={aduColor} />
      <Row label="Lot coverage" value={`${asset.lotCoveragePct}%`} />
      <Row label="Lot size" value={asset.lotSqft > 0 ? fmtSqft(asset.lotSqft) : '—'} />
      <Row label="Zoning" value={asset.zoning} />
      <Row
        label="Unpermitted additions"
        value={asset.unpermittedAdditionFlag ? 'Flagged' : 'None detected'}
        valueColor={asset.unpermittedAdditionFlag ? RED : GREEN}
      />

      <div style={{ height: 18 }} />
      <SectionLabel>Permit History</SectionLabel>
      {asset.permits.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>No permits on file.</div>}
      {asset.permits.map((p) => (
        <div key={p.id} style={{ padding: '9px 0', borderBottom: `1px solid ${RULE}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>
              {p.type}
              {p.isAdu && <span style={{ marginLeft: 6, fontSize: 10, color: GOLD, fontWeight: 600 }}>ADU</span>}
            </span>
            <span style={{ fontSize: 12.5, color: MUTED, flexShrink: 0, textTransform: 'capitalize' }}>{p.status}</span>
          </div>
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>
            {fmtDate(p.date)}{p.value > 0 ? ` · ${fmtCompactUSD(p.value)}` : ''}{p.description ? ` · ${p.description}` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Upside ───────────────────────────────────────────────────────────────────────

function UpsideTab({ asset }: { asset: PropertyDNAAsset }) {
  const top: ImprovementOpportunity[] = asset.opportunities.slice(0, 5);
  const totalNet = top.reduce((s, o) => s + o.netGain, 0);
  return (
    <div>
      <Card style={{ background: 'rgba(79,138,79,0.07)', borderColor: 'rgba(79,138,79,0.3)' }}>
        <div style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: GREEN, fontWeight: 600 }}>Find Hidden Equity</div>
        <div style={{ fontSize: 14, color: INK, marginTop: 6 }}>
          Top 5 moves model a combined <strong style={{ color: GREEN }}>{fmtCompactUSD(totalNet)}</strong> in net equity.
        </div>
      </Card>

      {top.map((o, i) => (
        <Card key={o.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: INK }}>
              <span style={{ color: GOLD, marginRight: 6 }}>{i + 1}</span>{o.title}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: GREEN, flexShrink: 0 }}>+{fmtCompactUSD(o.netGain)}</div>
          </div>
          <div style={{ fontSize: 12.5, color: MUTED, margin: '6px 0 10px', lineHeight: 1.4 }}>{o.description}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <Mini label="Cost" value={fmtCompactUSD(o.estimatedCost)} />
            <Mini label="Value Add" value={fmtCompactUSD(o.valueAdded)} />
            <Mini label="ROI" value={`${o.roiPct}%`} color={GREEN} />
            <Mini label="Confidence" value={`${Math.round(o.confidence * 100)}%`} />
          </div>
        </Card>
      ))}
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, letterSpacing: 0.3, textTransform: 'uppercase', color: MUTED }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: color ?? INK, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ── Index ────────────────────────────────────────────────────────────────────────

const IDX_RANGES: TimeRange[] = ['1M', '6M', '1Y', '3Y', '5Y'];

function IndexTab({ asset }: { asset: PropertyDNAAsset }) {
  const [range, setRange] = useState<TimeRange>('1Y');
  const ni = asset.neighborhood;
  const change = ni.changePct[range];

  const primary = ni.series.find((s) => s.range === range)?.points ?? [];
  const cityPts = buildIndexSeries(range, change * 0.82, 101).points;
  const zipPts = buildIndexSeries(range, change * 1.04, 202).points;
  const overlays: ChartSeries[] = [
    { label: `${asset.city}`, points: cityPts, color: MUTED, comparison: true },
    { label: `ZIP ${asset.zip}`, points: zipPts, color: '#3D6FB0', comparison: true },
  ];
  const wins = windowsForRange(range);
  const maOverlays: ChartSeries[] = [
    { label: `${Math.round(wins.short / 30) || 1}-Mo Avg`, points: computeMovingAverage(primary, wins.short), color: '#1E8E5A' },
    { label: `${Math.round(wins.long / 30) || 1}-Mo Avg`, points: computeMovingAverage(primary, wins.long), color: '#A06CC9' },
  ];

  return (
    <div>
      <Card>
        <div style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: MUTED, fontWeight: 600 }}>{ni.name} Price Index</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 500, color: INK }}>{ni.currentIndex.toFixed(1)}</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: change >= 0 ? GREEN : RED }}>{fmtPct(change)} {range}</div>
        </div>

        <div style={{ display: 'flex', gap: 4, margin: '12px 0 6px' }}>
          {IDX_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                flex: 1,
                padding: '6px 0',
                fontFamily: 'Jost, sans-serif',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                borderRadius: 8,
                background: range === r ? 'rgba(184,147,85,0.14)' : 'transparent',
                color: range === r ? GOLD : MUTED,
              }}
            >
              {r}
            </button>
          ))}
        </div>

        <PropertyValueChart
          points={primary}
          overlays={overlays}
          maOverlays={maOverlays}
          showMAToggle
          baseline={100}
          baselineLabel="Index 100"
          valueFormat={(n) => n.toFixed(0)}
          height={180}
        />
      </Card>

      <SectionLabel>Compare</SectionLabel>
      <Row label={`${ni.name} (this area)`} value={ni.currentIndex.toFixed(1)} valueColor={GOLD} />
      <Row label={`${asset.city} (city)`} value={ni.cityIndex.toFixed(1)} />
      <Row label={`ZIP ${asset.zip}`} value={ni.zipIndex.toFixed(1)} />

      <div style={{ height: 14 }} />
      <SectionLabel>Trend by Window</SectionLabel>
      {IDX_RANGES.map((r) => (
        <Row key={r} label={r} value={fmtPct(ni.changePct[r])} valueColor={ni.changePct[r] >= 0 ? GREEN : RED} />
      ))}

      <div style={{ height: 18 }} />
      <SectionLabel>Future-Value Projection (5Y)</SectionLabel>
      <FutureProjection asset={asset} />
    </div>
  );
}

function FutureProjection({ asset }: { asset: PropertyDNAAsset }) {
  const expected = asset.futureScenarios.find((s) => s.label === 'expected') ?? asset.futureScenarios[0];
  const overlays: ChartSeries[] = asset.futureScenarios
    .filter((s) => s.label !== 'expected')
    .map((s) => ({
      label: s.label,
      points: s.points,
      color: s.label === 'optimistic' ? GREEN : MUTED,
      comparison: true,
    }));
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        {asset.futureScenarios.map((s) => (
          <div key={s.label} style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 10, textTransform: 'capitalize', color: MUTED }}>{s.label}</div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: s.label === 'expected' ? GOLD : INK, marginTop: 2 }}>{fmtCompactUSD(s.projectedValue)}</div>
            <div style={{ fontSize: 10.5, color: MUTED }}>{fmtPct(s.cagrPct)}/yr</div>
          </div>
        ))}
      </div>
      <PropertyValueChart points={expected.points} overlays={overlays} valueFormat={(n) => fmtCompactUSD(n)} height={160} />
    </Card>
  );
}
