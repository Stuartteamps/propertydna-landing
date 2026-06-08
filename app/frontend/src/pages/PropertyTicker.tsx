/**
 * Property Ticker — the differentiator.
 *
 * Every house gets a stock-ticker-style page: live valuation header, assessed
 * value timeline (real chart from property_history events), key facts grid,
 * provenance (architect + notable owners + dossier), tier badge, CTA.
 *
 * Route: /ticker/:apn   — Map clicks, dossier links, and search results all
 *                          land here. This is the "stock symbol" of real estate.
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

type Property = {
  apn: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  lot_sqft?: number | null;
  year_built?: number | null;
  property_type?: string | null;
  tax_assessed_value?: number | null;
  tax_annual_amount?: number | null;
  tax_assessment_year?: number | null;
  rentcast_value?: number | null;
  rentcast_value_low?: number | null;
  rentcast_value_high?: number | null;
  rentcast_rent_est?: number | null;
  market_median_price?: number | null;
  market_price_yoy?: number | null;
  pedigree_tier?: string | null;
  pedigree_neighborhood?: string | null;
  provenance_score?: number | null;
  has_provenance_dossier?: boolean | null;
  architect_attribution?: string | null;
  architect_verified?: boolean | null;
  luxury_tier?: string | null;
};

type HistEvent = {
  event_type: string;
  event_date: string;
  data: any;
  source?: string | null;
};

type Owner = {
  owner_name: string;
  owner_role?: string | null;
  ownership_start?: string | null;
  ownership_end?: string | null;
  verification_status?: string | null;
  notable_events?: any[] | null;
};

const TIER_BG: Record<string, string> = {
  A: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
  B: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
  C: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
  D: 'linear-gradient(135deg, #34d399 0%, #059669 100%)',
};

function fmtMoney(n?: number | null) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtNum(n?: number | null) {
  return n == null ? '—' : n.toLocaleString();
}

function ValueChart({ points }: { points: { date: string; value: number }[] }) {
  if (points.length === 0) return null;
  const W = 720, H = 220, P = 32;
  const vs = points.map(p => p.value);
  const min = Math.min(...vs), max = Math.max(...vs);
  const range = max - min || 1;
  const xs = points.map((_, i) => P + (i / Math.max(points.length - 1, 1)) * (W - 2 * P));
  const ys = points.map(p => H - P - ((p.value - min) / range) * (H - 2 * P));
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ background: '#0a0a0a', borderRadius: 6, border: '1px solid #1f2937' }}>
      <defs>
        <linearGradient id="tickerArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#fbbf24" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${xs[xs.length - 1]} ${H - P} L ${xs[0]} ${H - P} Z`} fill="url(#tickerArea)" />
      <path d={path} stroke="#fbbf24" strokeWidth="2" fill="none" />
      {xs.map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={ys[i]} r={4} fill="#fbbf24" />
          <text x={x} y={ys[i] - 10} textAnchor="middle" fontSize="11" fill="#cbd5e1">{fmtMoney(points[i].value)}</text>
          <text x={x} y={H - 10}     textAnchor="middle" fontSize="10" fill="#64748b">{points[i].date.slice(0, 7)}</text>
        </g>
      ))}
    </svg>
  );
}

export default function PropertyTicker() {
  const { apn } = useParams<{ apn: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [history, setHistory]   = useState<HistEvent[]>([]);
  const [owners, setOwners]     = useState<Owner[]>([]);
  const [loading, setLoading]   = useState(true);
  const [missing, setMissing]   = useState(false);

  useEffect(() => {
    if (!apn) return;
    setLoading(true);
    setMissing(false);
    (async () => {
      const [p, h, o] = await Promise.all([
        supabase.from('property_master').select('*').eq('apn', apn).maybeSingle(),
        supabase.from('property_history').select('event_type,event_date,data,source').eq('apn', apn).order('event_date', { ascending: true }),
        supabase.from('notable_owners').select('owner_name,owner_role,ownership_start,ownership_end,verification_status,notable_events').eq('apn', apn),
      ]);
      if (!p.data) { setMissing(true); setLoading(false); return; }
      setProperty(p.data as Property);
      setHistory((h.data || []) as HistEvent[]);
      setOwners((o.data || []) as Owner[]);
      setLoading(false);

      // SEO/AEO: meta + JSON-LD
      const addr = p.data.address ? `${p.data.address}, ${p.data.city || ''}` : `APN ${apn}`;
      document.title = `${addr} — Property DNA Ticker`;
      const setMeta = (n: string, c: string, prop = false) => {
        const attr = prop ? 'property' : 'name';
        let m = document.querySelector(`meta[${attr}="${n}"]`);
        if (!m) { m = document.createElement('meta'); m.setAttribute(attr, n); document.head.appendChild(m); }
        m.setAttribute('content', c);
      };
      const desc = `Live valuation, ownership timeline, and pedigree for ${addr}. ${p.data.architect_attribution ? `Architect: ${p.data.architect_attribution}. ` : ''}${p.data.has_provenance_dossier ? 'Verified provenance dossier on file. ' : ''}PropertyDNA — the genetic profile of every home.`;
      setMeta('description', desc);
      setMeta('og:title', `${addr} — Property DNA Ticker`, true);
      setMeta('og:description', desc, true);
      setMeta('og:type', 'website', true);
    })();
  }, [apn]);

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#94a3b8', display: 'grid', placeItems: 'center', fontFamily: 'system-ui' }}>Loading ticker…</div>;
  }
  if (missing || !property) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', display: 'grid', placeItems: 'center', fontFamily: 'system-ui', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 460 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: '#fafafa' }}>We don't have this property indexed yet.</div>
          <p style={{ color: '#94a3b8', marginTop: 12 }}>APN <code>{apn}</code> isn't in the PropertyDNA index. Try the pedigree index or run a DNA report on a different address.</p>
          <Link to="/pedigree-index" style={{ display: 'inline-block', marginTop: 18, padding: '12px 22px', background: '#fbbf24', color: '#0a0a0a', textDecoration: 'none', borderRadius: 4, fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>Browse the Pedigree Index →</Link>
        </div>
      </div>
    );
  }

  // Build chart points: assessment events with totalValue or similar
  const chartPoints = history
    .filter(h => h.event_type === 'assessment')
    .map(h => {
      const val = h.data?.totalValue ?? h.data?.assessedValue ?? h.data?.assessed_value ?? null;
      return val != null ? { date: h.event_date, value: Number(val) } : null;
    })
    .filter((p): p is { date: string; value: number } => p != null);

  const headlineValue = property.rentcast_value ?? property.tax_assessed_value ?? chartPoints[chartPoints.length - 1]?.value ?? null;
  const yoy = property.market_price_yoy;
  const tierColor = property.pedigree_tier ? TIER_BG[property.pedigree_tier] : 'linear-gradient(135deg, #475569 0%, #334155 100%)';
  const slug = `${property.address?.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Ticker symbol header (like a stock card) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
              PROPERTY · DNA · TICKER
            </div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 38, lineHeight: 1.05, margin: 0, color: '#fafafa', fontWeight: 400 }}>
              {property.address || `APN ${property.apn}`}
            </h1>
            <div style={{ color: '#94a3b8', marginTop: 8, fontSize: 14 }}>
              {[property.city, property.state, property.zip].filter(Boolean).join(', ')} <span style={{ color: '#475569', margin: '0 6px' }}>·</span> APN <code style={{ color: '#cbd5e1' }}>{property.apn}</code>
            </div>
          </div>
          {property.pedigree_tier && (
            <div style={{
              background: tierColor, padding: '12px 18px', borderRadius: 8, color: '#0a0a0a',
              fontWeight: 700, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center', minWidth: 140,
            }}>
              Tier {property.pedigree_tier}
              {property.provenance_score != null && (
                <div style={{ fontSize: 18, marginTop: 4 }}>{property.provenance_score}/100</div>
              )}
            </div>
          )}
        </div>

        {/* Big value row */}
        <div style={{ background: '#111827', borderRadius: 10, padding: 28, marginBottom: 24, borderLeft: '4px solid #fbbf24' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 48, color: '#fafafa', fontWeight: 400, letterSpacing: '-1px' }}>
              {fmtMoney(headlineValue)}
            </div>
            {yoy != null && (
              <div style={{ fontSize: 18, fontWeight: 600, color: yoy >= 0 ? '#34d399' : '#f87171' }}>
                {yoy >= 0 ? '▲' : '▼'} {Math.abs(yoy).toFixed(1)}% YoY
              </div>
            )}
            {property.rentcast_value_low != null && property.rentcast_value_high != null && (
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                52-week range: {fmtMoney(property.rentcast_value_low)} – {fmtMoney(property.rentcast_value_high)}
              </div>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 10 }}>
            {property.rentcast_value != null ? 'RentCast AVM' : property.tax_assessed_value != null ? `County assessment${property.tax_assessment_year ? ` (${property.tax_assessment_year})` : ''}` : 'Composite estimate'}
          </div>
        </div>

        {/* Key facts grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 36 }}>
          <Stat label="Beds"   value={fmtNum(property.beds)} />
          <Stat label="Baths"  value={fmtNum(property.baths)} />
          <Stat label="Sq Ft"  value={fmtNum(property.sqft)} />
          <Stat label="Lot"    value={property.lot_sqft ? `${property.lot_sqft.toLocaleString()} sqft` : '—'} />
          <Stat label="Built"  value={fmtNum(property.year_built)} />
          <Stat label="Type"   value={property.property_type || '—'} />
          <Stat label="Tax Assessed"  value={fmtMoney(property.tax_assessed_value)} />
          {property.tax_annual_amount != null && <Stat label="Annual Tax" value={fmtMoney(property.tax_annual_amount)} />}
        </div>

        {/* Valuation timeline chart */}
        {chartPoints.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>Assessment Timeline</h2>
            <ValueChart points={chartPoints} />
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
              {chartPoints.length} assessment event{chartPoints.length > 1 ? 's' : ''} on file · sourced from county assessor data
            </div>
          </section>
        )}

        {/* Provenance: architect */}
        {property.architect_attribution && (
          <section style={{ marginBottom: 28, background: '#111827', borderRadius: 8, padding: 22, borderLeft: '3px solid #fbbf24' }}>
            <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Architect</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#fafafa' }}>
              {property.architect_attribution}
              {property.architect_verified && <span style={{ color: '#34d399', fontSize: 12, marginLeft: 10 }}>✓ verified</span>}
            </div>
            <Link to={`/architect/${property.architect_attribution.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-')}`} style={{ color: '#fbbf24', fontSize: 13, marginTop: 8, display: 'inline-block', textDecoration: 'underline' }}>
              See full architect portfolio →
            </Link>
          </section>
        )}

        {/* Notable owners (provenance) */}
        {owners.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>Notable Owners</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {owners.map((o, i) => (
                <div key={i} style={{ background: '#111827', borderRadius: 6, padding: '14px 18px', borderLeft: '3px solid #a78bfa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: '#fafafa' }}>{o.owner_name}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      {(o.ownership_start || '').slice(0, 4)}{o.ownership_end ? `–${o.ownership_end.slice(0, 4)}` : '–present'}
                      {o.verification_status && <span style={{ marginLeft: 8, color: o.verification_status === 'verified' ? '#34d399' : '#fbbf24' }}>{o.verification_status}</span>}
                    </div>
                  </div>
                  {o.owner_role && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{o.owner_role}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* All history events */}
        {history.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>Activity Log</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {history.slice().reverse().slice(0, 10).map((h, i) => (
                <div key={i} style={{ background: '#0f172a', padding: '10px 14px', borderRadius: 4, display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: '#cbd5e1' }}>
                  <span style={{ color: '#94a3b8', minWidth: 92 }}>{h.event_date}</span>
                  <span style={{ flex: 1 }}><span style={{ color: '#fbbf24', textTransform: 'uppercase', fontSize: 10, letterSpacing: 1.5, marginRight: 8 }}>{h.event_type}</span>{h.data?.totalValue ? fmtMoney(h.data.totalValue) : h.data?.address || h.source || ''}</span>
                </div>
              ))}
            </div>
            {history.length > 10 && <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>{history.length - 10} more events on file (full timeline in the DNA report)</div>}
          </section>
        )}

        {/* Dossier link (if exists) */}
        {property.has_provenance_dossier && (
          <Link to={`/dossier/${property.apn}`} style={{ display: 'block', background: 'linear-gradient(135deg, #1f2937 0%, #0f172a 100%)', padding: '22px 24px', borderRadius: 8, border: '1px solid #fbbf24', marginBottom: 28, textDecoration: 'none' }}>
            <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Full Provenance Dossier</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#fafafa' }}>Open the verified primary-source dossier for this property →</div>
          </Link>
        )}

        {/* CTA — the monetization moment */}
        <section style={{ background: 'linear-gradient(135deg, #1f2937 0%, #0f172a 100%)', padding: '36px 28px', borderRadius: 10, textAlign: 'center', borderTop: '1px solid #1f2937' }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>The Full DNA Report</div>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 26, margin: '0 0 14px', color: '#fafafa', fontWeight: 400 }}>
            Comps, permits, valuation confidence, hazard, and rental demand — in 60 seconds.
          </h3>
          <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 540, margin: '0 auto 22px' }}>
            Every signal we have on {property.address || 'this address'}, packaged into one read. Your first report is free.
          </p>
          <Link to={`/analyze?address=${encodeURIComponent(property.address || '')}`} style={{ display: 'inline-block', padding: '14px 28px', background: '#fbbf24', color: '#0a0a0a', textDecoration: 'none', borderRadius: 4, fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
            Run the Full DNA Report →
          </Link>
        </section>

        <div style={{ marginTop: 36, textAlign: 'center', fontSize: 12, color: '#64748b' }}>
          PropertyDNA · {fmtNum(history.length)} events on file · sourced from county assessor + RentCast + primary-source archives
          <br />
          <span style={{ opacity: 0.7 }}>{slug}</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#111827', padding: '14px 16px', borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, color: '#fafafa', fontWeight: 500 }}>{value}</div>
    </div>
  );
}
