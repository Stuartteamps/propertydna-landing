import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import PricingModal from '@/components/PricingModal';
import PremiumLockOverlay from '@/components/PremiumLockOverlay';
import { isPremiumUser } from '@/lib/isPremiumUser';
import { supabase } from '@/lib/supabase';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type Market = {
  name: string; lat: number; lon: number;
  heat: number; medianPrice: number; yoy: number;
  dom: number; inventory: number;
  tier: string; radius: number;
};

const CITY_META: Record<string, { name: string; lat: number; lon: number; radius: number }> = {
  'palm-springs':       { name: 'Palm Springs',       lat: 33.8303, lon: -116.5453, radius: 14 },
  'rancho-mirage':      { name: 'Rancho Mirage',      lat: 33.7392, lon: -116.4134, radius: 13 },
  'indian-wells':       { name: 'Indian Wells',       lat: 33.7197, lon: -116.3425, radius: 11 },
  'palm-desert':        { name: 'Palm Desert',        lat: 33.7222, lon: -116.3744, radius: 14 },
  'la-quinta':          { name: 'La Quinta',          lat: 33.6631, lon: -116.3100, radius: 13 },
  'cathedral-city':     { name: 'Cathedral City',     lat: 33.7797, lon: -116.4665, radius: 12 },
  'indio':              { name: 'Indio',              lat: 33.7206, lon: -116.2156, radius: 13 },
  'desert-hot-springs': { name: 'Desert Hot Springs', lat: 33.9611, lon: -116.5019, radius: 10 },
  'bermuda-dunes':      { name: 'Bermuda Dunes',      lat: 33.7456, lon: -116.2928, radius: 10 },
  'thousand-palms':     { name: 'Thousand Palms',     lat: 33.8225, lon: -116.3940, radius: 9  },
};

const FALLBACK_MARKETS: Market[] = [
  { name: 'Palm Springs',       lat: 33.8303, lon: -116.5453, heat: 0.88, medianPrice: 995000,  yoy: 9.2,  dom: 18, inventory: 124, tier: 'luxury',   radius: 14 },
  { name: 'Rancho Mirage',      lat: 33.7392, lon: -116.4134, heat: 0.74, medianPrice: 1450000, yoy: 6.8,  dom: 24, inventory: 87,  tier: 'luxury',   radius: 13 },
  { name: 'Indian Wells',       lat: 33.7197, lon: -116.3425, heat: 0.82, medianPrice: 2100000, yoy: 8.1,  dom: 21, inventory: 52,  tier: 'ultra',    radius: 11 },
  { name: 'Palm Desert',        lat: 33.7222, lon: -116.3744, heat: 0.65, medianPrice: 725000,  yoy: 5.3,  dom: 31, inventory: 198, tier: 'premium',  radius: 14 },
  { name: 'La Quinta',          lat: 33.6631, lon: -116.3100, heat: 0.71, medianPrice: 895000,  yoy: 7.4,  dom: 27, inventory: 143, tier: 'premium',  radius: 13 },
  { name: 'Cathedral City',     lat: 33.7797, lon: -116.4665, heat: 0.48, medianPrice: 450000,  yoy: 3.9,  dom: 42, inventory: 211, tier: 'standard', radius: 12 },
  { name: 'Indio',              lat: 33.7206, lon: -116.2156, heat: 0.42, medianPrice: 420000,  yoy: 3.1,  dom: 45, inventory: 266, tier: 'standard', radius: 13 },
  { name: 'Desert Hot Springs', lat: 33.9611, lon: -116.5019, heat: 0.35, medianPrice: 320000,  yoy: 2.8,  dom: 52, inventory: 178, tier: 'entry',    radius: 10 },
  { name: 'Bermuda Dunes',      lat: 33.7456, lon: -116.2928, heat: 0.52, medianPrice: 580000,  yoy: 4.4,  dom: 38, inventory: 95,  tier: 'standard', radius: 10 },
  { name: 'Thousand Palms',     lat: 33.8225, lon: -116.3940, heat: 0.39, medianPrice: 380000,  yoy: 3.5,  dom: 49, inventory: 134, tier: 'entry',    radius: 9  },
];

