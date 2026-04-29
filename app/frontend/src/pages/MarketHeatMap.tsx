import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import FadeUp from '@/components/FadeUp';
import SignInModal from '@/components/SignInModal';
import PremiumLockOverlay from '@/components/PremiumLockOverlay';
import { isPremiumUser } from '@/lib/isPremiumUser';

// Fix Leaflet icon paths with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// TODO: Replace SAMPLE_MARKETS with live data from Supabase market_snapshots table.
//       Query: SELECT city, median_price, yoy_change, absorption_rate, demand_score
//       FROM market_snapshots WHERE metro_area = 'coachella-valley' ORDER BY created_at DESC LIMIT 1 per city.
const SAMPLE_MARKETS = [
  { name: 'Palm Springs',      lat: 33.8303,  lon: -116.5453, heat: 0.88, medianPrice: 995000,  yoy: 9.2,  tier: 'luxury',   radius: 14 },
  { name: 'Rancho Mirage',     lat: 33.7392,  lon: -116.4134, heat: 0.74, medianPrice: 1450000, yoy: 6.8,  tier: 'luxury',   radius: 13 },
  { name: 'Indian Wells',      lat: 33.7197,  lon: -116.3425, heat: 0.82, medianPrice: 2100000, yoy: 8.1,  tier: 'ultra',    radius: 11 },
  { name: 'Palm Desert',       lat: 33.7222,  lon: -116.3744, heat: 0.65, medianPrice: 725000,  yoy: 5.3,  tier: 'premium',  radius: 14 },
  { name: 'La Quinta',         lat: 33.6631,  lon: -116.3100, heat: 0.71, medianPrice: 895000,  yoy: 7.4,  tier: 'premium',  radius: 13 },
  { name: 'Cathedral City',    lat: 33.7797,  lon: -116.4665, heat: 0.48, medianPrice: 450000,  yoy: 3.9,  tier: 'standard', radius: 12 },
  { name: 'Indio',             lat: 33.7206,  lon: -116.2156, heat: 0.42, medianPrice: 420000,  yoy: 3.1,  tier: 'standard', radius: 13 },
  { name: 'Desert Hot Springs', lat: 33.9611, lon: -116.5019, heat: 0.35, medianPrice: 320000,  yoy: 2.8,  tier: 'entry',    radius: 10 },
  { name: 'Bermuda Dunes',     lat: 33.7456,  lon: -116.2928, heat: 0.52, medianPrice: 580000,  yoy: 4.4,  tier: 'standard', radius: 10 },
  { name: 'Thousand Palms',    lat: 33.8225,  lon: -116.3940, heat: 0.39, medianPrice: 380000,  yoy: 3.5,  tier: 'entry',    radius: 9  },
];

const heatColor = (heat: number) => {
  if (heat >= 0.8) return '#C94C4C';
  if (heat >= 0.65) return '#D4784A';
  if (heat >= 0.5) return '#C9A84C';
  if (heat >= 0.35) return '#4A7EC9';
  return '#6B84C9';
};

const tierLabel: Record<string, string> = {
  ultra: 'Ultra Luxury', luxury: 'Luxury', premium: 'Premium', standard: 'Standard', entry: 'Entry',
};

const layers = [
  ['Price / Sq Ft', 'price_sqft'],
  ['Sales Velocity', 'velocity'],
  ['Demand Intensity', 'demand'],
  ['Opportunity Zones', 'opportunity'],
];

type ModalTab = 'signin' | 'signup' | 'sales';

