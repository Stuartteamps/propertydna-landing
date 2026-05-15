import { useState, useEffect, useCallback, lazy, Suspense, Component, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import PricingModal from '@/components/PricingModal';
import { computeDNAScore } from '@/lib/dnaScore';
import { NeighborhoodBreakdown } from '@/components/report/NeighborhoodBreakdown';
import LuxuryDossierSection from '@/components/LuxuryDossierSection';

// Lazy-load Leaflet — isolates any crash to just the map section
const ReportMap = lazy(() => import('@/components/report/ReportMap'));

// Error boundary — catches Leaflet crashes without killing the whole report
class MapErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  render() {
    if (this.state.crashed) return (
      <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', border: '1px solid rgba(255,255,255,0.08)', color: '#6B6252', fontFamily: 'Jost, sans-serif', fontSize: 13 }}>
        Map unavailable in this browser
      </div>
    );
    return this.props.children;
  }
}

interface ReportData {
  id: string;
  address: string;
  full_name: string;
  email: string;
  role: string;
  property_dna: any;
  created_at: string;
  status: string;
}

const fmt = (v: any) => (v && v !== '—' ? v : '—');

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 32, marginBottom: 40 }}>
    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 20 }}>
      {title}
    </div>
    {children}
  </div>
);

const Stat = ({ label, value, wide }: { label: string; value: string; wide?: boolean }) => (
  <div style={{ marginBottom: 20, width: wide ? '100%' : undefined }}>
    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 4 }}>{label}</div>
    <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 18, fontWeight: 300, color: '#F0EBE0' }}>{value}</div>
  </div>
);

const money = (v: number | null) => v ? `$${v.toLocaleString()}` : '—';

const ConfidenceBadge = ({ pct }: { pct?: number }) => {
  if (pct == null) return null;
  const color = pct >= 66 ? '#2D9142' : pct >= 33 ? '#C9A84C' : '#B85245';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14, background: '#111', border: `1px solid ${color}33`, padding: '4px 10px' }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
      <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color }}>
        {pct}% data confidence
      </span>
    </div>
  );
};

