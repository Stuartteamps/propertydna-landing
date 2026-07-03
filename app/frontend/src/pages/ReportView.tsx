import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import PricingModal from '@/components/PricingModal';
import { TierGate } from '@/components/valuation/TierGate';
import { MarketTrendPanel } from '@/components/valuation/MarketTrendPanel';
import { LocationScorePanel } from '@/components/valuation/LocationScorePanel';
import { PropertyEventsPanel } from '@/components/valuation/PropertyEventsPanel';
import { AdjustmentFactorPanel } from '@/components/valuation/AdjustmentFactorPanel';
import { MlsSourcePanel } from '@/components/report/MlsSourcePanel';
import { NeighborhoodBreakdown } from '@/components/report/NeighborhoodBreakdown';
import LuxuryDossierSection from '@/components/LuxuryDossierSection';
import { planToTier, fetchUserTier, TIER_LABELS, type Tier } from '@/lib/tier';
import { computeDNAScore } from '@/lib/dnaScore';
import { isNative, tapHaptic, shareSheet, successHaptic, openNativeMap, indexReportInSpotlight } from '@/lib/nativeFeatures';
import { saveReportOffline, listSavedReports, removeSavedReport } from '@/lib/offlineReports';

// Fix Leaflet default icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_KTTgVO3mROxubE_A9OQ7Kg_aRrnzPVT';

interface ReportData {
  id: string;
  address: string;
  full_name: string;
  email: string;
  role: string;
  property_dna: any;
  created_at: string;
  // IDX/MLS fields
  idx_url?: string | null;
  mls_number?: string | null;
  listing_source?: string | null;
  listing_agent?: string | null;
  listing_brokerage?: string | null;
  mls_enrichment_status?: string | null;
  apn?: string | null;
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

export default function ReportView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const reportId = id || searchParams.get('id');

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'signin' | 'pricing'>('signin');
  const [pricingOpen, setPricingOpen] = useState(false);

  // Tier state
  const [userTier, setUserTier] = useState<Tier>('free');
  const [reportCount, setReportCount] = useState(0);
  const [tierEmail, setTierEmail] = useState('');
  const [showTierPrompt, setShowTierPrompt] = useState(false);
  const [tierCheckEmail, setTierCheckEmail] = useState('');
  const [tierChecking, setTierChecking] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [sharing, setSharing] = useState(false);

  // First-report Enterprise preview: anyone on the free tier with ≤1 lifetime
  // reports sees every section (heat-map intel, micro-location, full adjustments,
  // event timeline) on their first report only. Paid users always see the full set.
  const isFirstReportPreview = userTier === 'free' && reportCount <= 1;
  const effectiveTier: Tier = isFirstReportPreview ? 'enterprise' : userTier;