const priceToTier = (price: number) => {
  if (price >= 1_500_000) return 'ultra';
  if (price >= 900_000)   return 'luxury';
  if (price >= 650_000)   return 'premium';
  if (price >= 400_000)   return 'standard';
  return 'entry';
};

const heatColor = (heat: number) => {
  if (heat >= 0.8) return '#ff4444';
  if (heat >= 0.65) return '#ff8800';
  if (heat >= 0.5) return '#ffbb00';
  if (heat >= 0.35) return '#00aaff';
  return '#0066cc';
};

const yoyColor = (yoy: number) => yoy >= 0 ? '#00ff88' : '#ff4444';
const fmtPrice = (p: number) => p >= 1_000_000 ? `$${(p / 1_000_000).toFixed(2)}M` : `$${(p / 1000).toFixed(0)}K`;
const fmtYoy = (y: number) => `${y >= 0 ? '+' : ''}${y.toFixed(1)}%`;

const LAYERS = [
  ['Price / Sq Ft',   'price_sqft'],
  ['Sales Velocity',  'velocity'],
  ['Demand Intensity','demand'],
  ['Opportunity',     'opportunity'],
];

type ModalTab = 'signin' | 'pricing';
type SortKey = 'heat' | 'medianPrice' | 'yoy' | 'dom' | 'inventory';

