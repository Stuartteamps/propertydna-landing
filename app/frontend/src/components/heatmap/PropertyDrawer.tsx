import { useState } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import type { HeatParcel } from '@/types/heatmap';
import { heatScoreToHex, heatScoreToRgba } from '@/lib/colorScaleHeatmap';
import { heatScoreLabel, heatScoreBadgeColor } from '@/lib/scoringHeatmap';
import { useAuth } from '@/lib/auth';
import ReportProgress from './ReportProgress';
import { confidenceBadgeTerminal } from '@/lib/confidenceBadge';

const N8N_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://dillabean.app.n8n.cloud/webhook/homefax/report';

interface Props {
  parcel: HeatParcel | null;
  onClose: () => void;
  onNeedAuth: () => void;
}

function ConfidencePillTerminal({ confidence }: { confidence: number }) {
  const b = confidenceBadgeTerminal(confidence);
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4,
      padding: '3px 8px', borderRadius: 3, background: b.bg,
      border: `1px solid ${b.border}`, fontFamily: "'Share Tech Mono', monospace",
      fontSize: 8, fontWeight: 600, color: b.text, letterSpacing: 0.8,
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: b.dot, flexShrink: 0, boxShadow: `0 0 6px ${b.dot}` }} />
      {b.label}
    </div>
  );
}