  useEffect(() => {
    if (!reportId) { setError('No report ID provided.'); setLoading(false); return; }
    fetch(`${SUPA_URL}/rest/v1/reports?id=eq.${reportId}&select=*`, {
      headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` },
    })
      .then(r => r.json())
      .then((rows: ReportData[]) => {
        if (!rows || !rows.length) { setError('Report not found.'); return; }
        const row = rows[0];
        if (typeof row.property_dna === 'string') {
          try { row.property_dna = JSON.parse(row.property_dna); } catch { /* already an object */ }
        }
        setReport(row);
      })
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }, [reportId]);

  // Tier detection: sessionStorage email → check-usage
  useEffect(() => {
    const urlEmail = searchParams.get('email') || '';
    let email = '';
    try { email = urlEmail || sessionStorage.getItem('pdna_email') || ''; } catch { /* sessionStorage unavailable */ }
    if (!email) return;
    setTierEmail(email);
    setTierCheckEmail(email);
    fetchUserTier(email).then(({ tier, reportCount: rc }) => {
      setUserTier(tier);
      setReportCount(rc);
    });
  }, []);

  const handleTierCheck = async () => {
    if (!tierCheckEmail.includes('@')) return;
    setTierChecking(true);
    const { tier, reportCount: rc } = await fetchUserTier(tierCheckEmail);
    setUserTier(tier);
    setReportCount(rc);
    setTierEmail(tierCheckEmail);
    try { sessionStorage.setItem('pdna_email', tierCheckEmail.toLowerCase().trim()); } catch { /* sessionStorage unavailable */ }
    setShowTierPrompt(false);
    setTierChecking(false);
  };

  // Track whether this report is already cached offline on this device, and
  // auto-cache it silently on native so users always have something available
  // when they go offline in the field — mission-critical for the iOS/Android
  // app, where a buyer/seller often walks into a showing without signal.
  useEffect(() => {
    if (!reportId || !isNative() || !report) return;
    listSavedReports().then(list => {
      const already = list.some(r => r.id === reportId);
      setSavedOffline(true);
      if (!already) {
        saveReportOffline({
          id: reportId,
          address: report.address || 'PropertyDNA Report',
          savedAt: Date.now(),
          reportUrl: `/report/${reportId}`,
        }).catch(() => { /* best-effort cache */ });
      }
    });

    // Index the report in iOS Spotlight so it's discoverable from the home
    // screen pull-down search — pure native, impossible on web.
    indexReportInSpotlight({
      id: reportId,
      address: report.address || 'PropertyDNA Report',
      dnaScore: typeof dnaScore?.total === 'number' ? dnaScore.total : undefined,
      rating: dna?.rating,
      reportUrl: `/report/${reportId}`,
    });
  }, [reportId, report]);

  const handleOpenNativeMap = () => {
    if (!hasMap) return;
    tapHaptic();
    openNativeMap(subjectLat as number, subjectLon as number, report?.address || 'Subject Property');
  };

  const handleSaveOffline = async () => {
    if (!reportId || !report) return;
    await tapHaptic();
    if (savedOffline) {
      await removeSavedReport(reportId);
      setSavedOffline(false);
      return;
    }
    await saveReportOffline({
      id: reportId,
      address: report.address || 'PropertyDNA Report',
      savedAt: Date.now(),
      reportUrl: `/report/${reportId}`,
    });
    setSavedOffline(true);
    await successHaptic();
  };

  const handleShare = async () => {
    if (!report) return;
    setSharing(true);
    await tapHaptic();
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const presented = await shareSheet({
      title: 'PropertyDNA Intelligence Report',
      text: `${report.address} — PropertyDNA report`,
      url,
      dialogTitle: 'Share this property report',
    });
    if (!presented && url && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
      } catch { /* clipboard unavailable */ }
    }
    setSharing(false);
  };

  const dna = report?.property_dna ?? {};
  const dnaScore = computeDNAScore(dna);
  const n = dna.normalized ?? {};
  const comps: any[] = n.comps ?? [];
  const flood = n.flood ?? {};
  const demo = n.demographics ?? {};
  const val = n.valuation ?? {};
  const prop = n.property ?? {};
  const sub = n.subject ?? {};
  const sale = n.sale ?? {};
  const weather = n.weather ?? {};
  const hazard = n.hazard ?? {};
  const nwsAlerts: any[] = n.nwsAlerts ?? [];

  // Extract zip for market snapshot lookup
  const reportZip = (report?.address || sub.matchedAddress || '').match(/\b\d{5}\b/)?.[0] || '';
  const reportNeighborhood = demo.neighborhood || n.neighborhood || '';

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
    const g = Math.round(76 * (1 - pct) + 106 * pct);
    const b = Math.round(76 * (1 - pct) + 74 * pct);
    return `rgb(${r},${g},${b})`;
  };

  const ratingColor: Record<string, string> = {
    'A+': '#2D6A4F', A: '#2D6A4F', 'A-': '#40916C',
    'B+': '#74C69D', B: '#95D5B2', 'B-': '#B7E4C7',
    'C+': '#C9A96E', C: '#A07850',
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '2px solid rgba(201,168,76,0.3)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#C9A84C' }}>Loading Report…</div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
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

  // Guard: no report data
  if (!report || !report.property_dna || Object.keys(report.property_dna).length === 0) return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 24px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 32, color: '#F0EBE0', marginBottom: 12 }}>Report Processing</div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: 'rgba(244,240,232,0.55)', lineHeight: 1.7, marginBottom: 28 }}>
          Your report has been queued and will be delivered to your email shortly.
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => window.location.reload()} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '12px 24px', border: 'none', cursor: 'pointer' }}>Check Again →</button>
          <a href="/dashboard" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#F0EBE0', border: '1px solid rgba(255,255,255,0.15)', padding: '12px 24px', textDecoration: 'none', display: 'inline-block' }}>My Dashboard</a>
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
            {sub.matchedAddress !== '—' ? sub.matchedAddress : report?.address}
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
            {/* Score ring */}
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
            {/* Category breakdown */}
            <div style={{ flex: 1, minWidth: 200 }}>
              {dnaScore.categories.map(cat => (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: '#6B6252', width: 160, flexShrink: 0 }}>{cat.name}</div>
                  <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${cat.score}%`, height: '100%', background: cat.score >= 70 ? '#2D9142' : cat.score >= 45 ? '#C9A84C' : '#B85245', transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, color: '#6B6252', width: 24, textAlign: 'right' }}>{cat.score}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 48px 80px' }}>

        {/* Report actions — Share + Save Offline. Native gets buttons that hit OS share + offline cache; web shows Share (Web Share API or copy-link). */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
          <button
            onClick={handleShare}
            disabled={sharing}
            style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: '#000', background: '#C9A84C', border: 'none', padding: '11px 20px', cursor: sharing ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
              <path d="M16 6l-4-4-4 4" />
              <path d="M12 2v14" />
            </svg>
            {sharing ? 'Opening…' : 'Share Report'}
          </button>
          {isNative() && (
            <button
              onClick={handleSaveOffline}
              style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: savedOffline ? '#C9A84C' : '#F0EBE0', background: 'transparent', border: `1px solid ${savedOffline ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.15)'}`, padding: '11px 20px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={savedOffline ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
              </svg>
              {savedOffline ? 'Saved Offline' : 'Save for Offline'}
            </button>
          )}
        </div>

        {/* Would We Buy It */}
        {dna.wouldWeBuyIt && (
          <div style={{ background: '#111', border: '1px solid rgba(201,168,76,0.2)', padding: 28, marginBottom: 40 }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#6B6252', marginBottom: 8 }}>Would We Buy It?</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: dna.wouldWeBuyIt === 'Yes' ? '#2D6A4F' : dna.wouldWeBuyIt === 'Maybe' ? '#C9A84C' : '#A07850', marginBottom: 12 }}>
              {dna.wouldWeBuyIt}
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300, color: '#F0EBE0', lineHeight: 1.8 }}>
              {dna.wouldWeBuyItReason}
            </div>
          </div>
        )}

        {/* Executive Summary */}
        {dna.executiveSummary && (
          <Section title="Executive Summary">
            <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 15, fontWeight: 300, color: '#F0EBE0', lineHeight: 1.9, margin: 0 }}>{dna.executiveSummary}</p>
          </Section>
        )}

