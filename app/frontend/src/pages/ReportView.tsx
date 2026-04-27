import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import SignInModal from '@/components/SignInModal';

// Fix Leaflet default icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SUPA_URL = 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPA_ANON = 'sb_publishable_KTTgVO3mROxubE_A9OQ7Kg_aRrnzPVT';

interface ReportData {
  id: string;
  address: string;
  full_name: string;
  email: string;
  role: string;
  property_dna: any;
  created_at: string;
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
  const [modalTab, setModalTab] = useState<'signin' | 'signup' | 'sales'>('signin');

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
          try { row.property_dna = JSON.parse(row.property_dna); } catch {}
        }
        setReport(row);
      })
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }, [reportId]);

  const dna = report?.property_dna ?? {};
  const n = dna.normalized ?? {};
  const comps: any[] = n.comps ?? [];
  const flood = n.flood ?? {};
  const demo = n.demographics ?? {};
  const val = n.valuation ?? {};
  const prop = n.property ?? {};
  const sub = n.subject ?? {};
  const sale = n.sale ?? {};
  const weather = n.weather ?? {};

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
    <div style={{ minHeight: '100vh', background: '#0A0908', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#6B6252' }}>Loading Report…</div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#0A0908', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 32, color: '#F0EBE0', marginBottom: 12 }}>Report Not Found</div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252' }}>{error}</div>
      </div>
    </div>
  );

  return (
    <div style={{ background: '#0A0908', minHeight: '100vh', color: '#F0EBE0' }}>
      <Nav
        onSignInClick={() => { setModalTab('signin'); setModalOpen(true); }}
        onRequestAccessClick={() => { setModalTab('signup'); setModalOpen(true); }}
      />
      <SignInModal isOpen={modalOpen} initialTab={modalTab} onClose={() => setModalOpen(false)} />

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

          {/* Score badge */}
          <div style={{ display: 'flex', gap: 16, marginTop: 28, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ background: ratingColor[dna.rating] || '#6B6252', color: '#fff', padding: '8px 20px', fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 300 }}>
              {dna.rating || '—'}
            </div>
            <div>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252' }}>Data Quality Score</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: '#F0EBE0' }}>{dna.score || '—'}<span style={{ fontSize: 14, color: '#6B6252' }}>/100</span></div>
            </div>
            <div style={{ marginLeft: 16 }}>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252' }}>Confidence</div>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: '#F0EBE0' }}>{dna.confidence || '—'}</div>
            </div>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 48px 80px' }}>

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
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', marginBottom: 16 }}>
              Subject property shown in gold. Comparable sales sized and colored by price — larger/darker = higher value.
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
                        <strong>{comp.address}</strong><br />
                        {comp.price} · {comp.sqft} · {comp.distance}
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

        {/* Risk Profile */}
        {flood.zone && (
          <Section title="Risk Profile">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', padding: 24 }}>
                <Stat label="FEMA Flood Zone" value={`Zone ${flood.zone}`} />
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: flood.highRisk ? '#A07850' : '#2D6A4F' }}>{flood.label}</div>
              </div>
              <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', padding: 24 }}>
                <Stat label="Special Flood Hazard Area" value={flood.highRisk ? 'Yes — SFHA' : 'No'} />
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252' }}>{flood.subtype !== '—' ? flood.subtype : 'Standard zone determination'}</div>
              </div>
            </div>
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