export default function MarketHeatMap() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>('signin');
  const [premium, setPremium] = useState(false);
  const [activeLayer, setActiveLayer] = useState('price_sqft');
  const [selectedCity, setSelectedCity] = useState<typeof SAMPLE_MARKETS[0] | null>(null);

  useEffect(() => {
    setPremium(isPremiumUser());
  }, []);

  const openModal = (tab: ModalTab = 'signup') => {
    setModalTab(tab);
    setModalOpen(true);
  };

  const center: [number, number] = [33.765, -116.390];

  return (
    <div className="bg-espresso text-canvas min-h-screen" style={{ background: '#0F0E0D', color: '#F4F0E8', minHeight: '100vh' }}>
      <Nav
        onSignInClick={() => openModal('signin')}
        onRequestAccessClick={() => openModal('signup')}
      />
      <SignInModal isOpen={modalOpen} initialTab={modalTab} onClose={() => setModalOpen(false)} />

      {/* Hero */}
      <section className="pt-32 md:pt-36 px-6 md:px-12 pb-10">
        <div className="max-w-6xl mx-auto">
          <FadeUp delay={0}>
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-4">
              Market Intelligence
            </div>
            <h1
              className="font-serif font-light text-canvas leading-[1.05] mb-6"
              style={{ fontSize: 'clamp(32px,5vw,68px)', letterSpacing: '-1.2px' }}
            >
              Coachella Valley
              <br />
              <em className="italic text-gold">Heat Map</em>
            </h1>
            <p className="font-sans text-[14px] font-light leading-[1.85] text-canvas/60 max-w-xl">
              Market movement, pricing velocity, and opportunity zones across the full valley.
              {!premium && ' Unlock premium for street-level intelligence and demand scoring.'}
            </p>
          </FadeUp>
        </div>
      </section>

      {/* Map area */}
      <section className="px-6 md:px-12 pb-8">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">

              {/* Map container */}
              <div style={{ position: 'relative' }}>
                {/* Layer selector — premium only */}
                {premium && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {layers.map(([label, key]) => (
                      <button
                        key={key}
                        onClick={() => setActiveLayer(key)}
                        style={{
                          fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
                          padding: '6px 14px', border: '1px solid',
                          borderColor: activeLayer === key ? '#B89355' : 'rgba(255,255,255,0.15)',
                          color: activeLayer === key ? '#B89355' : 'rgba(244,240,232,0.5)',
                          background: 'transparent', cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{
                  height: 'clamp(360px, 55vh, 560px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  position: 'relative', overflow: 'hidden',
                  filter: premium ? 'none' : 'brightness(0.6)',
                }}>
                  <MapContainer
                    center={center}
                    zoom={10}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={premium}
                    dragging={premium}
                    scrollWheelZoom={false}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      attribution='© <a href="https://carto.com/">CARTO</a>'
                    />
                    {SAMPLE_MARKETS.map((m) => (
                      <CircleMarker
                        key={m.name}
                        center={[m.lat, m.lon]}
                        radius={m.radius + m.heat * 6}
                        pathOptions={{
                          color: heatColor(m.heat),
                          fillColor: heatColor(m.heat),
                          fillOpacity: 0.65,
                          weight: 1.5,
                        }}
                        eventHandlers={{
                          click: () => premium && setSelectedCity(m),
                        }}
                      >
                        {premium && (
                          <Popup>
                            <div style={{ fontFamily: 'sans-serif', fontSize: 12 }}>
                              <strong>{m.name}</strong><br />
                              Median: ${m.medianPrice.toLocaleString()}<br />
                              YoY: +{m.yoy}% · {tierLabel[m.tier]}
                            </div>
                          </Popup>
                        )}
                      </CircleMarker>
                    ))}
                  </MapContainer>

                  {/* Lock overlay for non-premium */}
                  {!premium && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 1000 }}>
                      <PremiumLockOverlay
                        headline="Unlock Market Movement"
                        body="Unlock street-level heat maps, market velocity, pricing movement, and opportunity zones across the Coachella Valley."
                        ctaLabel="Unlock Premium"
                        onUpgrade={() => openModal('signup')}
                      />
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                  {[
                    ['#C94C4C', 'High Activity (>80)'],
                    ['#D4784A', 'Active (65–80)'],
                    ['#C9A84C', 'Moderate (50–65)'],
                    ['#4A7EC9', 'Slow (<50)'],
                  ].map(([color, label]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                      <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: 'rgba(244,240,232,0.45)', letterSpacing: 1 }}>{label}</span>
                    </div>
                  ))}
                </div>

                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: 'rgba(244,240,232,0.25)', marginTop: 8, letterSpacing: 1 }}>
                  Sample data · TODO: connect to live market_snapshots table · Not a licensed appraisal
                </div>
              </div>

              {/* Side panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(244,240,232,0.4)', marginBottom: 12 }}>
                  Market Rankings
                </div>
                {SAMPLE_MARKETS
                  .slice()
                  .sort((a, b) => b.heat - a.heat)
                  .map((m, i) => (
                    <div
                      key={m.name}
                      onClick={() => premium && setSelectedCity(m)}
                      style={{
                        padding: '12px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        cursor: premium ? 'pointer' : 'default',
                        opacity: !premium && i > 2 ? 0.35 : 1,
                        filter: !premium && i > 2 ? 'blur(3px)' : 'none',
                        userSelect: !premium && i > 2 ? 'none' : 'auto',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 14, color: 'rgba(244,240,232,0.4)', minWidth: 18 }}>{i + 1}</div>
                        <div>
                          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#F4F0E8', letterSpacing: 0.5 }}>{m.name}</div>
                          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: 'rgba(244,240,232,0.4)' }}>{tierLabel[m.tier]}</div>
                        </div>
                      </div>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 15, color: heatColor(m.heat) }}>
                        +{m.yoy}%
                      </div>
                    </div>
                  ))}

                {!premium && (
                  <button
                    onClick={() => openModal('signup')}
                    style={{
                      marginTop: 16,
                      fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
                      letterSpacing: 3, textTransform: 'uppercase',
                      color: '#0F0E0D', background: '#B89355', border: 'none',
                      padding: '12px 20px', cursor: 'pointer', width: '100%',
                    }}
                  >
                    Unlock Full Map →
                  </button>
                )}
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* Premium feature detail */}
      {!premium && (
        <section className="px-6 md:px-12 py-16" style={{ background: '#0A0908' }}>
          <div className="max-w-6xl mx-auto">
            <FadeUp>
              <div className="mb-10">
                <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-4">Premium Intelligence</div>
                <h2 className="font-serif font-light text-canvas" style={{ fontSize: 'clamp(24px,3vw,40px)', letterSpacing: '-0.5px' }}>
                  See the full property signal.
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/5">
                {[
                  ['Sales Velocity', 'Days on market and absorption rate per ZIP, updated weekly from live transaction data.'],
                  ['Price / Sq Ft', 'Street-level $/sqft heat mapping across micro-neighborhoods — not ZIP averages.'],
                  ['Demand Intensity', 'Offer-to-list ratios, days-to-offer, and multiple-offer frequency by sub-market.'],
                  ['Opportunity Zones', 'Undervalued micro-markets identified by DNA scoring against comparable sub-markets.'],
                ].map(([title, desc]) => (
                  <div key={title} style={{ padding: '28px 24px', background: '#0A0908' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 300, color: '#F4F0E8', marginBottom: 10 }}>{title}</div>
                    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: 'rgba(244,240,232,0.45)', lineHeight: 1.75 }}>{desc}</div>
                    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#B89355', marginTop: 16 }}>Pro Only</div>
                  </div>
                ))}
              </div>
              <div className="mt-10 text-center">
                <button
                  type="button"
                  onClick={() => openModal('signup')}
                  className="font-sans text-[11px] font-medium uppercase tracking-[3px] text-espresso bg-gold hover:bg-[#cfa366] transition-colors px-8 py-4"
                >
                  Unlock Premium — $49/mo
                </button>
              </div>
            </FadeUp>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
