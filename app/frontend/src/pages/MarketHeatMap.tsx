import { useState, useEffect, useRef, useCallback } from 'react';
import Nav from '@/components/Nav';
import AuthModal from '@/components/AuthModal';
import PricingModal from '@/components/PricingModal';
import PremiumLockOverlay from '@/components/PremiumLockOverlay';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import HeatMapCanvas from '@/components/heatmap/HeatMapCanvas';
import FilterPanel from '@/components/heatmap/FilterPanel';
import HoverTooltip from '@/components/heatmap/HoverTooltip';
import PropertyDrawer from '@/components/heatmap/PropertyDrawer';
import type { HeatParcel, HeatFilterWeights, HeatHoverState } from '@/types/heatmap';
import { DEFAULT_HEAT_WEIGHTS, computeHeatScore, heatScoreLabel, heatScoreBadgeColor } from '@/lib/scoringHeatmap';
import { heatScoreToHex } from '@/lib/colorScaleHeatmap';

// ─── Layout constants ─────────────────────────────────────────────────────────

const NAV_H   = 64;
const TICK_H  = 36;
const BOT_H   = 40;
const LEFT_W  = 260;
const RIGHT_W = 300;

// ─── Style constants ──────────────────────────────────────────────────────────

const MONO   = "'Share Tech Mono', monospace";
const UI     = "'Rajdhani', sans-serif";
const G      = '#00ff88';
const R      = '#ff3355';
const GOLD   = '#ffb700';
const BG     = 'rgba(4,12,20,0.96)';
const BORDER = 'rgba(0,255,136,0.18)';
const T_M    = 'rgba(180,220,200,0.5)';
const T_P    = '#e8f4f0';
const OWNER  = 'stuartteamps@gmail.com';

// ─── Types ────────────────────────────────────────────────────────────────────

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

type ModalTab = 'signin' | 'pricing';
type SortKey  = 'heat' | 'yoy' | 'dom';

// ─── City meta ────────────────────────────────────────────────────────────────

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
  'palm-springs-ca': { name: 'Palm Springs, CA',  lat: 33.8303, lon: -116.5453, radius: 14 },
};