        {/* Property Vitals */}
        <Section title="Property Vitals">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0 40px' }}>
            <Stat label="Property Type" value={fmt(prop.propertyType)} />
            <Stat label="Year Built" value={fmt(prop.yearBuilt)} />
            <Stat label="Beds / Baths" value={`${fmt(prop.beds)} bd / ${fmt(prop.baths)} ba`} />
            <Stat label="Square Footage" value={prop.sqft && prop.sqft !== '—' ? `${Number(prop.sqft).toLocaleString()} sqft` : '—'} />
            <Stat label="Lot Size" value={prop.lotSize && prop.lotSize !== '—' ? `${Number(prop.lotSize).toLocaleString()} sqft` : '—'} />
            <Stat label="Last Sale" value={sale.lastSaleDate ? sale.lastSaleDate.slice(0, 10) : '—'} />
            <Stat label="Last Sale Price" value={fmt(sale.lastSalePrice)} />
          </div>
        </Section>

        {/* Valuation */}
        <Section title="Valuation">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 40px' }}>
            <Stat label="Market Value" value={fmt(val.marketValue)} />
            <Stat label="Range Low" value={fmt(val.low)} />
            <Stat label="Range High" value={fmt(val.high)} />
          </div>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', marginTop: 4 }}>
            Confidence: {fmt(val.confidence)}
          </div>
        </Section>

