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

interface Property {
  id: string; address: string; city: string;
  lat: number; lon: number; price: number;
  change: number; dom: number;
  score?: number | null; rating?: string | null;
}

interface Market {
  name: string; lat: number; lon: number;
  heat: number; medianPrice: number; yoy: number;
  dom: number; inventory: number; tier: string; radius: number;
}

const CITY_META: Record<string, { name: string; lat: number; lon: number; radius: number }> = {
  'miami-fl':        { name: 'Miami, FL',        lat: 25.7617, lon: -80.1918,  radius: 18 },
  'austin-tx':       { name: 'Austin, TX',        lat: 30.2672, lon: -97.7431,  radius: 18 },
  'scottsdale-az':   { name: 'Scottsdale, AZ',    lat: 33.4942, lon: -111.9261, radius: 16 },
  'nashville-tn':    { name: 'Nashville, TN',     lat: 36.1627, lon: -86.7816,  radius: 17 },
  'seattle-wa':      { name: 'Seattle, WA',       lat: 47.6062, lon: -122.3321, radius: 18 },
  'denver-co':       { name: 'Denver, CO',        lat: 39.7392, lon: -104.9903, radius: 18 },
  'dallas-tx':       { name: 'Dallas, TX',        lat: 32.7767, lon: -96.7970,  radius: 20 },
  'charlotte-nc':    { name: 'Charlotte, NC',     lat: 35.2271, lon: -80.8431,  radius: 18 },
  'tampa-fl':        { name: 'Tampa, FL',         lat: 27.9506, lon: -82.4572,  radius: 17 },
  'phoenix-az':      { name: 'Phoenix, AZ',       lat: 33.4484, lon: -112.0740, radius: 20 },
  'chicago-il':      { name: 'Chicago, IL',       lat: 41.8781, lon: -87.6298,  radius: 20 },
  'los-angeles-ca':  { name: 'Los Angeles, CA',   lat: 34.0522, lon: -118.2437, radius: 22 },
};

const FALLBACK_MARKETS: Market[] = [
  { name: 'Miami, FL',        lat: 25.7617, lon: -80.1918,  heat: 0.91, medianPrice: 650000,  yoy: 12.4, dom: 22, inventory: 4800,  tier: 'luxury',   radius: 18 },
  { name: 'Austin, TX',       lat: 30.2672, lon: -97.7431,  heat: 0.82, medianPrice: 548000,  yoy: 8.6,  dom: 28, inventory: 8200,  tier: 'premium',  radius: 18 },
  { name: 'Scottsdale, AZ',   lat: 33.4942, lon: -111.9261, heat: 0.78, medianPrice: 895000,  yoy: 7.2,  dom: 31, inventory: 2100,  tier: 'luxury',   radius: 16 },
  { name: 'Nashville, TN',    lat: 36.1627, lon: -86.7816,  heat: 0.75, medianPrice: 485000,  yoy: 9.1,  dom: 26, inventory: 5400,  tier: 'premium',  radius: 17 },
  { name: 'Seattle, WA',      lat: 47.6062, lon: -122.3321, heat: 0.73, medianPrice: 798000,  yoy: 7.4,  dom: 19, inventory: 3800,  tier: 'luxury',   radius: 18 },
  { name: 'Denver, CO',       lat: 39.7392, lon: -104.9903, heat: 0.71, medianPrice: 612000,  yoy: 6.8,  dom: 33, inventory: 6100,  tier: 'premium',  radius: 18 },
  { name: 'Los Angeles, CA',  lat: 34.0522, lon: -118.2437, heat: 0.69, medianPrice: 920000,  yoy: 5.2,  dom: 38, inventory: 11200, tier: 'luxury',   radius: 22 },
  { name: 'Dallas, TX',       lat: 32.7767, lon: -96.7970,  heat: 0.68, medianPrice: 425000,  yoy: 5.9,  dom: 37, inventory: 14200, tier: 'standard', radius: 20 },
  { name: 'Charlotte, NC',    lat: 35.2271, lon: -80.8431,  heat: 0.65, medianPrice: 398000,  yoy: 8.3,  dom: 29, inventory: 7200,  tier: 'standard', radius: 18 },
  { name: 'Tampa, FL',        lat: 27.9506, lon: -82.4572,  heat: 0.62, medianPrice: 412000,  yoy: 6.1,  dom: 34, inventory: 9400,  tier: 'standard', radius: 17 },
  { name: 'Phoenix, AZ',      lat: 33.4484, lon: -112.0740, heat: 0.58, medianPrice: 452000,  yoy: 4.8,  dom: 41, inventory: 18600, tier: 'standard', radius: 20 },
  { name: 'Chicago, IL',      lat: 41.8781, lon: -87.6298,  heat: 0.54, medianPrice: 328000,  yoy: 3.9,  dom: 45, inventory: 16400, tier: 'standard', radius: 20 },
];