const FALLBACK_MARKETS: Market[] = [
  { name: 'Miami, FL',        lat: 25.7617, lon: -80.1918,  heat: 0.91, medianPrice: 650000,  yoy: 12.4, dom: 22, inventory: 4800,  tier: 'luxury',   radius: 18 },
  { name: 'Austin, TX',       lat: 30.2672, lon: -97.7431,  heat: 0.82, medianPrice: 548000,  yoy: 8.6,  dom: 28, inventory: 8200,  tier: 'premium',  radius: 18 },
  { name: 'Scottsdale, AZ',   lat: 33.4942, lon: -111.9261, heat: 0.78, medianPrice: 895000,  yoy: 7.2,  dom: 31, inventory: 2100,  tier: 'luxury',   radius: 16 },
  { name: 'Nashville, TN',    lat: 36.1627, lon: -86.7816,  heat: 0.75, medianPrice: 485000,  yoy: 9.1,  dom: 26, inventory: 5400,  tier: 'premium',  radius: 17 },
  { name: 'Seattle, WA',      lat: 47.6062, lon: -122.3321, heat: 0.73, medianPrice: 798000,  yoy: 7.4,  dom: 19, inventory: 3800,  tier: 'luxury',   radius: 18 },
  { name: 'Denver, CO',       lat: 39.7392, lon: -104.9903, heat: 0.71, medianPrice: 612000,  yoy: 6.8,  dom: 33, inventory: 6100,  tier: 'premium',  radius: 18 },
  { name: 'Los Angeles, CA',  lat: 34.0522, lon: -118.2437, heat: 0.69, medianPrice: 920000,  yoy: 5.2,  dom: 38, inventory: 11200, tier: 'luxury',   radius: 22 },
  { name: 'Palm Springs, CA', lat: 33.8303, lon: -116.5453, heat: 0.74, medianPrice: 780000,  yoy: 8.1,  dom: 25, inventory: 1200,  tier: 'luxury',   radius: 14 },
  { name: 'Dallas, TX',       lat: 32.7767, lon: -96.7970,  heat: 0.68, medianPrice: 425000,  yoy: 5.9,  dom: 37, inventory: 14200, tier: 'standard', radius: 20 },
  { name: 'Charlotte, NC',    lat: 35.2271, lon: -80.8431,  heat: 0.65, medianPrice: 398000,  yoy: 8.3,  dom: 29, inventory: 7200,  tier: 'standard', radius: 18 },
  { name: 'Tampa, FL',        lat: 27.9506, lon: -82.4572,  heat: 0.62, medianPrice: 412000,  yoy: 6.1,  dom: 34, inventory: 9400,  tier: 'standard', radius: 17 },
  { name: 'Phoenix, AZ',      lat: 33.4484, lon: -112.0740, heat: 0.58, medianPrice: 452000,  yoy: 4.8,  dom: 41, inventory: 18600, tier: 'standard', radius: 20 },
  { name: 'Chicago, IL',      lat: 41.8781, lon: -87.6298,  heat: 0.54, medianPrice: 328000,  yoy: 3.9,  dom: 45, inventory: 16400, tier: 'standard', radius: 20 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const priceToTier = (p: number) => p >= 1_500_000 ? 'ultra' : p >= 900_000 ? 'luxury' : p >= 650_000 ? 'premium' : p >= 400_000 ? 'standard' : 'entry';
const fmtPrice    = (p: number) => p >= 1_000_000 ? `$${(p / 1_000_000).toFixed(2)}M` : `$${(p / 1000).toFixed(0)}K`;
const fmtChange   = (c: number) => `${c >= 0 ? '+' : ''}${c.toFixed(1)}%`;
const fmtAddr     = (a: string) => a.length > 22 ? a.slice(0, 20) + '…' : a;
const yoyColor    = (y: number) => y >= 0 ? G : R;

// ─── Component ────────────────────────────────────────────────────────────────

export default function MarketHeatMap() {
  const { user, tier, loading: authLoading } = useAuth();
  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalTab,     setModalTab]     = useState<ModalTab>('signin');
  const [pricingOpen,  setPricingOpen]  = useState(false);

  const premium = !authLoading && (
    user?.email?.toLowerCase() === OWNER || tier !== 'free'
  );

  const [markets,       setMarkets]       = useState<Market[]>(FALLBACK_MARKETS);
  const [properties,    setProperties]    = useState<Property[]>([]);
  const [liveCount,     setLiveCount]     = useState(0);
  const [selected,      setSelected]      = useState<HeatParcel | null>(null);
  const [drawerParcel,  setDrawerParcel]  = useState<HeatParcel | null>(null);
  const [hover,         setHover]         = useState<HeatHoverState | null>(null);
  const [weights,       setWeights]       = useState<HeatFilterWeights>(DEFAULT_HEAT_WEIGHTS);
  const [parcels,       setParcels]       = useState<HeatParcel[]>([]);
  const [parcelCity,    setParcelCity]    = useState('');
  const [parcelLoading, setParcelLoading] = useState(false);
  const [blinkIdx,      setBlinkIdx]      = useState(0);
  const [clock,         setClock]         = useState('');
  const [sortKey,       setSortKey]       = useState<SortKey>('heat');
  const [sortAsc,       setSortAsc]       = useState(false);
  const [isMobile,      setIsMobile]      = useState(() => window.innerWidth < 768);
  const [mobileTab,     setMobileTab]     = useState<'markets' | 'intel'>('markets');

  const scoreCanvasRef = useRef<HTMLCanvasElement>(null);
  const sparkCanvasRef = useRef<HTMLCanvasElement>(null);
  const hoverTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Mobile resize ───────────────────────────────────────────────────────────

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Fonts & scroll lock ─────────────────────────────────────────────────────

  useEffect(() => {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@300;400;500;600;700&display=swap';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchMarkets = useCallback(() => {
    supabase.from('market_snapshots')
      .select('geo_key,median_price,appreciation_rate_yoy,demand_score,days_on_market,active_listings')
      .eq('geo_type', 'city').order('snapshot_date', { ascending: false })
      .then(({ data }) => {
        if (!data?.length) return;
        const seen = new Set<string>();
        const live: Market[] = data
          .filter(r => { if (seen.has(r.geo_key)) return false; seen.add(r.geo_key); return true; })
          .flatMap(r => {
            const meta = CITY_META[r.geo_key]; if (!meta) return [];
            const price = Number(r.median_price) || 0;
            return [{ ...meta, heat: Math.min(1, Math.max(0, Number(r.demand_score) / 100)), medianPrice: price, yoy: Number(r.appreciation_rate_yoy) || 0, dom: Number(r.days_on_market) || 0, inventory: Number(r.active_listings) || 0, tier: priceToTier(price) }];
          });
        if (live.length > 0) setMarkets(live);
      });
  }, []);

  const fetchProperties = useCallback(() => {
    fetch('/.netlify/functions/get-market-properties')
      .then(r => r.json())
      .then(data => { if (data.properties?.length) { setProperties(data.properties); setLiveCount(data.liveCount || 0); } })
      .catch(() => {});
  }, []);

  const fetchParcels = useCallback((city: string, state = 'CA') => {
    if (!premium || city === parcelCity || parcelLoading) return;
    setParcelLoading(true);
    setParcelCity(city);
    const qs = new URLSearchParams({ city, state });
    fetch(`/.netlify/functions/get-heatmap-parcels?${qs}`)
      .then(r => r.json())
      .then(data => {
        if (data.parcels?.length) {
          const scored = (data.parcels as HeatParcel[]).map(p => ({ ...p, score: computeHeatScore(p, weights) }));
          setParcels(scored);
        }
      })
      .catch(() => {})
      .finally(() => setParcelLoading(false));
  }, [premium, parcelCity, parcelLoading, weights]);

  useEffect(() => {
    fetchMarkets(); fetchProperties();
    const mkt  = setInterval(fetchMarkets, 5 * 60 * 1000);
    const prop = setInterval(fetchProperties, 90 * 1000);
    return () => { clearInterval(mkt); clearInterval(prop); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (premium && !parcelCity) fetchParcels('Palm Springs', 'CA');
  }, [premium]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setBlinkIdx(i => (i + 1) % Math.max(1, properties.length)), 2200);
    return () => clearInterval(t);
  }, [properties.length]);

  useEffect(() => {
    if (parcels.length) setParcels(prev => prev.map(p => ({ ...p, score: computeHeatScore(p, weights) })));
  }, [weights]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Canvas drawing ──────────────────────────────────────────────────────────

  const drawScoreRing = useCallback((score: number) => {
    const c = scoreCanvasRef.current;
    if (!c) return;
    const ctx   = c.getContext('2d')!;
    const color = heatScoreToHex(score);
    const start = -Math.PI * 0.75;
    const end   = start + Math.PI * 1.5 * (score / 100);
    ctx.clearRect(0, 0, 120, 120);
    ctx.beginPath(); ctx.arc(60, 60, 50, -Math.PI * 0.75, Math.PI * 0.75);
    ctx.strokeStyle = 'rgba(0,255,136,0.08)'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(60, 60, 50, start, end);
    ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke();
  }, []);

  const drawSparkline = useCallback((sparkline: number[]) => {
    const canvas = sparkCanvasRef.current;
    if (!canvas || sparkline.length < 2) return;
    const W = canvas.parentElement?.clientWidth || 268;
    const H = 60;
    canvas.width  = W;
    canvas.height = H;

    const mn   = Math.min(...sparkline) * 0.995;
    const mx   = Math.max(...sparkline) * 1.005;
    const pts  = sparkline.length;
    const pad  = { l: 6, r: 6, t: 6, b: 6 };
    const W2   = W - pad.l - pad.r;
    const H2   = H - pad.t - pad.b;
    const px   = (i: number) => pad.l + (i / (pts - 1)) * W2;
    const py   = (v: number) => pad.t + H2 - ((v - mn) / (mx - mn || 1)) * H2;

    const ctx      = canvas.getContext('2d')!;
    const trending = sparkline[pts - 1] >= sparkline[0];
    const color    = trending ? G : R;

    ctx.clearRect(0, 0, W, H);

    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + H2);
    grad.addColorStop(0, trending ? 'rgba(0,255,136,0.2)' : 'rgba(255,51,85,0.2)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.beginPath();
    sparkline.forEach((v, i) => i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v)));
    ctx.lineTo(px(pts - 1), pad.t + H2); ctx.lineTo(pad.l, pad.t + H2);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    sparkline.forEach((v, i) => i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v)));
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.beginPath(); ctx.arc(px(pts - 1), py(sparkline[pts - 1]), 3, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }, []);

  useEffect(() => {
    const c = scoreCanvasRef.current;
    if (!selected) {
      if (c) c.getContext('2d')?.clearRect(0, 0, 120, 120);
      return;
    }
    drawScoreRing(selected.score);
    requestAnimationFrame(() => drawSparkline(selected.sparkline));
  }, [selected, drawScoreRing, drawSparkline]);

  // ── Interactions ─────────────────────────────────────────────────────────────

  const handleHover = useCallback((state: HeatHoverState | null) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (!state) { hoverTimer.current = setTimeout(() => setHover(null), 80); return; }
    hoverTimer.current = setTimeout(() => setHover(state), 150);
  }, []);

  const handleParcelSelect = useCallback((p: HeatParcel) => {
    setHover(null);
    setSelected(p);
    if (window.innerWidth < 768) setMobileTab('intel');
  }, []);

  const handleCityClick = useCallback((city: { name: string; lat: number; lon: number }) => {
    const parts = city.name.split(', ');
    fetchParcels(parts[0], parts[1] || 'CA');
  }, [fetchParcels]);

  const sorted = [...markets].sort((a, b) => {
    const v = sortAsc ? 1 : -1;
    if (sortKey === 'heat') return v * (a.heat - b.heat);
    if (sortKey === 'yoy')  return v * (a.yoy  - b.yoy);
    return v * (a.dom - b.dom);
  });

  const tickerItems   = [...properties, ...properties];
  const cityMarketsForMap = markets.map(m => ({ name: m.name, lat: m.lat, lon: m.lon, heat: m.heat, medianPrice: m.medianPrice, yoy: m.yoy }));
  const avgYoy        = markets.length ? (markets.reduce((s, m) => s + m.yoy, 0) / markets.length).toFixed(1) : '—';

  // ── Mobile render ─────────────────────────────────────────────────────────────

  const sharedModals = (
    <>
      <Nav onSignInClick={() => { setModalTab('signin'); setModalOpen(true); }} onRequestAccessClick={() => setPricingOpen(true)} />
      <AuthModal   isOpen={modalOpen}   initialView={modalTab} onClose={() => setModalOpen(false)} />
      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} />
      <PropertyDrawer
        parcel={drawerParcel}
        onClose={() => setDrawerParcel(null)}
        onNeedAuth={() => { setDrawerParcel(null); setModalTab('signin'); setModalOpen(true); }}
      />
      {hover && <HoverTooltip hover={hover} />}
    </>
  );

  if (isMobile) {
    const TAB_H  = 48;
    const MINI_H = 30;
    const MAP_H  = `calc(100vh - ${NAV_H}px - ${TICK_H}px - ${TAB_H}px - ${MINI_H}px - 45px)`;

    return (
      <>
        {sharedModals}
        <div style={{ position: 'fixed', top: NAV_H, left: 0, right: 0, bottom: 0, background: '#020408', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 10 }}>

          {/* Ticker */}
          <div style={{ height: TICK_H, flexShrink: 0, background: 'rgba(4,12,20,0.99)', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            <div style={{ padding: '0 10px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, borderRight: `1px solid ${BORDER}`, height: '100%' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: G, boxShadow: `0 0 6px ${G}`, animation: 'hm-blink 1.4s ease-in-out infinite' }} />
              <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 2, color: G }}>LIVE</span>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', whiteSpace: 'nowrap', animation: 'hm-ticker 60s linear infinite' }}>
                {tickerItems.map((p, i) => (
                  <div key={`${p.id}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', borderRight: `1px solid rgba(0,255,136,0.05)`, flexShrink: 0 }}>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: T_M }}>{fmtAddr(p.address)}</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: T_P }}>{fmtPrice(p.price)}</span>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: yoyColor(p.change) }}>{fmtChange(p.change)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Map */}
          <div style={{ height: MAP_H, flexShrink: 0, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, filter: premium ? 'none' : 'brightness(0.45) saturate(0.3)' }}>
              <HeatMapCanvas
                parcels={parcels} cityMarkets={cityMarketsForMap} weights={weights}
                loading={parcelLoading} premium={premium}
                onHover={handleHover} onSelect={handleParcelSelect} onCityClick={handleCityClick}
              />
            </div>
            {premium && (
              <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 20 }}>
                <FilterPanel weights={weights} onChange={setWeights} />
              </div>
            )}
            {!premium && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 1000 }}>
                <PremiumLockOverlay
                  headline="Unlock 168K Indexed Properties"
                  body="Full Coachella Valley parcel-level DNA scoring."
                  ctaLabel="Unlock Premium"
                  onUpgrade={() => setPricingOpen(true)}
                />
              </div>
            )}
            {parcelCity && (
              <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(4,12,20,0.85)', border: `1px solid ${BORDER}`, padding: '4px 10px', fontFamily: MONO, fontSize: 8, color: G, letterSpacing: 1 }}>
                {parcelLoading ? '● LOADING…' : `● ${parcels.length.toLocaleString()} PARCELS`}
              </div>
            )}
          </div>

          {/* Mobile tab bar */}
          <div style={{ height: TAB_H, flexShrink: 0, display: 'flex', borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid rgba(0,255,136,0.06)`, background: 'rgba(4,12,20,0.99)' }}>
            {(['markets', 'intel'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                style={{ flex: 1, fontFamily: MONO, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', background: mobileTab === tab ? 'rgba(0,255,136,0.1)' : 'transparent', color: mobileTab === tab ? G : T_M, border: 'none', cursor: 'pointer', borderBottom: mobileTab === tab ? `2px solid ${G}` : '2px solid transparent' }}
              >
                {tab === 'intel' ? 'DNA INTEL' : 'MARKETS'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' as const }}>

            {/* MARKETS tab */}
            {mobileTab === 'markets' && (
              <div>
                {sorted.map((m, i) => {
                  const locked = !premium && i >= 3;
                  const active = !!(parcelCity && m.name.startsWith(parcelCity));
                  return (
                    <div
                      key={m.name}
                      onClick={() => !locked && premium && handleCityClick({ name: m.name, lat: m.lat, lon: m.lon })}
                      style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid rgba(0,255,136,0.04)', background: active ? 'rgba(0,255,136,0.07)' : 'transparent', borderLeft: `2px solid ${active ? G : 'transparent'}`, filter: locked ? 'blur(4px)' : 'none', userSelect: locked ? 'none' : 'auto', gap: 10 }}
                    >
                      <div style={{ fontFamily: MONO, fontSize: 9, color: T_M, width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: UI, fontSize: 14, fontWeight: 600, color: active ? G : T_P, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: T_M, marginTop: 2 }}>{fmtPrice(m.medianPrice)} · DOM {m.dom}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: yoyColor(m.yoy) }}>{m.yoy >= 0 ? '+' : ''}{m.yoy.toFixed(1)}%</div>
                        <div style={{ fontFamily: MONO, fontSize: 8, color: T_M, marginTop: 2 }}>HEAT {Math.round(m.heat * 100)}</div>
                      </div>
                    </div>
                  );
                })}
                {!premium && (
                  <div style={{ padding: 14 }}>
                    <button onClick={() => setPricingOpen(true)} style={{ width: '100%', fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: '#000', background: G, border: 'none', padding: '12px 0', cursor: 'pointer' }}>
                      Unlock All Markets →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* INTEL tab */}
            {mobileTab === 'intel' && (
              <div>
                {/* Score ring */}
                <div style={{ padding: '16px 14px', borderBottom: `1px solid rgba(0,255,136,0.06)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ position: 'relative', width: 110, height: 110 }}>
                    <canvas ref={scoreCanvasRef} width={110} height={110} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontFamily: MONO, fontSize: selected ? 28 : 22, fontWeight: 700, lineHeight: 1, color: selected ? heatScoreToHex(selected.score) : T_M }}>
                        {selected ? selected.score : '—'}
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: T_M }}>DNA SCORE</div>
                    </div>
                  </div>
                  {selected ? (
                    <>
                      <div style={{ fontFamily: UI, fontSize: 15, fontWeight: 600, color: heatScoreBadgeColor(selected.score), textTransform: 'uppercase' }}>{heatScoreLabel(selected.score)}</div>
                      <div style={{ fontFamily: UI, fontSize: 13, color: T_P, textAlign: 'center' }}>{selected.street}</div>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: T_M }}>{selected.city}, {selected.state}</div>
                    </>
                  ) : (
                    <div style={{ fontFamily: UI, fontSize: 13, color: T_M, textAlign: 'center', lineHeight: 1.6 }}>Tap any parcel on the map<br />to run DNA analysis</div>
                  )}
                </div>

                {selected && (
                  <>
                    {/* Metrics grid */}
                    <div style={{ padding: '12px 14px', borderBottom: `1px solid rgba(0,255,136,0.06)` }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 8px' }}>
                        {([
                          ['PRICE',   selected.price > 0 ? fmtPrice(selected.price) : '—'],
                          ['SQFT',    selected.sqft > 0 ? `${selected.sqft.toLocaleString()}` : '—'],
                          ['DOM',     selected.dom > 0 ? `${selected.dom}d` : '—'],
                          ['BED/BATH',selected.bedrooms > 0 ? `${selected.bedrooms}/${selected.bathrooms}` : '—'],
                          ['YR BUILT',selected.yearBuilt > 0 ? String(selected.yearBuilt) : '—'],
                          ['$/SQFT',  selected.pricePerSqft > 0 ? `$${selected.pricePerSqft}` : '—'],
                        ] as [string,string][]).map(([l,v]) => (
                          <div key={l}>
                            <div style={{ fontFamily: MONO, fontSize: 7, color: T_M, letterSpacing: 1.5 }}>{l}</div>
                            <div style={{ fontFamily: MONO, fontSize: 11, color: T_P, fontWeight: 600, marginTop: 2 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sub-score bars */}
                    <div style={{ padding: '10px 14px', borderBottom: `1px solid rgba(0,255,136,0.06)` }}>
                      <div style={{ fontFamily: MONO, fontSize: 7, color: T_M, letterSpacing: 2, marginBottom: 8 }}>SCORE BREAKDOWN</div>
                      {([
                        ['COMPS',      selected.compsScore],
                        ['PRICE Δ',    selected.priceDeltaScore],
                        ['DOM',        selected.domScore],
                        ['PERMITS',    selected.permitsScore],
                        ['LIVABILITY', selected.livability],
                        ['RENTAL',     selected.rentalDemand],
                      ] as [string,number][]).map(([label, score]) => {
                        const barColor = score >= 70 ? G : score >= 50 ? GOLD : R;
                        return (
                          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                            <div style={{ fontFamily: MONO, fontSize: 7, color: T_M, width: 55, flexShrink: 0 }}>{label}</div>
                            <div style={{ flex: 1, height: 3, background: 'rgba(0,255,136,0.08)', position: 'relative' }}>
                              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${score}%`, background: barColor }} />
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: 8, color: barColor, width: 22, textAlign: 'right', flexShrink: 0 }}>{score}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Sparkline */}
                    {selected.sparkline?.length > 1 && (
                      <div style={{ padding: '8px 14px', borderBottom: `1px solid rgba(0,255,136,0.06)` }}>
                        <div style={{ fontFamily: MONO, fontSize: 7, color: T_M, letterSpacing: 2, marginBottom: 4 }}>PRICE TREND</div>
                        <canvas ref={sparkCanvasRef} style={{ width: '100%', height: 56, display: 'block' }} />
                      </div>
                    )}

                    {/* CTA */}
                    <div style={{ padding: '14px' }}>
                      <button
                        onClick={() => setDrawerParcel(selected)}
                        style={{ width: '100%', fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: '#000', background: G, border: 'none', padding: '14px 0', cursor: 'pointer', boxShadow: `0 0 20px rgba(0,255,136,0.2)` }}
                      >
                        Generate Full DNA Report
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Mini status strip */}
          <div style={{ height: MINI_H, flexShrink: 0, background: 'rgba(4,12,20,0.99)', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 14 }}>
            <span style={{ fontFamily: MONO, fontSize: 8, color: T_M }}>168K INDEXED</span>
            <span style={{ fontFamily: MONO, fontSize: 8, color: GOLD }}>IntellaGraph AI</span>
            <span style={{ fontFamily: MONO, fontSize: 8, color: T_M, marginLeft: 'auto' }}>{clock}</span>
          </div>

        </div>
        <style>{`
          @keyframes hm-ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
          @keyframes hm-blink  { 0%,100%{opacity:1} 50%{opacity:0.2} }
        `}</style>
      </>
    );
  }

  // ── Desktop render ────────────────────────────────────────────────────────────

  return (
    <>
      <Nav onSignInClick={() => { setModalTab('signin'); setModalOpen(true); }} onRequestAccessClick={() => setPricingOpen(true)} />
      <AuthModal   isOpen={modalOpen}   initialView={modalTab} onClose={() => setModalOpen(false)} />
      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} />
      <PropertyDrawer
        parcel={drawerParcel}
        onClose={() => setDrawerParcel(null)}
        onNeedAuth={() => { setDrawerParcel(null); setModalTab('signin'); setModalOpen(true); }}
      />
      {hover && <HoverTooltip hover={hover} />}

      {/* ── Terminal shell ── */}
      <div style={{ position: 'fixed', top: NAV_H, left: 0, right: 0, bottom: 0, background: '#020408', overflow: 'hidden', zIndex: 10 }}>

        {/* ── TICKER BAR ── */}
        <div data-hm-ui style={{ position: 'absolute', top: 0, left: 0, right: 0, height: TICK_H, zIndex: 100, background: 'rgba(4,12,20,0.99)', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <div style={{ padding: '0 12px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, borderRight: `1px solid ${BORDER}`, height: '100%' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: G, boxShadow: `0 0 8px ${G}`, animation: 'hm-blink 1.4s ease-in-out infinite' }} />
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: G }}>LIVE</span>
            {liveCount > 0 && <span style={{ fontFamily: MONO, fontSize: 8, color: T_M }}>{liveCount}</span>}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', whiteSpace: 'nowrap', animation: 'hm-ticker 80s linear infinite' }}>
              {tickerItems.map((p, i) => (
                <div key={`${p.id}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', borderRight: `1px solid rgba(0,255,136,0.05)`, flexShrink: 0, background: i === blinkIdx || i === blinkIdx + properties.length ? 'rgba(0,255,136,0.04)' : 'transparent', transition: 'background 0.4s' }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: T_M }}>{fmtAddr(p.address)}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: T_P }}>{fmtPrice(p.price)}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: yoyColor(p.change) }}>{fmtChange(p.change)}</span>
                  {(i === blinkIdx || i === blinkIdx + properties.length) && <span style={{ fontSize: 7, color: G }}>●</span>}
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '0 12px', flexShrink: 0, borderLeft: `1px solid ${BORDER}`, fontFamily: MONO, fontSize: 8, color: T_M, letterSpacing: 1 }}>
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>

        {/* ── LEFT PANEL: Market Index ── */}
        <div data-hm-ui style={{ position: 'absolute', top: TICK_H, left: 0, width: LEFT_W, bottom: BOT_H, background: BG, borderRight: `1px solid ${BORDER}`, zIndex: 90, display: 'flex', flexDirection: 'column', backdropFilter: 'blur(12px)' }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 3, color: G, textTransform: 'uppercase', marginBottom: 8 }}>Market Index</div>
            <input
              type="text"
              placeholder="SEARCH CITY..."
              onChange={e => {
                const q = e.target.value.toLowerCase();
                if (!q) return;
                const match = markets.find(m => m.name.toLowerCase().includes(q));
                if (match && premium) handleCityClick({ name: match.name, lat: match.lat, lon: match.lon });
              }}
              style={{ width: '100%', background: 'rgba(0,255,136,0.04)', border: `1px solid ${BORDER}`, color: T_P, fontFamily: MONO, fontSize: 10, padding: '6px 10px', outline: 'none', boxSizing: 'border-box' as const }}
            />
          </div>
          <div style={{ padding: '5px 14px', borderBottom: `1px solid rgba(0,255,136,0.06)`, display: 'flex', gap: 5 }}>
            {(['heat', 'yoy', 'dom'] as SortKey[]).map(k => (
              <button
                key={k}
                onClick={() => { if (sortKey === k) setSortAsc(v => !v); else { setSortKey(k); setSortAsc(false); } }}
                style={{ fontFamily: MONO, fontSize: 7, letterSpacing: 1.5, textTransform: 'uppercase', padding: '3px 7px', cursor: 'pointer', background: sortKey === k ? 'rgba(0,255,136,0.1)' : 'transparent', color: sortKey === k ? G : T_M, border: `1px solid ${sortKey === k ? BORDER : 'transparent'}` }}
              >
                {k}{sortKey === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' as const }}>
            {sorted.map((m, i) => {
              const locked  = !premium && i >= 3;
              const active  = !!(parcelCity && m.name.startsWith(parcelCity));
              const barW    = Math.round(m.heat * 36);
              const barColor = m.heat >= 0.75 ? R : m.heat >= 0.5 ? GOLD : G;
              return (
                <div
                  key={m.name}
                  onClick={() => !locked && premium && handleCityClick({ name: m.name, lat: m.lat, lon: m.lon })}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '8px 14px',
                    borderBottom: '1px solid rgba(0,255,136,0.04)',
                    cursor: locked ? 'default' : premium ? 'pointer' : 'default', gap: 8,
                    background: active ? 'rgba(0,255,136,0.07)' : 'transparent',
                    borderLeft: `2px solid ${active ? G : 'transparent'}`,
                    filter: locked ? 'blur(4px)' : 'none',
                    userSelect: locked ? 'none' : 'auto',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ fontFamily: MONO, fontSize: 9, color: T_M, width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: UI, fontSize: 12, fontWeight: 600, color: active ? G : T_P, letterSpacing: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: T_M, marginTop: 1 }}>{fmtPrice(m.medianPrice)} · DOM {m.dom}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: yoyColor(m.yoy) }}>{m.yoy >= 0 ? '+' : ''}{m.yoy.toFixed(1)}%</div>
                    <div style={{ width: barW, height: 2, background: barColor, marginTop: 3, marginLeft: 'auto', opacity: 0.7 + m.heat * 0.3 }} />
                  </div>
                </div>
              );
            })}
            {!premium && (
              <div style={{ padding: 12 }}>
                <button
                  onClick={() => setPricingOpen(true)}
                  style={{ width: '100%', fontFamily: MONO, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#000', background: G, border: 'none', padding: '10px 0', cursor: 'pointer' }}
                >
                  Unlock All Markets →
                </button>
              </div>
            )}
          </div>
          {parcelCity && (
            <div style={{ padding: '7px 14px', borderTop: `1px solid ${BORDER}`, background: 'rgba(0,255,136,0.03)' }}>
              <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 2, color: parcelLoading ? GOLD : G }}>
                {parcelLoading ? '● LOADING PARCELS…' : `● ${parcels.length.toLocaleString()} PARCELS · ${parcelCity.toUpperCase()}`}
              </div>
            </div>
          )}
        </div>

        {/* ── MAP (center) ── */}
        <div style={{ position: 'absolute', top: TICK_H, left: LEFT_W, right: RIGHT_W, bottom: BOT_H }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', filter: premium ? 'none' : 'brightness(0.45) saturate(0.3)' }}>
            <HeatMapCanvas
              parcels={parcels}
              cityMarkets={cityMarketsForMap}
              weights={weights}
              loading={parcelLoading}
              premium={premium}
              onHover={handleHover}
              onSelect={handleParcelSelect}
              onCityClick={handleCityClick}
            />
            {premium && (
              <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 20 }}>
                <FilterPanel weights={weights} onChange={setWeights} />
              </div>
            )}
            {!premium && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 1000 }}>
                <PremiumLockOverlay
                  headline="Unlock 168K Indexed Properties"
                  body="Street-level DNA scoring across the entire Coachella Valley — every parcel, Bloomberg-style."
                  ctaLabel="Unlock Premium"
                  onUpgrade={() => setPricingOpen(true)}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: DNA Intelligence ── */}
        <div data-hm-ui style={{ position: 'absolute', top: TICK_H, right: 0, width: RIGHT_W, bottom: BOT_H, background: BG, borderLeft: `1px solid ${BORDER}`, zIndex: 90, display: 'flex', flexDirection: 'column', backdropFilter: 'blur(12px)' }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, fontFamily: MONO, fontSize: 9, letterSpacing: 3, color: G, textTransform: 'uppercase' }}>
            DNA Intelligence
          </div>

          {/* Score ring — always visible */}
          <div style={{ padding: '16px 14px', borderBottom: `1px solid rgba(0,255,136,0.06)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', width: 120, height: 120 }}>
              <canvas ref={scoreCanvasRef} width={120} height={120} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontFamily: MONO, fontSize: selected ? 32 : 26, fontWeight: 700, lineHeight: 1, color: selected ? heatScoreToHex(selected.score) : T_M }}>
                  {selected ? selected.score : '—'}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1, color: T_M }}>DNA SCORE</div>
              </div>
            </div>
            {selected ? (
              <>
                <div style={{ fontFamily: UI, fontSize: 13, fontWeight: 600, letterSpacing: 1, color: heatScoreBadgeColor(selected.score), textTransform: 'uppercase' }}>
                  {heatScoreLabel(selected.score)}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 8, color: T_M, letterSpacing: 1 }}>
                  {Math.round(selected.confidence * 100)}% MODEL CONFIDENCE
                </div>
              </>
            ) : (
              <div style={{ fontFamily: UI, fontSize: 11, color: T_M, textAlign: 'center', lineHeight: 1.7 }}>
                Click any parcel<br />on the map to analyze
              </div>
            )}
          </div>

          {/* Selection details */}
          {selected ? (
            <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' as const }}>

              {/* Address */}
              <div style={{ padding: '10px 14px', borderBottom: `1px solid rgba(0,255,136,0.06)`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: UI, fontSize: 12, fontWeight: 600, color: T_P, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.street}</div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: T_M, marginTop: 2 }}>{selected.city}, {selected.state} {selected.zip}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: T_M, fontSize: 16, cursor: 'pointer', padding: '0 0 0 8px', flexShrink: 0 }}>×</button>
              </div>

              {/* Key metrics grid */}
              <div style={{ padding: '10px 14px', borderBottom: `1px solid rgba(0,255,136,0.06)` }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 10px' }}>
                  {([
                    ['LIST PRICE',    selected.price > 0 ? fmtPrice(selected.price) : '—'],
                    ['PER SQFT',      selected.pricePerSqft > 0 ? `$${selected.pricePerSqft}` : '—'],
                    ['SIZE',          selected.sqft > 0 ? `${selected.sqft.toLocaleString()} sf` : '—'],
                    ['BEDS / BATHS',  selected.bedrooms > 0 ? `${selected.bedrooms} / ${selected.bathrooms}` : '—'],
                    ['YEAR BUILT',    selected.yearBuilt > 0 ? String(selected.yearBuilt) : '—'],
                    ['DOM',           selected.dom > 0 ? `${selected.dom}d` : '—'],
                  ] as [string, string][]).map(([l, v]) => (
                    <div key={l}>
                      <div style={{ fontFamily: MONO, fontSize: 7, color: T_M, letterSpacing: 2, textTransform: 'uppercase' }}>{l}</div>
                      <div style={{ fontFamily: MONO, fontSize: 12, color: T_P, fontWeight: 600, marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub-score bars */}
              <div style={{ padding: '10px 14px', borderBottom: `1px solid rgba(0,255,136,0.06)` }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: T_M, letterSpacing: 2, marginBottom: 8 }}>SCORE BREAKDOWN</div>
                {([
                  ['COMPS',      selected.compsScore],
                  ['PRICE Δ',    selected.priceDeltaScore],
                  ['DOM',        selected.domScore],
                  ['PERMITS',    selected.permitsScore],
                  ['LIVABILITY', selected.livability],
                  ['RENTAL',     selected.rentalDemand],
                ] as [string, number][]).map(([label, score]) => {
                  const barColor = score >= 70 ? G : score >= 50 ? GOLD : R;
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: T_M, width: 58, flexShrink: 0 }}>{label}</div>
                      <div style={{ flex: 1, height: 3, background: 'rgba(0,255,136,0.08)', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${score}%`, background: barColor, transition: 'width 0.6s ease' }} />
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: barColor, width: 22, textAlign: 'right', flexShrink: 0 }}>{score}</div>
                    </div>
                  );
                })}
              </div>

              {/* Sparkline */}
              {selected.sparkline?.length > 1 && (
                <div style={{ borderBottom: `1px solid rgba(0,255,136,0.06)` }}>
                  <div style={{ padding: '8px 14px 2px', fontFamily: MONO, fontSize: 8, color: T_M, letterSpacing: 2 }}>PRICE TREND</div>
                  <div style={{ padding: '0 14px 10px' }}>
                    <canvas ref={sparkCanvasRef} style={{ width: '100%', height: 60, display: 'block' }} />
                  </div>
                </div>
              )}

              {/* CTA */}
              <div style={{ padding: '14px' }}>
                <button
                  onClick={() => setDrawerParcel(selected)}
                  style={{ width: '100%', fontFamily: MONO, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#000', background: G, border: 'none', padding: '12px 0', cursor: 'pointer', boxShadow: `0 0 20px rgba(0,255,136,0.15)` }}
                >
                  Generate Full DNA Report
                </button>
                <div style={{ fontFamily: MONO, fontSize: 8, color: T_M, textAlign: 'center', marginTop: 6 }}>
                  Powered by PropertyDNA AI
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(180,220,200,0.25)', letterSpacing: 1, textAlign: 'center', lineHeight: 1.8 }}>
                {parcels.length > 0
                  ? `${parcels.length.toLocaleString()} PARCELS INDEXED\n${parcelCity.toUpperCase()}`
                  : premium ? 'CLICK A CITY TO LOAD PARCELS' : 'PREMIUM REQUIRED'}
              </div>
            </div>
          )}
        </div>

        {/* ── BOTTOM STATUS BAR ── */}
        <div data-hm-ui style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: BOT_H, background: BG, borderTop: `1px solid ${BORDER}`, zIndex: 100, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 20, backdropFilter: 'blur(12px)', overflow: 'hidden' }}>
          {([
            ['MARKETS',  markets.length.toString()],
            ['INDEXED',  '168K'],
            ['AVG YOY',  `${avgYoy}%`],
            ['ACTIVE',   parcelCity || '—'],
            ['PARCELS',  parcels.length > 0 ? parcels.length.toLocaleString() : '—'],
            ['DATA',     'REAL-TIME'],
          ] as [string, string][]).map(([label, val]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 10, flexShrink: 0 }}>
              <span style={{ color: T_M }}>{label}</span>
              <span style={{ color: val === 'REAL-TIME' ? G : val === '168K' ? GOLD : T_P }}>{val}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10, flexShrink: 0 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: G, boxShadow: `0 0 8px ${G}`, animation: 'hm-pulse 2s infinite' }} />
            <span style={{ color: T_M }}>REFRESH</span>
            <span style={{ color: T_P }}>{clock}</span>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes hm-ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes hm-blink  { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes hm-pulse  { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </>
  );
}