        {/* Heat Map */}
        {hasMap && (
          <Section title="Sales Activity Map">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252' }}>
                Subject property shown in gold. Comparable sales sized and colored by price — larger/darker = higher value.
              </div>
              {isNative() && (
                <button
                  onClick={handleOpenNativeMap}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: '#000', background: '#C9A84C', border: 'none', padding: '9px 14px', cursor: 'pointer' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6 9 4l6 2 6-2v14l-6 2-6-2-6 2V6z" />
                    <path d="M9 4v16M15 6v16" />
                  </svg>
                  Open in Maps
                </button>
              )}
            </div>
            <div style={{ height: 420, borderRadius: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              <MapContainer
                center={[subjectLat!, subjectLon!]}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='© <a href="https://carto.com/">CARTO</a>'
                />
                {/* Comparable sales */}
                {compsWithCoords.map((comp: any, i: number) => (
                  <CircleMarker
                    key={i}
                    center={[Number(comp.lat), Number(comp.lon)]}
                    radius={8 + Math.min(16, (comp.rawPrice || 500000) / 100000)}
                    pathOptions={{ color: '#C9A84C', fillColor: priceColor(comp.rawPrice || 500000), fillOpacity: 0.75, weight: 1 }}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'sans-serif', fontSize: 13 }}>
                        <strong>{fmt(comp.address)}</strong><br />
                        {fmt(comp.price)} · {fmt(comp.sqft)} · {fmt(comp.distance)}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
                {/* Subject property */}
                <CircleMarker
                  center={[subjectLat!, subjectLon!]}
                  radius={14}
                  pathOptions={{ color: '#C9A84C', fillColor: '#C9A84C', fillOpacity: 1, weight: 2 }}
                >
                  <Popup>
                    <strong>Subject Property</strong><br />
                    {sub.matchedAddress}
                  </Popup>
                </CircleMarker>
              </MapContainer>
            </div>
            {comps.length === 0 ? (
              <div style={{ marginTop: 24, fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252' }}>
                No comparable sales yet — data pending.
              </div>
            ) : (
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
                        <td style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#F0EBE0', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{fmt(c.address)}</td>
                        <td style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 15, color: '#C9A84C', padding: '10px 16px 10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{fmt(c.price)}</td>
                        <td style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', padding: '10px 16px 10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{fmt(c.sqft)}</td>
                        <td style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', padding: '10px 16px 10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{fmt(c.beds)}</td>
                        <td style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{fmt(c.distance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {/* Neighborhood Profile */}
        {demo.medianIncome && (
          <Section title="Neighborhood Profile">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0 40px' }}>
              <Stat label="Median Income" value={fmt(demo.medianIncome)} />
              <Stat label="Median Home Value" value={fmt(demo.medianHomeValue)} />
              <Stat label="Population" value={fmt(demo.population)} />
              <Stat label="Owner Occupied" value={fmt(demo.ownerOccupied)} />
              <Stat label="Renter Occupied" value={fmt(demo.renterOccupied)} />
              <Stat label="College Educated" value={fmt(demo.collegePct)} />
            </div>
            <div style={{ marginTop: 8, fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#F0EBE0' }}>
              {demo.neighborhoodTrend} · {demo.mobilityRate}
            </div>
          </Section>
        )}

        {/* Luxury Provenance Dossier — only renders if has_provenance_dossier=true */}
        {(report?.apn || prop?.apn || sub?.apn) && (
          <LuxuryDossierSection apn={(report?.apn || prop?.apn || sub?.apn || '').replace(/[^0-9]/g, '')} />
        )}

        {/* Assessor Neighborhood Comparison — same block vs city */}
        {(report?.apn || prop?.apn || sub?.apn) && (
          <Section title="Assessor Neighborhood Breakdown">
            <NeighborhoodBreakdown
              apn={(report?.apn || prop?.apn || sub?.apn || '').replace(/[^0-9]/g, '')}
              city={prop?.city || sub?.city || undefined}
            />
          </Section>
        )}

        {/* Risk Profile — Flood + FEMA NRI Hazard + NWS Alerts */}
        {(flood.zone || hazard.score != null || nwsAlerts.length > 0) && (
          <Section title="Risk Profile">

            {/* Flood */}
            {flood.zone && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', padding: 20 }}>
                  <Stat label="FEMA Flood Zone" value={`Zone ${flood.zone}`} />
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: flood.highRisk ? '#A07850' : '#2D6A4F' }}>{flood.label}</div>
                </div>
                <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', padding: 20 }}>
                  <Stat label="Special Flood Hazard Area" value={flood.highRisk ? 'Yes — SFHA' : 'No'} />
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252' }}>{flood.subtype !== '—' ? flood.subtype : 'Standard zone determination'}</div>
                </div>
              </div>
            )}

            {/* FEMA NRI — 18-hazard composite */}
            {hazard.score != null && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 4 }}>
                      FEMA National Risk Index
                    </div>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: '#F0EBE0' }}>
                      {hazard.rating || '—'}
                      <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', marginLeft: 10 }}>
                        {hazard.score}/100
                      </span>
                    </div>
                  </div>
                  {hazard.insuranceTier && (
                    <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 16px' }}>
                      <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 4 }}>Insurance Risk</div>
                      <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: hazard.insuranceTier?.includes('High') ? '#A07850' : '#74C69D' }}>
                        {hazard.insuranceTier}
                      </div>
                    </div>
                  )}
                </div>

                {/* Per-hazard scores */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px,1fr))', gap: 12, marginBottom: 14 }}>
                  {([
                    ['Wildfire', hazard.wildfire],
                    ['Earthquake', hazard.earthquake],
                    ['Flood', hazard.flood],
                    ['Wind', hazard.wind],
                  ] as [string, number | undefined][]).filter(([, v]) => v != null).map(([label, score]) => {
                    const pct = Math.min(100, Math.max(0, score!));
                    const col = pct >= 60 ? '#A07850' : pct >= 30 ? '#C9A84C' : '#2D6A4F';
                    return (
                      <div key={label} style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', padding: '12px 14px' }}>
                        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 6 }}>{label}</div>
                        <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: col }} />
                        </div>
                        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: col }}>{Math.round(pct)}/100</div>
                      </div>
                    );
                  })}
                </div>

                {hazard.insuranceNotes && (
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', lineHeight: 1.7 }}>
                    {hazard.insuranceNotes}
                  </div>
                )}
              </div>
            )}

            {/* NWS Active Hazard Alerts */}
            {nwsAlerts.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16 }}>
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#A07850', marginBottom: 12 }}>
                  {nwsAlerts.length} Active NWS Alert{nwsAlerts.length !== 1 ? 's' : ''}
                </div>
                {nwsAlerts.map((alert: any, i: number) => (
                  <div key={i} style={{ background: 'rgba(160,120,80,0.08)', border: '1px solid rgba(160,120,80,0.25)', padding: '12px 16px', marginBottom: 8 }}>
                    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#A07850', marginBottom: 4 }}>{alert.event} · {alert.severity}</div>
                    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#F0EBE0' }}>{alert.headline}</div>
                  </div>
                ))}
              </div>
            )}

          </Section>
        )}

        {/* FBI Crime Stats */}
        {n.crime?.available && (
          <Section title="Crime Statistics — FBI UCR">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: '0 40px', marginBottom: 8 }}>
              <Stat label="Violent Crime Rate" value={`${n.crime.violentCrimeRatePer100k} per 100K`} />
              <Stat label="Property Crime Rate" value={`${n.crime.propertyCrimeRatePer100k} per 100K`} />
              <Stat label="Reporting Agency" value={n.crime.agencyName || '—'} />
              <Stat label="Data Year" value={n.crime.year || '2022'} />
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252' }}>Source: {n.crime.source} · {n.crime.note}</div>
          </Section>
        )}

        {/* Crime Incidents — SpotCrime */}
        {n.incidents?.available && (
          <Section title={`Crime & Safety — ${n.incidents.radius} Radius`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0 40px', marginBottom: 20 }}>
              <Stat label="Incidents (Last 6 Mo)" value={String(n.incidents.totalLast6Mo)} />
              <Stat label="Monthly Average" value={n.incidents.monthlyAvg} />
              <Stat label="Data Source" value="SpotCrime" />
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

        {/* Permits — BuildZoom */}
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

        {/* Analysis */}
        {(dna.sellerAngle || dna.buyerAngle || dna.investmentAngle) && (
          <Section title="Analysis">
            {[['Seller Angle', dna.sellerAngle], ['Buyer Angle', dna.buyerAngle], ['Investment Angle', dna.investmentAngle]].map(([label, text]) =>
              text ? (
                <div key={label as string} style={{ marginBottom: 28 }}>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 6 }}>{label}</div>
                  <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300, color: '#F0EBE0', lineHeight: 1.9, margin: 0 }}>{text}</p>
                </div>
              ) : null
            )}
          </Section>
        )}

        {/* Location & Climate */}
        {weather.summary && weather.summary !== '—' && (
          <Section title="Location & Climate">
            <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: '#F0EBE0', lineHeight: 1.8, margin: 0 }}>{weather.summary}</p>
          </Section>
        )}

        {/* MLS / IDX Source (all tiers, when data present) */}
        {(report?.mls_number || report?.idx_url) && (
          <MlsSourcePanel
            mlsNumber={report?.mls_number}
            idxUrl={report?.idx_url}
            listingSource={report?.listing_source}
            listingAgent={report?.listing_agent}
            listingBrokerage={report?.listing_brokerage}
            enrichmentStatus={report?.mls_enrichment_status}
          />
        )}

        {/* ── FIRST REPORT · ENTERPRISE PREVIEW ── */}
        {isFirstReportPreview && (
          <div style={{
            marginTop: 32,
            border: '1px solid rgba(201,168,76,0.45)',
            background: 'linear-gradient(135deg, rgba(201,168,76,0.10) 0%, rgba(201,168,76,0.02) 100%)',
            padding: '20px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 8 }}>
                {isNative() ? 'Complete Report' : 'First Report · Full Enterprise Preview'}
              </div>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#F0EBE0', lineHeight: 1.7 }}>
                {isNative()
                  ? "You're seeing every section we offer — market trend intelligence, micro-location scoring, full adjustment-factor breakdown, and property event timeline."
                  : "You're seeing every section we offer — market trend intelligence, micro-location scoring, full adjustment-factor breakdown, and property event timeline. Subsequent reports use your current plan."
                }
              </div>
            </div>
            {!isNative() && <a
              href="/pricing"
              style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
                letterSpacing: '3px', textTransform: 'uppercase',
                color: '#000', background: '#C9A84C',
                padding: '12px 22px', textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              Keep Enterprise →
            </a>}
          </div>
        )}

        {/* ── TIER BANNER ── (hidden on iOS — Apple Guideline 3.1.1: no
            references to paid plans in the iOS app) */}
        {!isNative() && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 28, marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: userTier === 'enterprise' ? '#C9A84C' : userTier === 'monthly' ? '#74C69D' : '#6B6252' }} />
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: userTier === 'free' ? '#6B6252' : '#F0EBE0' }}>
                {tierEmail ? `${TIER_LABELS[userTier]} · ${tierEmail}` : `${TIER_LABELS[userTier]} Report`}
              </div>
            </div>
            <button
              onClick={() => setShowTierPrompt(v => !v)}
              style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: '#C9A84C', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {tierEmail ? 'Switch account' : 'Check your plan →'}
            </button>
          </div>

          {/* Inline tier check prompt */}
          {showTierPrompt && (
            <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="email"
                value={tierCheckEmail}
                onChange={e => setTierCheckEmail(e.target.value)}
                placeholder="your@email.com"
                style={{
                  fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#F0EBE0',
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                  padding: '8px 12px', outline: 'none', flex: 1, maxWidth: 280,
                }}
                onKeyDown={e => { if (e.key === 'Enter') handleTierCheck(); }}
              />
              <button
                onClick={handleTierCheck}
                disabled={tierChecking}
                style={{
                  fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase',
                  color: '#000', background: tierChecking ? 'rgba(201,168,76,0.5)' : '#C9A84C',
                  border: 'none', padding: '10px 16px', cursor: tierChecking ? 'not-allowed' : 'pointer',
                }}
              >
                {tierChecking ? '…' : 'Unlock →'}
              </button>
            </div>
          )}
        </div>
        )}

        {/* ── PRO TIER: Market Intelligence ── */}
        <Section title="Market Intelligence">
          <TierGate userTier={effectiveTier} requiredTier="monthly">
            <MarketTrendPanel zip={reportZip} neighborhood={reportNeighborhood || undefined} />
          </TierGate>
        </Section>

        {/* ── ENTERPRISE: Micro-Location Scoring ── */}
        <Section title="Micro-Location Analysis">
          <TierGate userTier={effectiveTier} requiredTier="enterprise">
            <LocationScorePanel address={report?.address} lat={subjectLat} lon={subjectLon} />
          </TierGate>
        </Section>

        {/* ── ENTERPRISE: Property Event Timeline ── */}
        <Section title="Property Event Timeline">
          <TierGate userTier={effectiveTier} requiredTier="enterprise">
            <PropertyEventsPanel address={report?.address} />
          </TierGate>
        </Section>

        {/* ── ENTERPRISE: Full Adjustment Factors ── */}
        <Section title="Adjustment Factor Breakdown">
          <TierGate userTier={effectiveTier} requiredTier="enterprise">
            <AdjustmentFactorPanel dna={dna} comps={comps} />
          </TierGate>
        </Section>

        {/* Data Quality */}
        {dna.dataQualityNote && (
          <Section title="Data Quality Note">
            <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.7, margin: 0 }}>{dna.dataQualityNote}</p>
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