const priceToTier = (p: number) => p >= 1_500_000 ? 'ultra' : p >= 900_000 ? 'luxury' : p >= 650_000 ? 'premium' : p >= 400_000 ? 'standard' : 'entry';
const heatColor = (h: number) => h >= 0.8 ? '#ff4444' : h >= 0.65 ? '#ff8800' : h >= 0.5 ? '#ffbb00' : '#4A7EC9';
const changeColor = (c: number) => c >= 0 ? '#00ff88' : '#ff4444';
const fmtPrice = (p: number) => p >= 1_000_000 ? `$${(p / 1_000_000).toFixed(2)}M` : `$${(p / 1000).toFixed(0)}K`;
const fmtChange = (c: number) => `${c >= 0 ? '+' : ''}${c.toFixed(1)}%`;
const fmtAddr = (a: string) => a.length > 22 ? a.slice(0, 20) + '…' : a;

type ModalTab = 'signin' | 'pricing';
type SortKey = 'heat' | 'medianPrice' | 'yoy' | 'dom';

export default function MarketHeatMap() {
  const [modalOpen, setModalOpen]       = useState(false);
  const [modalTab, setModalTab]         = useState<ModalTab>('signin');
  const [pricingOpen, setPricingOpen]   = useState(false);
  const [premium, setPremium]           = useState(false);
  const [markets, setMarkets]           = useState<Market[]>(FALLBACK_MARKETS);
  const [properties, setProperties]     = useState<Property[]>([]);
  const [liveCount, setLiveCount]       = useState(0);
  const [selected, setSelected]         = useState<Property | null>(null);
  const [lastRefresh, setLastRefresh]   = useState(new Date());
  const [blinkIdx, setBlinkIdx]         = useState(0);
  const [sortKey, setSortKey]           = useState<SortKey>('heat');
  const [sortAsc, setSortAsc]           = useState(false);
  const tickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setPremium(isPremiumUser()); }, []);

  const fetchMarkets = useCallback(() => {
    supabase.from('market_snapshots')
      .select('geo_key,median_price,appreciation_rate_yoy,demand_score,days_on_market,active_listings')
      .eq('geo_type', 'city').order('snapshot_date', { ascending: false })
      .then(({ data }) => {
        if (!data || !data.length) return;
        const seen = new Set<string>();
        const live: Market[] = data.filter(r => { if (seen.has(r.geo_key)) return false; seen.add(r.geo_key); return true; })
          .flatMap(r => {
            const meta = CITY_META[r.geo_key]; if (!meta) return [];
            const price = Number(r.median_price) || 0;
            return [{ ...meta, heat: Math.min(1, Math.max(0, Number(r.demand_score) / 100)), medianPrice: price, yoy: Number(r.appreciation_rate_yoy) || 0, dom: Number(r.days_on_market) || 0, inventory: Number(r.active_listings) || 0, tier: priceToTier(price) }];
          });
        if (live.length > 0) { setMarkets(live); setLastRefresh(new Date()); }
      });
  }, []);

  const fetchProperties = useCallback(() => {
    fetch('/.netlify/functions/get-market-properties')
      .then(r => r.json())
      .then(data => {
        if (data.properties?.length) { setProperties(data.properties); setLiveCount(data.liveCount || 0); }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchMarkets(); fetchProperties();
    const mkt = setInterval(fetchMarkets, 5 * 60 * 1000);
    const prop = setInterval(fetchProperties, 90 * 1000); // properties refresh every 90s
    return () => { clearInterval(mkt); clearInterval(prop); };
  }, [fetchMarkets, fetchProperties]);

  // Blink effect — cycle through properties to simulate live activity
  useEffect(() => {
    const t = setInterval(() => setBlinkIdx(i => (i + 1) % Math.max(1, properties.length)), 2200);
    return () => clearInterval(t);
  }, [properties.length]);

  const sorted = [...markets].sort((a, b) => {
    const v = sortAsc ? 1 : -1;
    if (sortKey === 'heat') return v * (a.heat - b.heat);
    if (sortKey === 'medianPrice') return v * (a.medianPrice - b.medianPrice);
    if (sortKey === 'yoy') return v * (a.yoy - b.yoy);
    return v * (a.dom - b.dom);
  });

  const tickerItems = [...properties, ...properties]; // double for seamless loop
  const center: [number, number] = [38.5, -96.5];

  return (
    <div style={{ background: '#080808', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'Jost, sans-serif' }}>
      <Nav onSignInClick={() => { setModalTab('signin'); setModalOpen(true); }} onRequestAccessClick={() => setPricingOpen(true)} />
      <AuthModal isOpen={modalOpen} initialView={modalTab} onClose={() => setModalOpen(false)} />
      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} />

      {/* ── LIVE TICKER BAR ── */}
      <div style={{ position: 'fixed', top: 64, left: 0, right: 0, zIndex: 400, background: '#0d0d0d', borderBottom: '1px solid rgba(0,255,136,0.15)', overflow: 'hidden', height: 38, display: 'flex', alignItems: 'center' }}>
        <div style={{ padding: '0 14px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88', animation: 'blink 1.4s ease-in-out infinite' }} />
          <span style={{ fontSize: 8, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(0,255,136,0.8)', fontWeight: 600 }}>LIVE</span>
          {liveCount > 0 && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{liveCount} tracked</span>}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div ref={tickerRef} style={{ display: 'flex', gap: 0, whiteSpace: 'nowrap', animation: 'ticker 70s linear infinite' }}>
            {tickerItems.map((p, i) => (
              <div key={`${p.id}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', borderRight: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, background: i === blinkIdx || i === blinkIdx + properties.length ? 'rgba(0,255,136,0.04)' : 'transparent', transition: 'background 0.4s' }}>
                <span style={{ fontSize: 9, letterSpacing: '1px', color: '#b0b0b0', fontWeight: 600 }}>{fmtAddr(p.address)}</span>
                <span style={{ fontSize: 10, color: '#e0e0e0', fontFamily: 'Cormorant Garamond, serif', fontWeight: 300 }}>{fmtPrice(p.price)}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: changeColor(p.change) }}>{fmtChange(p.change)}</span>
                {(i === blinkIdx || i === blinkIdx + properties.length) && (
                  <span style={{ fontSize: 7, letterSpacing: 1, color: '#00ff88', textTransform: 'uppercase', animation: 'fadein 0.3s ease' }}>●</span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '0 14px', flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.06)', fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>
          {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>

      {/* ── HEADER ── */}
      <section style={{ paddingTop: 120, paddingBottom: 20, paddingLeft: 'clamp(16px,4vw,48px)', paddingRight: 'clamp(16px,4vw,48px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 8, letterSpacing: '4px', textTransform: 'uppercase', color: 'rgba(0,255,136,0.7)', marginBottom: 6 }}>Market Intelligence · United States</div>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(26px,4vw,48px)', fontWeight: 300, color: '#f0f0f0', margin: 0, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              Live Property <em style={{ color: '#00ff88' }}>Heat Map</em>
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            {[
              ['Markets', markets.length],
              ['Properties', properties.length],
              ['Avg YoY', `${(markets.reduce((s,m)=>s+m.yoy,0)/Math.max(1,markets.length)).toFixed(1)}%`],
            ].map(([l, v]) => (
              <div key={String(l)} style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 8, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>{l}</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 300, color: '#f0f0f0' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MAP + RANKINGS ── */}
      <section style={{ padding: '16px clamp(16px,4vw,48px)', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 14, alignItems: 'start' }}>

          {/* Map */}
          <div style={{ position: 'relative' }}>
            <div style={{ height: 'clamp(400px,58vh,620px)', border: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden', filter: premium ? 'none' : 'brightness(0.5) saturate(0.4)' }}>
              <MapContainer center={center} zoom={4} style={{ height: '100%', width: '100%' }} zoomControl={premium} dragging={premium} scrollWheelZoom={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="© CARTO" />

                {/* City heat circles */}
                {markets.map(m => (
                  <CircleMarker key={`city-${m.name}`} center={[m.lat, m.lon]} radius={m.radius + m.heat * 10}
                    pathOptions={{ color: heatColor(m.heat), fillColor: heatColor(m.heat), fillOpacity: 0.18, weight: 1 }}>
                  </CircleMarker>
                ))}

                {/* Individual property dots — the ticker symbols */}
                {properties.map((p, idx) => (
                  <CircleMarker key={p.id} center={[p.lat, p.lon]}
                    radius={idx === blinkIdx ? 7 : 5}
                    pathOptions={{
                      color: changeColor(p.change),
                      fillColor: changeColor(p.change),
                      fillOpacity: idx === blinkIdx ? 0.95 : 0.75,
                      weight: idx === blinkIdx ? 2 : 1,
                    }}
                    eventHandlers={{ click: () => premium && setSelected(p) }}
                  >
                    {premium && (
                      <Popup>
                        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, background: '#111', color: '#e0e0e0', padding: '10px 14px', minWidth: 180 }}>
                          <div style={{ fontWeight: 600, marginBottom: 6, color: '#f0f0f0', fontFamily: 'Cormorant Garamond, serif', fontSize: 14 }}>{p.address}</div>
                          <div style={{ color: '#888', marginBottom: 4 }}>{p.city}</div>
                          <div style={{ color: '#ffbb00', fontSize: 16, fontFamily: 'Cormorant Garamond, serif' }}>{fmtPrice(p.price)}</div>
                          <div style={{ color: changeColor(p.change), fontWeight: 700, marginTop: 2 }}>{fmtChange(p.change)}</div>
                          <div style={{ color: '#666', marginTop: 4 }}>DOM: {p.dom} days</div>
                          {p.rating && <div style={{ marginTop: 4, color: '#C9A84C' }}>DNA: {p.rating}</div>}
                        </div>
                      </Popup>
                    )}
                  </CircleMarker>
                ))}
              </MapContainer>

              {!premium && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 1000 }}>
                  <PremiumLockOverlay headline="Unlock Live Market Intelligence" body="Street-level property tickers, pricing velocity, and opportunity zones across 2,800+ US markets." ctaLabel="Unlock Premium" onUpgrade={() => setPricingOpen(true)} />
                </div>
              )}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 20, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#00ff88' }} />
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>Price ↑</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff4444' }} />
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>Price ↓</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,136,0,0.3)', border: '1px solid #ff8800' }} />
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>City heat zone</span>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>
                Refreshes every 90s · {properties.length} properties tracked
              </div>
            </div>
          </div>

          {/* Rankings panel */}
          <div style={{ border: '1px solid rgba(255,255,255,0.07)', background: '#0d0d0d', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(0,255,136,0.7)' }}>Market Rankings</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['heat','yoy','dom'] as SortKey[]).map(k => (
                  <button key={k} onClick={() => { if (sortKey===k) setSortAsc(v=>!v); else { setSortKey(k); setSortAsc(false); } }}
                    style={{ fontSize: 7, letterSpacing: 1, textTransform: 'uppercase', background: sortKey===k ? 'rgba(0,255,136,0.1)' : 'transparent', color: sortKey===k ? '#00ff88' : 'rgba(255,255,255,0.3)', border: `1px solid ${sortKey===k ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.08)'}`, padding: '3px 7px', cursor: 'pointer' }}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
            {sorted.map((m, i) => (
              <div key={m.name} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: !premium && i > 2 ? 0.2 : 1, filter: !premium && i > 2 ? 'blur(4px)' : 'none', userSelect: !premium && i > 2 ? 'none' : 'auto' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 12, color: 'rgba(255,255,255,0.2)', minWidth: 16 }}>{i+1}</span>
                  <div>
                    <div style={{ fontSize: 11, color: '#e0e0e0', letterSpacing: '0.3px' }}>{m.name}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{fmtPrice(m.medianPrice)} · DOM {m.dom}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: changeColor(m.yoy) }}>{fmtChange(m.yoy)}</div>
                  <div style={{ fontSize: 8, marginTop: 2 }}>
                    <span style={{ display: 'inline-block', width: 32, height: 2, background: heatColor(m.heat), verticalAlign: 'middle', opacity: m.heat }} />
                  </div>
                </div>
              </div>
            ))}
            {!premium && (
              <div style={{ padding: 14 }}>
                <button onClick={() => setPricingOpen(true)} style={{ width: '100%', fontFamily: 'Jost, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: '#000', background: '#00ff88', border: 'none', padding: '11px 20px', cursor: 'pointer' }}>
                  Unlock All Markets →
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── SELECTED PROPERTY ── */}
      {selected && premium && (
        <section style={{ padding: '0 clamp(16px,4vw,48px) 12px', maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ border: '1px solid rgba(0,255,136,0.2)', background: '#0d0d0d', padding: '18px 24px', display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(0,255,136,0.5)', marginBottom: 4 }}>Property Detail</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 300, color: '#f0f0f0' }}>{selected.address}</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{selected.city}</div>
            </div>
            {([['Price', fmtPrice(selected.price), '#ffbb00'], ['Change', fmtChange(selected.change), changeColor(selected.change)], ['DOM', `${selected.dom}d`, '#e0e0e0'], ...(selected.rating ? [['DNA Rating', selected.rating, '#C9A84C']] : [])] as [string,string,string][]).map(([l,v,c]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>{l}</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 300, color: c }}>{v}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── PROPERTY TICKER TABLE ── */}
      <section style={{ padding: '14px clamp(16px,4vw,48px) 32px', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ border: '1px solid rgba(255,255,255,0.06)', background: '#0d0d0d', overflow: 'hidden' }}>
          <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(0,255,136,0.6)' }}>Property Ticker — Recent Activity</span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>Click row to highlight on map</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['#', 'Property', 'City', 'Price', 'Change', 'DOM', 'Signal'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {properties.map((p, i) => {
                  const isActive = i === blinkIdx;
                  return (
                    <tr key={p.id}
                      onClick={() => premium && setSelected(p)}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: premium ? 'pointer' : 'default', background: isActive ? 'rgba(0,255,136,0.03)' : selected?.id === p.id ? 'rgba(0,255,136,0.05)' : 'transparent', transition: 'background 0.2s', opacity: !premium && i > 4 ? 0.15 : 1, filter: !premium && i > 4 ? 'blur(5px)' : 'none', userSelect: !premium && i > 4 ? 'none' : 'auto' }}
                      onMouseEnter={e => { if (premium) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isActive ? 'rgba(0,255,136,0.03)' : 'transparent'; }}
                    >
                      <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>{i + 1}</td>
                      <td style={{ padding: '9px 14px', color: '#e0e0e0', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: changeColor(p.change), boxShadow: isActive ? `0 0 6px ${changeColor(p.change)}` : 'none', flexShrink: 0, transition: 'box-shadow 0.3s' }} />
                          {p.address}
                        </div>
                      </td>
                      <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>{p.city}</td>
                      <td style={{ padding: '9px 14px', color: '#ffbb00', fontFamily: 'Cormorant Garamond, serif', fontSize: 14 }}>{fmtPrice(p.price)}</td>
                      <td style={{ padding: '9px 14px', color: changeColor(p.change), fontWeight: 700 }}>{fmtChange(p.change)}</td>
                      <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>{p.dom}d</td>
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 36, height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, Math.abs(p.change) * 10)}%`, height: '100%', background: changeColor(p.change) }} />
                          </div>
                          {p.rating && <span style={{ fontSize: 9, color: '#C9A84C', letterSpacing: 1 }}>{p.rating}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!premium && (
            <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>Full property-level data available to Pro subscribers</span>
              <button onClick={() => setPricingOpen(true)} style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: '#000', background: '#00ff88', border: 'none', padding: '9px 18px', cursor: 'pointer', flexShrink: 0 }}>
                Unlock Premium
              </button>
            </div>
          )}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', marginTop: 8, letterSpacing: 1 }}>
          Live data from PropertyDNA reports + market_snapshots · Property dots refresh every 90s · City zones refresh every 5min · Not a licensed appraisal
        </div>
      </section>

      <Footer />

      <style>{`
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes fadein { from{opacity:0} to{opacity:1} }
        .leaflet-popup-content-wrapper { background:#111 !important; border:1px solid rgba(0,255,136,0.2) !important; border-radius:0 !important; box-shadow:none !important; }
        .leaflet-popup-tip { background:#111 !important; }
      `}</style>
    </div>
  );
}