export default function MarketHeatMap() {
  const [modalOpen, setModalOpen]     = useState(false);
  const [modalTab, setModalTab]       = useState<ModalTab>('signin');
  const [pricingOpen, setPricingOpen] = useState(false);
  const [premium, setPremium]         = useState(false);
  const [activeLayer, setActiveLayer] = useState('price_sqft');
  const [selectedCity, setSelectedCity] = useState<Market | null>(null);
  const [markets, setMarkets]         = useState<Market[]>(FALLBACK_MARKETS);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [sortKey, setSortKey]         = useState<SortKey>('heat');
  const [sortAsc, setSortAsc]         = useState(false);
  const tickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setPremium(isPremiumUser()); }, []);

  const fetchMarkets = useCallback(() => {
    supabase
      .from('market_snapshots')
      .select('geo_key, median_price, appreciation_rate_yoy, demand_score, days_on_market, active_listings')
      .eq('geo_type', 'city')
      .order('snapshot_date', { ascending: false })
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) return;
        const seen = new Set<string>();
        const rows = data.filter(r => { if (seen.has(r.geo_key)) return false; seen.add(r.geo_key); return true; });
        const live: Market[] = rows.flatMap(r => {
          const meta = CITY_META[r.geo_key];
          if (!meta) return [];
          const price = Number(r.median_price) || 0;
          return [{ ...meta, heat: Math.min(1, Math.max(0, Number(r.demand_score) / 100)), medianPrice: price, yoy: Number(r.appreciation_rate_yoy) || 0, dom: Number(r.days_on_market) || 0, inventory: Number(r.active_listings) || 0, tier: priceToTier(price) }];
        });
        if (live.length > 0) { setMarkets(live); setLastRefresh(new Date()); }
      });
  }, []);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 5 * 60 * 1000); // 5 min auto-refresh
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  const openModal = (tab: ModalTab = 'pricing') => { setModalTab(tab); setModalOpen(true); };

  const sorted = [...markets].sort((a, b) => {
    const v = (sortAsc ? 1 : -1);
    if (sortKey === 'heat') return v * (a.heat - b.heat);
    if (sortKey === 'medianPrice') return v * (a.medianPrice - b.medianPrice);
    if (sortKey === 'yoy') return v * (a.yoy - b.yoy);
    if (sortKey === 'dom') return v * (a.dom - b.dom);
    return v * (a.inventory - b.inventory);
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const center: [number, number] = [33.765, -116.390];

  // Ticker items — all markets scrolling
  const tickerItems = [...markets, ...markets];

  return (
    <div style={{ background: '#0a0a0a', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'Jost, sans-serif' }}>
      <Nav
        onSignInClick={() => openModal('signin')}
        onRequestAccessClick={() => setPricingOpen(true)}
      />
      <AuthModal isOpen={modalOpen} initialView={modalTab} onClose={() => setModalOpen(false)} />
      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} />

      {/* ── LIVE TICKER BAR ─────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', top: 64, left: 0, right: 0, zIndex: 400,
        background: '#0d0d0d', borderBottom: '1px solid rgba(0,255,136,0.12)',
        overflow: 'hidden', height: 36,
        display: 'flex', alignItems: 'center',
      }}>
        {/* Live dot */}
        <div style={{ padding: '0 12px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px #00ff88', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 8, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(0,255,136,0.7)' }}>LIVE</span>
        </div>
        <div
          ref={tickerRef}
          className="ticker-scroll"
          style={{ display: 'flex', gap: 0, whiteSpace: 'nowrap', animation: 'ticker 60s linear infinite' }}
        >
          {tickerItems.map((m, i) => (
            <div key={`${m.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 24px', borderRight: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              <span style={{ fontSize: 10, letterSpacing: '1px', color: '#e0e0e0', fontWeight: 500 }}>{m.name.toUpperCase()}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{fmtPrice(m.medianPrice)}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: yoyColor(m.yoy) }}>{fmtYoy(m.yoy)}</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>DOM:{m.dom}</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>INV:{m.inventory}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '0 12px', flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.08)', marginLeft: 'auto' }}>
          <span style={{ fontSize: 8, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
            {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 120, paddingBottom: 24, paddingLeft: 'clamp(16px,4vw,48px)', paddingRight: 'clamp(16px,4vw,48px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 8, letterSpacing: '4px', textTransform: 'uppercase', color: 'rgba(0,255,136,0.7)', marginBottom: 6 }}>
              Market Intelligence · Coachella Valley
            </div>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px,4vw,52px)', fontWeight: 300, color: '#f0f0f0', margin: 0, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              Live Market <em style={{ color: '#00ff88' }}>Heat Map</em>
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
            {[
              ['Markets', markets.length],
              ['Avg Heat', `${(markets.reduce((s, m) => s + m.heat, 0) / Math.max(1, markets.length) * 100).toFixed(0)}%`],
              ['Avg YoY', fmtYoy(markets.reduce((s, m) => s + m.yoy, 0) / Math.max(1, markets.length))],
            ].map(([lbl, val]) => (
              <div key={String(lbl)} style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 8, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>{lbl}</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 300, color: '#f0f0f0' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MAP + RANKINGS ──────────────────────────────────────────── */}
      <section style={{ padding: '20px clamp(16px,4vw,48px)', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: premium ? '1fr 320px' : '1fr 320px', gap: 16, alignItems: 'start' }}>

          {/* Map */}
          <div>
            {premium && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {LAYERS.map(([label, key]) => (
                  <button
                    key={key}
                    onClick={() => setActiveLayer(key)}
                    style={{
                      fontFamily: 'Jost, sans-serif', fontSize: 8, letterSpacing: '2px', textTransform: 'uppercase',
                      padding: '5px 12px', border: '1px solid',
                      borderColor: activeLayer === key ? '#00ff88' : 'rgba(255,255,255,0.12)',
                      color: activeLayer === key ? '#00ff88' : 'rgba(255,255,255,0.4)',
                      background: activeLayer === key ? 'rgba(0,255,136,0.06)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >{label}</button>
                ))}
              </div>
            )}
            <div style={{ height: 'clamp(380px,55vh,580px)', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden', filter: premium ? 'none' : 'brightness(0.55) saturate(0.5)' }}>
              <MapContainer center={center} zoom={10} style={{ height: '100%', width: '100%' }} zoomControl={premium} dragging={premium} scrollWheelZoom={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='© CARTO' />
                {markets.map(m => (
                  <CircleMarker
                    key={m.name}
                    center={[m.lat, m.lon]}
                    radius={m.radius + m.heat * 8}
                    pathOptions={{ color: heatColor(m.heat), fillColor: heatColor(m.heat), fillOpacity: 0.7, weight: 1.5 }}
                    eventHandlers={{ click: () => premium && setSelectedCity(m) }}
                  >
                    {premium && (
                      <Popup>
                        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, background: '#111', color: '#e0e0e0', padding: '8px 12px', border: 'none' }}>
                          <div style={{ fontWeight: 600, marginBottom: 6, color: '#f0f0f0' }}>{m.name}</div>
                          <div>Median: <span style={{ color: '#ffbb00' }}>{fmtPrice(m.medianPrice)}</span></div>
                          <div>YoY: <span style={{ color: yoyColor(m.yoy) }}>{fmtYoy(m.yoy)}</span></div>
                          <div>DOM: {m.dom} · Inv: {m.inventory}</div>
                        </div>
                      </Popup>
                    )}
                  </CircleMarker>
                ))}
              </MapContainer>
              {!premium && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 1000 }}>
                  <PremiumLockOverlay
                    headline="Unlock Live Market Intelligence"
                    body="Street-level heat maps, pricing velocity, demand intensity, and opportunity zone scoring across the full valley."
                    ctaLabel="Unlock Premium"
                    onUpgrade={() => setPricingOpen(true)}
                  />
                </div>
              )}
            </div>
            {/* Map legend */}
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {[['#ff4444','High Activity (>80)'],['#ff8800','Active (65–80)'],['#ffbb00','Moderate (50–65)'],['#00aaff','Slow (<50)']].map(([color, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rankings panel */}
          <div style={{ border: '1px solid rgba(255,255,255,0.07)', background: '#0d0d0d' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(0,255,136,0.6)' }}>Market Rankings</span>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>Heat ↓</span>
            </div>
            {sorted.map((m, i) => (
              <div
                key={m.name}
                onClick={() => premium && setSelectedCity(m)}
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: premium ? 'pointer' : 'default',
                  opacity: !premium && i > 2 ? 0.25 : 1,
                  filter: !premium && i > 2 ? 'blur(4px)' : 'none',
                  userSelect: !premium && i > 2 ? 'none' : 'auto',
                  background: selectedCity?.name === m.name ? 'rgba(0,255,136,0.04)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 12, color: 'rgba(255,255,255,0.25)', minWidth: 16 }}>{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 11, color: '#e0e0e0', letterSpacing: '0.5px' }}>{m.name}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{fmtPrice(m.medianPrice)}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: yoyColor(m.yoy) }}>{fmtYoy(m.yoy)}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>DOM {m.dom}</div>
                </div>
              </div>
            ))}
            {!premium && (
              <div style={{ padding: 16 }}>
                <button
                  onClick={() => setPricingOpen(true)}
                  style={{ width: '100%', fontFamily: 'Jost, sans-serif', fontSize: 9, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: '#00ff88', border: 'none', padding: '11px 20px', cursor: 'pointer' }}
                >
                  Unlock All Markets →
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── SELECTED CITY DETAIL ────────────────────────────────────── */}
      {selectedCity && premium && (
        <section style={{ padding: '0 clamp(16px,4vw,48px) 16px', maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ border: '1px solid rgba(0,255,136,0.2)', background: '#0d0d0d', padding: '20px 24px', display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setSelectedCity(null)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}
            >×</button>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(0,255,136,0.5)', marginBottom: 4 }}>Selected Market</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 300, color: '#f0f0f0' }}>{selectedCity.name}</div>
            </div>
            {[
              ['Median Price',  fmtPrice(selectedCity.medianPrice),   '#ffbb00'],
              ['YoY Change',    fmtYoy(selectedCity.yoy),             yoyColor(selectedCity.yoy)],
              ['Days on Market',`${selectedCity.dom} days`,           '#e0e0e0'],
              ['Active Inventory',`${selectedCity.inventory} homes`,  '#e0e0e0'],
              ['Heat Score',    `${Math.round(selectedCity.heat * 100)}/100`, heatColor(selectedCity.heat)],
            ].map(([label, val, color]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 300, color: color as string }}>{val}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── DATA TABLE ──────────────────────────────────────────────── */}
      <section style={{ padding: '16px clamp(16px,4vw,48px) 40px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ border: '1px solid rgba(255,255,255,0.07)', background: '#0d0d0d', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(0,255,136,0.6)' }}>Market Data Table</span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>Click headers to sort</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {([
                    ['City',          null],
                    ['Median Price',  'medianPrice'],
                    ['YoY',          'yoy'],
                    ['DOM',           'dom'],
                    ['Inventory',     'inventory'],
                    ['Heat',          'heat'],
                    ['Tier',          null],
                  ] as [string, SortKey | null][]).map(([label, key]) => (
                    <th
                      key={label}
                      onClick={() => key && handleSort(key)}
                      style={{
                        padding: '10px 16px', textAlign: 'left',
                        fontSize: 8, letterSpacing: '2px', textTransform: 'uppercase',
                        color: key && sortKey === key ? '#00ff88' : 'rgba(255,255,255,0.3)',
                        cursor: key ? 'pointer' : 'default',
                        userSelect: 'none', whiteSpace: 'nowrap',
                        fontWeight: 400,
                      }}
                    >
                      {label}{key && sortKey === key ? (sortAsc ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((m, i) => (
                  <tr
                    key={m.name}
                    onClick={() => premium && setSelectedCity(m)}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      cursor: premium ? 'pointer' : 'default',
                      opacity: !premium && i > 3 ? 0.2 : 1,
                      filter: !premium && i > 3 ? 'blur(5px)' : 'none',
                      userSelect: !premium && i > 3 ? 'none' : 'auto',
                      background: selectedCity?.name === m.name ? 'rgba(0,255,136,0.03)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (premium) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = selectedCity?.name === m.name ? 'rgba(0,255,136,0.03)' : 'transparent'; }}
                  >
                    <td style={{ padding: '10px 16px', color: '#e0e0e0', fontWeight: 500 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: heatColor(m.heat), flexShrink: 0 }} />
                        {m.name}
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#ffbb00', fontFamily: 'Cormorant Garamond, serif', fontSize: 14 }}>{fmtPrice(m.medianPrice)}</td>
                    <td style={{ padding: '10px 16px', color: yoyColor(m.yoy), fontWeight: 600 }}>{fmtYoy(m.yoy)}</td>
                    <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.6)' }}>{m.dom}d</td>
                    <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.6)' }}>{m.inventory}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${m.heat * 100}%`, height: '100%', background: heatColor(m.heat) }} />
                        </div>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>{Math.round(m.heat * 100)}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.35)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>{m.tier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!premium && (
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Full market data available to Pro subscribers</span>
              <button
                onClick={() => setPricingOpen(true)}
                style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: '#00ff88', border: 'none', padding: '10px 20px', cursor: 'pointer', flexShrink: 0 }}
              >
                Unlock Premium
              </button>
            </div>
          )}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', marginTop: 10, letterSpacing: 1 }}>
          Live data from Supabase market_snapshots · Auto-refreshes every 5 minutes · Not a licensed appraisal
        </div>
      </section>

      <Footer />

      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-scroll { animation: ticker 80s linear infinite; }
        .ticker-scroll:hover { animation-play-state: paused; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
      `}</style>
    </div>
  );
}