export default function ReportViewByToken() {
  const { token } = useParams<{ token: string }>();

  const [report,     setReport]     = useState<ReportData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [pending,    setPending]    = useState(false);
  const [error,      setError]      = useState('');
  const [pollCount,  setPollCount]  = useState(0);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [modalTab,   setModalTab]   = useState<'signin' | 'pricing'>('signin');
  const [pricingOpen,setPricingOpen]= useState(false);

  const fetchReport = useCallback(() => {
    if (!token) { setError('No report token provided.'); setLoading(false); return; }
    fetch(`/.netlify/functions/get-report-by-token?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then((data: any) => {
        if (data.status === 'pending' || data.status === 'generating') {
          setPending(true);
          return;
        }
        if (data.error) { setError(data.error); return; }
        // Parse if n8n double-encoded the DNA as a string
        if (typeof data.property_dna === 'string') {
          try { data.property_dna = JSON.parse(data.property_dna); } catch { /* already an object */ }
        }
        setPending(false);
        setReport(data);
      })
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }, [token]);

  // Initial load
  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Auto-poll every 20s while pending (up to 15 attempts = 5 min)
  useEffect(() => {
    if (!pending || pollCount >= 15) return;
    const t = setTimeout(() => {
      setPollCount(c => c + 1);
      setLoading(true);
      fetchReport();
    }, 20_000);
    return () => clearTimeout(t);
  }, [pending, pollCount, fetchReport]);

  const dna      = report?.property_dna ?? {};
  const dnaScore = computeDNAScore(dna);
  const n        = dna.normalized ?? {};
  const comps: any[] = n.comps ?? [];
  const flood  = n.flood ?? {};
  const demo   = n.demographics ?? {};
  const val    = n.valuation ?? {};
  const prop   = n.property ?? {};
  const sub    = n.subject ?? {};
  const sale   = n.sale ?? {};
  const weather = n.weather ?? {};
  const dnaAdj = dna.dnaAdjusted ?? null;

  // Handle both n8n key naming conventions (old: buyerAngle; new: buyerNarrative)
  const sellerAngle    = dna.sellerAngle    || dna.sellerNarrative    || '';
  const buyerAngle     = dna.buyerAngle     || dna.buyerNarrative     || '';
  const investAngle    = dna.investmentAngle || dna.investorNarrative  || '';
  const dataQualNote   = dna.dataQualityNote || dna.dataQualityDetails || (typeof dna.dataQuality === 'string' ? dna.dataQuality : '') || '';
  // subject.address fallback for older data
  const displayAddress = sub.matchedAddress || sub.address || report?.address || '';

  // v3 enrichment data (populated asynchronously by enrich-property.js)
  const enr = dna.enrichment ?? null;
  const hasEnrichment = !!enr?.v3_enriched;

  const subjectLat = sub.lat && sub.lat !== '—' ? Number(sub.lat) : null;
  const subjectLon = sub.lon && sub.lon !== '—' ? Number(sub.lon) : null;
  const hasMap = subjectLat && subjectLon;
  const compsWithCoords = comps.filter((c: any) => c.lat && c.lon);
  const priceRange = compsWithCoords.length > 0
    ? { min: Math.min(...compsWithCoords.map((c: any) => c.rawPrice || 0)), max: Math.max(...compsWithCoords.map((c: any) => c.rawPrice || 1)) }
    : { min: 0, max: 1 };

  const priceColor = (price: number) => {
    const pct = priceRange.max > priceRange.min ? (price - priceRange.min) / (priceRange.max - priceRange.min) : 0.5;
    const r = Math.round(201 * (1 - pct) + 45 * pct);
    const g = Math.round(76  * (1 - pct) + 106 * pct);
    const b = Math.round(76  * (1 - pct) + 74  * pct);
    return `rgb(${r},${g},${b})`;
  };

  const ratingColor: Record<string, string> = {
    'A+': '#2D9142', A: '#2D9142', 'A-': '#52B788',
    'B+': '#74C69D', B: '#95D5B2', 'B-': '#B7E4C7',
    'C+': '#C9A96E', C: '#B85245',
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '2px solid rgba(201,168,76,0.3)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#C9A84C' }}>Loading Report…</div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (pending) return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 24px' }}>
        <div style={{ width: 36, height: 36, border: '2px solid rgba(201,168,76,0.3)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 24px' }} />
        <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 32, color: '#F0EBE0', marginBottom: 12 }}>Report In Progress</div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: 'rgba(244,240,232,0.55)', lineHeight: 1.7, marginBottom: 8 }}>
          Your PropertyDNA report is being generated. This typically takes 2–4 minutes.
        </div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: 'rgba(201,168,76,0.5)', marginBottom: 28 }}>
          {pollCount > 0 ? `Auto-checking… (${pollCount}/15)` : 'This page checks automatically every 20 seconds.'}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { setLoading(true); setPollCount(0); fetchReport(); }} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '12px 24px', border: 'none', cursor: 'pointer' }}>
            Check Now →
          </button>
          <a href="/dashboard" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: '#F0EBE0', border: '1px solid rgba(255,255,255,0.15)', padding: '12px 24px', textDecoration: 'none', display: 'inline-block' }}>My Dashboard</a>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 24px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 32, color: '#F0EBE0', marginBottom: 12 }}>Report Not Found</div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: 'rgba(244,240,232,0.5)', marginBottom: 24, lineHeight: 1.7 }}>{error}</div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/dashboard" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '12px 24px', textDecoration: 'none', display: 'inline-block' }}>My Dashboard →</a>
          <a href="/" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: '#F0EBE0', border: '1px solid rgba(255,255,255,0.15)', padding: '12px 24px', textDecoration: 'none', display: 'inline-block' }}>New Report</a>
        </div>
      </div>
    </div>
  );

  // Guard: report loaded but has no DNA data
  if (!report || !report.property_dna || Object.keys(report.property_dna).length === 0) return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 24px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 32, color: '#F0EBE0', marginBottom: 12 }}>Report Processing</div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: 'rgba(244,240,232,0.55)', lineHeight: 1.7, marginBottom: 28 }}>
          Your report has been queued and will be ready shortly.<br />Check your email — we'll send it directly when complete.
        </div>
        <button onClick={() => window.location.reload()} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '14px 28px', border: 'none', cursor: 'pointer' }}>
          Check Again →
        </button>
        <div style={{ marginTop: 16 }}>
          <a href="/dashboard" style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: 'rgba(201,168,76,0.6)', textDecoration: 'none' }}>← Back to Dashboard</a>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background: '#0A0908', minHeight: '100vh', color: '#F0EBE0' }}>
      <Nav
        onSignInClick={() => { setModalTab('signin'); setModalOpen(true); }}
        onRequestAccessClick={() => setPricingOpen(true)}
      />
      <AuthModal isOpen={modalOpen} initialView={modalTab} onClose={() => setModalOpen(false)} />
      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} />

      {/* Header */}
      <section style={{ background: '#111', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '100px 48px 48px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 12 }}>
            PropertyDNA Intelligence Report
          </div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(28px,4vw,52px)', fontWeight: 300, color: '#F0EBE0', margin: '0 0 8px', lineHeight: 1.1 }}>
            {displayAddress || '—'}
          </h1>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', marginTop: 8 }}>
            Prepared for {fmt(n.client?.name)} · {new Date(report?.created_at ?? '').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>

          {/* PropertyDNA Score */}
          <div style={{ display: 'flex', gap: 24, marginTop: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {dna.rating && (
              <div style={{ background: ratingColor[dna.rating] || '#6B6252', color: '#fff', padding: '8px 20px', fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 300, alignSelf: 'center' }}>
                {dna.rating}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', width: 64, height: 64 }}>
                <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4"/>
                  <circle cx="32" cy="32" r="26" fill="none" stroke={dnaScore.hex} strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    strokeDashoffset={`${2 * Math.PI * 26 * (1 - dnaScore.total / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 300, color: '#F0EBE0' }}>{dnaScore.total}</span>
                </div>
              </div>
              <div>
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 3 }}>PropertyDNA Score</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, color: dnaScore.hex }}>{dnaScore.total}<span style={{ fontSize: 12, color: '#6B6252' }}>/100</span></div>
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: 'rgba(244,240,232,0.4)', marginTop: 2 }}>{dna.confidence || '—'}</div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              {dnaScore.categories.map(cat => (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: '#6B6252', width: 160, flexShrink: 0 }}>{cat.name}</div>
                  <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${cat.score}%`, height: '100%', background: cat.score >= 70 ? '#2D9142' : cat.score >= 45 ? '#C9A84C' : '#B85245' }} />
                  </div>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, color: '#6B6252', width: 24, textAlign: 'right' }}>{cat.score}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 48px 80px' }}>

        {dna.wouldWeBuyIt && (
          <div style={{ background: '#111', border: '1px solid rgba(201,168,76,0.2)', padding: 28, marginBottom: 40 }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#6B6252', marginBottom: 8 }}>Would We Buy It?</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: dna.wouldWeBuyIt === 'Yes' ? '#2D9142' : dna.wouldWeBuyIt === 'Maybe' ? '#C9A84C' : '#B85245', marginBottom: 12 }}>
              {dna.wouldWeBuyIt}
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300, color: '#F0EBE0', lineHeight: 1.8 }}>
              {dna.wouldWeBuyItReason}
            </div>
          </div>
        )}

        {dna.executiveSummary && (
          <Section title="Executive Summary">
            <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 15, fontWeight: 300, color: '#F0EBE0', lineHeight: 1.9, margin: 0 }}>{dna.executiveSummary}</p>
          </Section>
        )}

        <Section title="Property Vitals">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0 40px' }}>
            <Stat label="Property Type" value={fmt(prop.propertyType)} />
            <Stat label="Year Built"    value={fmt(prop.yearBuilt)} />
            <Stat label="Beds / Baths"  value={`${fmt(prop.beds)} bd / ${fmt(prop.baths)} ba`} />
            <Stat label="Square Footage" value={prop.sqft && prop.sqft !== '—' ? `${Number(prop.sqft).toLocaleString()} sqft` : '—'} />
            <Stat label="Lot Size"       value={prop.lotSize && prop.lotSize !== '—' ? `${Number(prop.lotSize).toLocaleString()} sqft` : '—'} />
            <Stat label="Last Sale"      value={sale.lastSaleDate ? sale.lastSaleDate.slice(0, 10) : '—'} />
            <Stat label="Last Sale Price" value={fmt(sale.lastSalePrice)} />
          </div>
        </Section>

        {/* Valuation — Raw Comp Range */}
        <Section title="Valuation">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 40px' }}>
            <Stat label="Market Value" value={fmt(val.marketValue)} />
            <Stat label="Range Low"    value={fmt(val.low)} />
            <Stat label="Range High"   value={fmt(val.high)} />
          </div>
        </Section>

        {/* DNA Adjusted Valuation */}
        {dnaAdj && (
          <Section title="DNA Adjusted Valuation">
            <div style={{ background: '#111', border: '1px solid rgba(201,168,76,0.15)', padding: 24, marginBottom: 24 }}>
              {dnaAdj.baseAdjustment && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(201,168,76,0.07)', borderLeft: '2px solid rgba(201,168,76,0.4)' }}>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 4 }}>
                    Sale-Anchored Base
                  </div>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: 'rgba(244,240,232,0.65)', lineHeight: 1.6 }}>
                    {dnaAdj.baseAdjustment.label}
                  </div>
                  {dnaAdj.baseAdjustment.gapPct != null && (
                    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', marginTop: 4 }}>
                      AVM was {Math.abs(dnaAdj.baseAdjustment.gapPct)}% below appreciated sale — smart base applied
                    </div>
                  )}
                </div>
              )}
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', marginBottom: 16 }}>
                Adjusted for detected property features, sale history, and market appreciation.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 40px', marginBottom: 16 }}>
                <Stat label="DNA Adjusted Low"  value={money(dnaAdj.adjLow)} />
                <Stat label="DNA Adjusted Mid"  value={money(dnaAdj.adjMid)} />
                <Stat label="DNA Adjusted High" value={money(dnaAdj.adjHigh)} />
              </div>
              {dnaAdj.aduUplift && (
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#74C69D', marginBottom: 12 }}>
                  Includes ADU/Casita uplift: +{money(dnaAdj.aduUplift)}
                </div>
              )}
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', marginBottom: dnaAdj.drivers?.length ? 16 : 0 }}>
                Confidence Score: {dnaAdj.confidence ? `${Math.round(dnaAdj.confidence * 100)}%` : '—'}
              </div>
              {dnaAdj.drivers && dnaAdj.drivers.length > 0 && (
                <div>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 10 }}>Key Adjustment Drivers</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {dnaAdj.drivers.map((d: any) => (
                      <div key={d.key} style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', padding: '6px 12px' }}>
                        {d.pct != null ? (
                          <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: d.pct > 0 ? '#74C69D' : '#B85245' }}>
                            {d.pct > 0 ? '+' : ''}{d.pct}%
                          </span>
                        ) : d.dollar != null ? (
                          <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#74C69D' }}>
                            +{money(d.dollar)}
                          </span>
                        ) : null}
                        <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', marginLeft: 6 }}>
                          {d.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {hasMap && (
          <Section title="Sales Activity Map">
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', marginBottom: 16 }}>
              Subject property shown in gold. Comparable sales sized and colored by price.
            </div>
            <div style={{ height: 420, borderRadius: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              <MapErrorBoundary>
                <Suspense fallback={<div style={{ height: '100%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6252', fontFamily: 'Jost, sans-serif', fontSize: 12 }}>Loading map…</div>}>
                  <ReportMap
                    lat={subjectLat!} lon={subjectLon!}
                    address={displayAddress}
                    comps={comps}
                    priceColor={priceColor}
                  />
                </Suspense>
              </MapErrorBoundary>
            </div>
            {comps.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Address', 'Price', 'Size', 'Beds', 'Distance'].map(h => (
                        <th key={h} style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', textAlign: 'left', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comps.map((c: any, i: number) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#F0EBE0', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{c.address}</td>
                        <td style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 15, color: '#C9A84C', padding: '10px 16px 10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{c.price}</td>
                        <td style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', padding: '10px 16px 10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{c.sqft}</td>
                        <td style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', padding: '10px 16px 10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{c.beds}</td>
                        <td style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{c.distance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {/* Neighborhood Profile — uses synthesized data with Census ACS fallback */}
        {(() => {
          const nh = (dna.neighborhood || n.neighborhood) ?? null;
          const d  = nh || demo; // prefer synthesized
          const hasData = (d.medianIncome && d.medianIncome !== '—') || (d.population && d.population !== '—');
          if (!hasData) return null;
          return (
            <Section title="Neighborhood Profile">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0 40px' }}>
                <Stat label="Median Income"     value={fmt(d.medianIncome)} />
                <Stat label="Median Home Value" value={fmt(d.medianHomeValue)} />
                <Stat label="Median Rent"       value={fmt(d.medianRent)} />
                <Stat label="Population"        value={fmt(d.population)} />
                <Stat label="Owner Occupied"    value={fmt(d.ownerOccupied)} />
                <Stat label="Renter Occupied"   value={fmt(d.renterOccupied)} />
                <Stat label="College Educated"  value={fmt(d.collegePct)} />
              </div>
              <div style={{ marginTop: 12, fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#F0EBE0', lineHeight: 1.7 }}>
                {nh?.summary || `${d.ownershipStability || demo.neighborhoodTrend || 'Stable Neighborhood'} · ${demo.mobilityRate || ''}`}
              </div>
              <div style={{ marginTop: 8, fontFamily: 'Jost, sans-serif', fontSize: 10, color: '#6B6252', letterSpacing: 1 }}>
                Source: {d.source || 'Census ACS 2022 5-year'}
              </div>
            </Section>
          );
        })()}

        {/* Luxury Provenance Dossier — only renders if has_provenance_dossier=true */}
        {(report?.apn || prop?.apn || sub?.apn) && (
          <LuxuryDossierSection apn={((report as any)?.apn || prop?.apn || sub?.apn || '').replace(/[^0-9]/g, '')} />
        )}

        {/* Assessor Neighborhood Comparison — same block vs city */}
        {(report?.apn || prop?.apn || sub?.apn) && (
          <Section title="Assessor Neighborhood Breakdown">
            <NeighborhoodBreakdown
              apn={((report as any)?.apn || prop?.apn || sub?.apn || '').replace(/[^0-9]/g, '')}
              city={prop?.city || sub?.city || undefined}
            />
          </Section>
        )}

        {/* Risk Profile — 4 hazards with overall score */}
        {(() => {
          const risk = dna.risk || n.risk || null;
          if (!risk) return null;
          const colorFor = (s: number) => s >= 75 ? '#B85245' : s >= 55 ? '#C9A84C' : s >= 30 ? '#74C69D' : '#2D9142';
          const Card = ({ label, score, value, sub, source }: any) => (
            <div style={{ background: '#111', border: `1px solid ${colorFor(score)}33`, padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252' }}>{label}</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, color: colorFor(score) }}>{score}</div>
              </div>
              <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 16, color: '#F0EBE0', marginBottom: sub ? 6 : 0 }}>{value}</div>
              {sub && <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', lineHeight: 1.55 }}>{sub}</div>}
              {source && <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, color: '#6B6252', marginTop: 8, letterSpacing: 1 }}>Source: {source}</div>}
            </div>
          );
          return (
            <Section title="Risk Profile">
              <div style={{ background: '#0d0d0d', border: '1px solid rgba(201,168,76,0.15)', padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252' }}>Overall Risk</div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: colorFor(risk.overallScore) }}>{risk.overallRating}</div>
                </div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 38, color: colorFor(risk.overallScore) }}>{risk.overallScore}<span style={{ fontSize: 14, color: '#6B6252' }}>/100</span></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <Card label="FEMA Flood" score={risk.flood.score} value={`Zone ${risk.flood.zone}`} sub={risk.flood.label + (risk.flood.highRisk ? ' — SFHA' : '')} source={risk.flood.source} />
                <Card label="Earthquake — USGS" score={risk.earthquake.score} value={risk.earthquake.label} sub={risk.earthquake.summary} source={risk.earthquake.source} />
                <Card label="Wildfire — CalFire" score={risk.wildfire.score} value={risk.wildfire.label} sub={risk.wildfire.summary} source={risk.wildfire.source} />
                <Card label="Crime" score={risk.crime.score} value={risk.crime.label} sub={`${risk.crime.city} · ${risk.crime.reportingAgency}`} />
              </div>
              {risk.earthquake.faultDistance && (
                <div style={{ marginTop: 16, padding: 14, background: 'rgba(184,82,69,0.06)', borderLeft: '2px solid #B85245' }}>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#B85245', marginBottom: 4 }}>Seismic Note</div>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#F0EBE0', lineHeight: 1.6 }}>
                    {risk.earthquake.faultDistance}. Peak ground acceleration: {risk.earthquake.pga2pct50yr || '—'}.
                  </div>
                </div>
              )}
            </Section>
          );
        })()}

        {n.crime?.available && (
          <Section title="Crime Statistics — FBI UCR">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: '0 40px', marginBottom: 8 }}>
              <Stat label="Violent Crime Rate"   value={`${n.crime.violentCrimeRatePer100k} per 100K`} />
              <Stat label="Property Crime Rate"  value={`${n.crime.propertyCrimeRatePer100k} per 100K`} />
              <Stat label="Reporting Agency"     value={n.crime.agencyName || '—'} />
              <Stat label="Data Year"            value={n.crime.year || '2022'} />
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252' }}>Source: {n.crime.source} · {n.crime.note}</div>
          </Section>
        )}

        {n.incidents?.available && (
          <Section title={`Crime & Safety — ${n.incidents.radius} Radius`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0 40px', marginBottom: 20 }}>
              <Stat label="Incidents (Last 6 Mo)" value={String(n.incidents.totalLast6Mo)} />
              <Stat label="Monthly Average"        value={n.incidents.monthlyAvg} />
              <Stat label="Data Source"            value="SpotCrime" />
            </div>
            {n.incidents.byType && Object.keys(n.incidents.byType).length > 0 && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {Object.entries(n.incidents.byType as Record<string,number>).sort(([,a],[,b]) => b - a).map(([type, count]) => (
                  <div key={type} style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 16px' }}>
                    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252' }}>{type}</div>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: '#F0EBE0' }}>{count}</div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {n.permits?.available && (
          <Section title="Permit History">
            <div style={{ marginBottom: 16, fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252' }}>
              {n.permits.total} total permits on record · Source: BuildZoom
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Description', 'Date', 'Value', 'Status'].map(h => (
                    <th key={h} style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', textAlign: 'left', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(n.permits.recent || []).map((p: any, i: number) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#F0EBE0', padding: '10px 16px 10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{p.description}</td>
                    <td style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', padding: '10px 16px 10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{p.date}</td>
                    <td style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#C9A84C', padding: '10px 16px 10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{p.value}</td>
                    <td style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {(sellerAngle || buyerAngle || investAngle) && (
          <Section title="Analysis">
            {[['Seller Perspective', sellerAngle], ['Buyer Perspective', buyerAngle], ['Investment Angle', investAngle]].map(([label, text]) =>
              text ? (
                <div key={label as string} style={{ marginBottom: 28 }}>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 6 }}>{label}</div>
                  <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300, color: '#F0EBE0', lineHeight: 1.9, margin: 0 }}>{text}</p>
                </div>
              ) : null
            )}
          </Section>
        )}

        {weather.summary && weather.summary !== '—' && (
          <Section title="Location & Climate">
            <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: '#F0EBE0', lineHeight: 1.8, margin: 0 }}>{weather.summary}</p>
          </Section>
        )}

        {dataQualNote && (
          <Section title="Data Quality Note">
            <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.7, margin: 0 }}>{dataQualNote}</p>
          </Section>
        )}

        {/* ── v3 ENRICHMENT SECTIONS ── */}

        {/* Location Intelligence */}
        {hasEnrichment && (
          <Section title="Location Intelligence">
            <ConfidenceBadge pct={enr.locationIntelligence?._confidence} />
            <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#F0EBE0', lineHeight: 1.8, margin: '0 0 20px' }}>
              {enr.locationIntelligence?._interpretation || 'Location data unavailable.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0 40px' }}>
              {enr.locationIntelligence?.walkScore?.walkScore != null && (
                <Stat label="Walk Score" value={`${enr.locationIntelligence.walkScore.walkScore}/100`} />
              )}
              {enr.locationIntelligence?.walkScore?.transitScore != null && (
                <Stat label="Transit Score" value={`${enr.locationIntelligence.walkScore.transitScore}/100`} />
              )}
              {enr.locationIntelligence?.walkScore?.bikeScore != null && (
                <Stat label="Bike Score" value={`${enr.locationIntelligence.walkScore.bikeScore}/100`} />
              )}
              {enr.locationIntelligence?.amenities?.schoolsNearby != null && (
                <Stat label="Schools Nearby (1mi)" value={String(enr.locationIntelligence.amenities.schoolsNearby)} />
              )}
              {enr.locationIntelligence?.amenities?.parksNearby != null && (
                <Stat label="Parks Nearby (1.5mi)" value={String(enr.locationIntelligence.amenities.parksNearby)} />
              )}
              {enr.locationIntelligence?.amenities?.transitStopsNearby != null && (
                <Stat label="Transit Stops" value={String(enr.locationIntelligence.amenities.transitStopsNearby)} />
              )}
              {enr.locationIntelligence?.amenities?.groceryStoresNearby != null && (
                <Stat label="Grocery Stores" value={String(enr.locationIntelligence.amenities.groceryStoresNearby)} />
              )}
            </div>
          </Section>
        )}

        {/* Market & Rental Analysis */}
        {hasEnrichment && (
          <Section title="Market & Rental Analysis">
            <ConfidenceBadge pct={enr.marketData?._confidence} />
            <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#F0EBE0', lineHeight: 1.8, margin: '0 0 20px' }}>
              {enr.marketData?._interpretation || 'Market data unavailable.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 40px', marginBottom: 16 }}>
              {enr.marketData?.fred?.mortgage30YrRate != null && (
                <Stat label="30-Yr Mortgage Rate (FRED)" value={`${enr.marketData.fred.mortgage30YrRate}%`} />
              )}
              {enr.marketData?.fred?.nationalHPIYoyPct != null && (
                <Stat label="National HPI YoY (Case-Shiller)" value={`${enr.marketData.fred.nationalHPIYoyPct > 0 ? '+' : ''}${enr.marketData.fred.nationalHPIYoyPct}%`} />
              )}
              {enr.marketData?.hud?.fmrTwoBed != null && (
                <Stat label="HUD Fair Market Rent (2-bed)" value={`$${Number(enr.marketData.hud.fmrTwoBed).toLocaleString()}/mo`} />
              )}
              {enr.marketData?.hud?.fmrThreeBed != null && (
                <Stat label="HUD Fair Market Rent (3-bed)" value={`$${Number(enr.marketData.hud.fmrThreeBed).toLocaleString()}/mo`} />
              )}
              {enr.marketData?.census?.medianHouseholdIncome != null && (
                <Stat label="Census Median HH Income" value={`$${Number(enr.marketData.census.medianHouseholdIncome).toLocaleString()}`} />
              )}
              {enr.marketData?.census?.medianHomeValue != null && (
                <Stat label="Census Median Home Value" value={`$${Number(enr.marketData.census.medianHomeValue).toLocaleString()}`} />
              )}
              {enr.marketData?.census?.medianGrossRent != null && (
                <Stat label="Census Median Gross Rent" value={`$${Number(enr.marketData.census.medianGrossRent).toLocaleString()}/mo`} />
              )}
              {enr.marketData?.census?.totalPopulation != null && (
                <Stat label="Tract Population (ZIP)" value={Number(enr.marketData.census.totalPopulation).toLocaleString()} />
              )}
            </div>
            {/* Rental yield card */}
            {enr.rentalAnalysis?._interpretation && (
              <div style={{ background: '#111', border: '1px solid rgba(201,168,76,0.15)', padding: 20, marginTop: 8 }}>
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 8 }}>Rental Yield Estimate</div>
                <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#F0EBE0', lineHeight: 1.8, margin: 0 }}>
                  {enr.rentalAnalysis._interpretation}
                </p>
              </div>
            )}
          </Section>
        )}

        {/* Extended Hazard & Environmental */}
        {hasEnrichment && (
          <Section title="Extended Hazard & Environmental Profile">
            <ConfidenceBadge pct={enr.hazardEnrichment?._confidence} />
            <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#F0EBE0', lineHeight: 1.8, margin: '0 0 20px' }}>
              {enr.hazardEnrichment?._interpretation || 'Extended hazard data unavailable.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0 40px' }}>
              {enr.hazardEnrichment?.seismic?.seismicRiskLevel && (
                <Stat label="Seismic Risk (USGS)" value={enr.hazardEnrichment.seismic.seismicRiskLevel} />
              )}
              {enr.hazardEnrichment?.seismic?.peakGroundAcceleration != null && (
                <Stat label="Peak Ground Accel." value={`${enr.hazardEnrichment.seismic.peakGroundAcceleration}g`} />
              )}
              {enr.hazardEnrichment?.environmental?.ejIndexPctile != null && (
                <Stat label="EPA EJ Index Pctile" value={`${enr.hazardEnrichment.environmental.ejIndexPctile.toFixed(0)}th`} />
              )}
              {enr.hazardEnrichment?.environmental?.pm25Pctile != null && (
                <Stat label="PM2.5 Percentile" value={`${enr.hazardEnrichment.environmental.pm25Pctile.toFixed(0)}th`} />
              )}
              {enr.hazardEnrichment?.airQuality?.aqi != null && (
                <Stat label="Air Quality Index (AirNow)" value={`${enr.hazardEnrichment.airQuality.aqi} — ${enr.hazardEnrichment.airQuality.aqiCategory || ''}`.trim()} />
              )}
              {enr.hazardEnrichment?.femaFlood?.zone && (
                <Stat label="FEMA Flood Zone (v3)" value={`Zone ${enr.hazardEnrichment.femaFlood.zone}`} />
              )}
            </div>
          </Section>
        )}

        {/* Neighborhood Trajectory */}
        {hasEnrichment && enr.neighborhoodTrajectory?._interpretation && (
          <Section title="Neighborhood Trajectory">
            <ConfidenceBadge pct={enr.neighborhoodTrajectory?._confidence} />
            <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#F0EBE0', lineHeight: 1.8, margin: '0 0 20px' }}>
              {enr.neighborhoodTrajectory._interpretation}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 40px' }}>
              {enr.neighborhoodTrajectory?.laborMarket?.stateUnemploymentRate != null && (
                <Stat label={`${enr.neighborhoodTrajectory.laborMarket.stateAbbr} Unemployment Rate (BLS)`} value={`${enr.neighborhoodTrajectory.laborMarket.stateUnemploymentRate}%`} />
              )}
              {enr.neighborhoodTrajectory?.nationalHousing?.hpiYoyPct != null && (
                <Stat label="National HPI Change YoY" value={`${enr.neighborhoodTrajectory.nationalHousing.hpiYoyPct > 0 ? '+' : ''}${enr.neighborhoodTrajectory.nationalHousing.hpiYoyPct}%`} />
              )}
            </div>
          </Section>
        )}

        {/* Data Source Confidence Panel */}
        {hasEnrichment && enr.sourceStatuses && (
          <Section title="v3 Data Source Status">
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', marginBottom: 16 }}>
              All sources queried in parallel. Failed sources do not affect report generation.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(enr.sourceStatuses as Record<string, string>).map(([src, status]) => (
                <div key={src} style={{
                  background: '#111', border: `1px solid ${status === 'success' ? 'rgba(45,145,66,0.3)' : status === 'unavailable' ? 'rgba(255,255,255,0.08)' : 'rgba(184,82,69,0.3)'}`,
                  padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'success' ? '#2D9142' : status === 'unavailable' ? '#6B6252' : '#B85245', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: '#6B6252', letterSpacing: 1 }}>
                    {src.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: status === 'success' ? '#2D9142' : status === 'unavailable' ? '#6B6252' : '#B85245' }}>
                    {status}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252' }}>
              Enriched {enr.enriched_at ? new Date(enr.enriched_at).toLocaleString() : ''}
            </div>
          </Section>
        )}

        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, lineHeight: 1.7 }}>
          This report is generated from third-party data and is for informational purposes only. Not a licensed appraisal or legal advice. © {new Date().getFullYear()} PropertyDNA.
        </div>
      </div>

      <Footer />
    </div>
  );
}