export default function PropertyDrawer({ parcel, onClose, onNeedAuth }: Props) {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [requestId, setRequestId] = useState('');

  const isOpen = parcel !== null;

  const radarData = parcel ? [
    { subject: 'Comps',      value: parcel.compsScore },
    { subject: 'Price Δ',    value: parcel.priceDeltaScore },
    { subject: 'DOM',        value: parcel.domScore },
    { subject: 'Permits',    value: parcel.permitsScore },
    { subject: 'Livability', value: parcel.livability },
    { subject: 'Rental',     value: parcel.rentalDemand },
  ] : [];

  function handleGenerate() {
    if (!user) { onNeedAuth(); return; }
    setGenerating(true);

    // Fire-and-forget to n8n — real report generation
    fetch(N8N_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: user.user_metadata?.full_name || user.email || '',
        email: user.email || '',
        address: parcel!.street,
        city: parcel!.city,
        state: parcel!.state,
        zip: parcel!.zip,
        role: 'Buyer',
        notes: `PropertyDNA Score: ${parcel!.score}/100 · DOM: ${parcel!.dom} · $${parcel!.price?.toLocaleString()}`,
        leadSource: 'heatmap',
        paid: true,
        stripeSessionId: 'heatmap',
        pageUrl: 'https://thepropertydna.com/market-heatmaps',
        timestamp: new Date().toISOString(),
      }),
    }).then(r => r.json()).then(data => {
      setRequestId(data?.requestId || data?.report_id || '');
    }).catch(() => {});
  }

  function handleProgressDone() {
    setGenerating(false);
    setReportSent(true);
  }

  function reset() { setGenerating(false); setReportSent(false); setRequestId(''); }

  const MONO  = "'Share Tech Mono', monospace";
  const UI    = "'Rajdhani', sans-serif";
  const G     = '#00ff88';
  const T_M   = 'rgba(180,220,200,0.5)';
  const T_P   = '#e8f4f0';
  const BDR   = 'rgba(0,255,136,0.16)';

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 8000,
        background: 'rgba(0,0,0,0.5)',
        opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'opacity 0.25s',
      }} />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 8100,
        width: 380, background: 'rgba(4,12,20,0.99)',
        borderLeft: `1px solid ${BDR}`,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        overflowY: 'auto', fontFamily: MONO,
        backdropFilter: 'blur(16px)',
      }}>
        {parcel && (
          <>
            {/* Header */}
            <div style={{
              padding: '18px 20px 14px',
              borderBottom: `1px solid ${BDR}`,
              background: `linear-gradient(180deg, ${heatScoreToRgba(parcel.score, 0.08)}, transparent)`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: UI, fontSize: 14, fontWeight: 600, color: T_P, lineHeight: 1.3, marginBottom: 3 }}>
                    {parcel.street}
                  </div>
                  <div style={{ fontSize: 10, color: T_M }}>{parcel.city}, {parcel.state} {parcel.zip}</div>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T_M, fontSize: 20, padding: 0, marginLeft: 12 }}>×</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
                <div style={{
                  width: 54, height: 54, borderRadius: '50%',
                  background: `conic-gradient(${heatScoreToHex(parcel.score)} ${parcel.score * 3.6}deg, rgba(0,255,136,0.08) 0)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%', background: 'rgba(4,12,20,0.99)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700, color: heatScoreToHex(parcel.score),
                  }}>{parcel.score}</div>
                </div>
                <div>
                  <div style={{ fontFamily: UI, fontSize: 12, fontWeight: 600, color: heatScoreBadgeColor(parcel.score), letterSpacing: 0.5 }}>
                    {heatScoreLabel(parcel.score)}
                  </div>
                  <ConfidencePillTerminal confidence={parcel.confidence} />
                  <div style={{ fontSize: 9, color: T_M }}>{parcel.neighborhood}</div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ padding: '12px 20px', borderBottom: `1px solid rgba(0,255,136,0.06)` }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                {[
                  ['LIST PRICE',    `$${parcel.price.toLocaleString()}`],
                  ['PER SQFT',      `$${parcel.pricePerSqft}`],
                  ['SIZE',          `${parcel.sqft.toLocaleString()} sqft`],
                  ['BEDS / BATHS',  `${parcel.bedrooms} / ${parcel.bathrooms}`],
                  ['YEAR BUILT',    parcel.yearBuilt || '—'],
                  ['DAYS ON MKT',   `${parcel.dom}d`],
                  ['TYPE',          parcel.propertyType.replace('_', ' ')],
                  ['SOURCE',        'RentCast MLS'],
                ].map(([l, v]) => (
                  <div key={String(l)}>
                    <div style={{ fontSize: 7, color: T_M, textTransform: 'uppercase', letterSpacing: 2 }}>{l}</div>
                    <div style={{ fontFamily: UI, fontSize: 12, color: T_P, fontWeight: 500, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Radar */}
            <div style={{ padding: '12px 20px 0', borderBottom: `1px solid rgba(0,255,136,0.06)` }}>
              <div style={{ fontSize: 8, color: T_M, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Score Breakdown</div>
              <div style={{ height: 170 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(0,255,136,0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: T_M, fontSize: 9, fontFamily: MONO }} />
                    <Radar dataKey="value" stroke={heatScoreToHex(parcel.score)} fill={heatScoreToHex(parcel.score)} fillOpacity={0.2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CTA */}
            <div style={{ padding: '16px 20px' }}>
              {!generating && !reportSent && (
                <>
                  <button onClick={handleGenerate} style={{
                    width: '100%', padding: '12px 0',
                    background: G,
                    border: 'none', cursor: 'pointer',
                    fontFamily: MONO, fontSize: 10, fontWeight: 700, color: '#000', letterSpacing: 2, textTransform: 'uppercase',
                    boxShadow: '0 0 20px rgba(0,255,136,0.15)',
                  }}>
                    {user ? 'Generate Full DNA Report' : 'Sign In to Generate Report'}
                  </button>
                  <p style={{ fontFamily: MONO, fontSize: 9, color: T_M, textAlign: 'center', marginTop: 6 }}>
                    {user ? `Delivered to ${user.email}` : 'Sign in with Google to get your free report'}
                  </p>
                </>
              )}

              {generating && <ReportProgress parcel={parcel} onDone={handleProgressDone} />}

              {reportSent && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: MONO, fontSize: 24, color: G, marginBottom: 8 }}>✓</div>
                  <div style={{ fontFamily: UI, fontSize: 13, color: G, fontWeight: 600, marginBottom: 4 }}>Report Processing</div>
                  <div style={{ fontSize: 10, color: T_M, marginBottom: 4 }}>
                    Check your email — <strong style={{ color: T_P }}>{user?.email}</strong>
                  </div>
                  {requestId && <div style={{ fontSize: 9, color: T_M, marginBottom: 14, letterSpacing: 1 }}>REF: {requestId}</div>}
                  <button onClick={reset} style={{
                    width: '100%', padding: '10px 0',
                    background: 'rgba(0,255,136,0.06)', border: `1px solid ${BDR}`,
                    cursor: 'pointer', fontFamily: MONO, fontSize: 10, color: G, letterSpacing: 1,
                  }}>Run Another Report</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
