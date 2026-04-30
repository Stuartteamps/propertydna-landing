import { useState } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import type { HeatParcel } from '@/types/heatmap';
import { heatScoreToHex, heatScoreToRgba } from '@/lib/colorScaleHeatmap';
import { heatScoreLabel, heatScoreBadgeColor } from '@/lib/scoringHeatmap';
import { useAuth } from '@/lib/auth';
import ReportProgress from './ReportProgress';

const N8N_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://dillabean.app.n8n.cloud/webhook/homefax/report';

interface Props {
  parcel: HeatParcel | null;
  onClose: () => void;
  onNeedAuth: () => void;
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

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 8000,
        background: 'rgba(0,0,0,0.4)',
        opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'opacity 0.25s',
      }} />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 8100,
        width: 380, background: '#0A0908',
        borderLeft: '1px solid rgba(184,147,85,0.2)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        overflowY: 'auto', fontFamily: 'Jost, sans-serif',
      }}>
        {parcel && (
          <>
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid rgba(107,98,82,0.3)',
              background: `linear-gradient(180deg, ${heatScoreToRgba(parcel.score, 0.1)}, transparent)`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#F4F0E8', lineHeight: 1.3, marginBottom: 3 }}>
                    {parcel.street}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B6252' }}>{parcel.city}, {parcel.state} {parcel.zip}</div>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6252', fontSize: 20, padding: 0, marginLeft: 12 }}>×</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
                <div style={{
                  width: 54, height: 54, borderRadius: '50%',
                  background: `conic-gradient(${heatScoreToHex(parcel.score)} ${parcel.score * 3.6}deg, rgba(107,98,82,0.2) 0)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%', background: '#0A0908',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700, color: heatScoreToHex(parcel.score),
                  }}>{parcel.score}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: heatScoreBadgeColor(parcel.score) }}>
                    {heatScoreLabel(parcel.score)}
                  </div>
                  <div style={{ fontSize: 10, color: '#6B6252' }}>{Math.round(parcel.confidence * 100)}% model confidence</div>
                  <div style={{ fontSize: 9, color: '#6B6252' }}>{parcel.neighborhood}</div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(107,98,82,0.2)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px 14px' }}>
                {[
                  ['List Price', `$${parcel.price.toLocaleString()}`],
                  ['Per Sqft', `$${parcel.pricePerSqft}`],
                  ['Size', `${parcel.sqft.toLocaleString()} sqft`],
                  ['Beds / Baths', `${parcel.bedrooms} / ${parcel.bathrooms}`],
                  ['Year Built', parcel.yearBuilt || '—'],
                  ['Days on Market', `${parcel.dom}d`],
                  ['Type', parcel.propertyType.replace('_', ' ')],
                  ['Source', 'RentCast MLS'],
                ].map(([l, v]) => (
                  <div key={String(l)}>
                    <div style={{ fontSize: 8, color: '#6B6252', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</div>
                    <div style={{ fontSize: 12, color: '#F4F0E8', fontWeight: 500, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Radar */}
            <div style={{ padding: '14px 24px 0', borderBottom: '1px solid rgba(107,98,82,0.2)' }}>
              <div style={{ fontSize: 9, color: '#6B6252', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Score Breakdown</div>
              <div style={{ height: 170 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(107,98,82,0.3)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#6B6252', fontSize: 9 }} />
                    <Radar dataKey="value" stroke={heatScoreToHex(parcel.score)} fill={heatScoreToHex(parcel.score)} fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CTA */}
            <div style={{ padding: '18px 24px' }}>
              {!generating && !reportSent && (
                <>
                  <button onClick={handleGenerate} style={{
                    width: '100%', padding: '13px 0',
                    background: 'linear-gradient(135deg,#B89355,#C9A84C)',
                    border: 'none', borderRadius: 8, cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, color: '#0F0E0D', letterSpacing: '0.05em',
                  }}>
                    {user ? 'Generate Full DNA Report' : 'Sign In to Generate Report'}
                  </button>
                  <p style={{ fontSize: 10, color: '#6B6252', textAlign: 'center', marginTop: 6 }}>
                    {user ? `Report delivered to ${user.email}` : 'Sign in with Google to get your free report'}
                  </p>
                </>
              )}

              {generating && <ReportProgress parcel={parcel} onDone={handleProgressDone} />}

              {reportSent && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                  <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 600, marginBottom: 4 }}>Report Processing</div>
                  <div style={{ fontSize: 11, color: '#6B6252', marginBottom: 4 }}>
                    Check your email — <strong style={{ color: '#F4F0E8' }}>{user?.email}</strong>
                  </div>
                  {requestId && <div style={{ fontSize: 9, color: '#6B6252', marginBottom: 14 }}>Ref: {requestId}</div>}
                  <button onClick={reset} style={{
                    width: '100%', padding: '10px 0',
                    background: 'rgba(184,147,85,0.1)', border: '1px solid rgba(184,147,85,0.4)',
                    borderRadius: 8, cursor: 'pointer', fontSize: 11, color: '#B89355',
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
