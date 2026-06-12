/**
 * /stock/:symbol — Robinhood-style stock view for any indexed property.
 *
 * Every home in America gets a ticker. This page is the Robinhood card:
 * symbol + price + chart + risk score + history + watch button.
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

const C = {
  bg: '#0A0908', card: '#12100D', border: 'rgba(255,255,255,0.08)',
  gold: '#C9A84C', text: '#F4F0E8', muted: 'rgba(244,240,232,0.55)',
  green: '#00cc77', red: '#ff4444', amber: '#ff8800',
};
const FONT_SERIF = "'Cormorant Garamond', Georgia, serif";
const FONT_SANS  = "'Jost', -apple-system, BlinkMacSystemFont, sans-serif";
const FONT_MONO  = "'Share Tech Mono', monospace";

interface TickerData {
  ticker: string;
  apn?: string;
  address_line1?: string;
  city?: string; state?: string; zip?: string;
  beds?: number; baths?: number; sqft?: number;
  year_built?: number;
  rentcast_value?: number;
  market_price_yoy?: number;
  last_sale_date?: string;
  last_sale_price?: number;
  latitude?: number; longitude?: number;
}

const fmtUSD = (n?: number) => n == null ? '—' : n >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${Math.round(n/1_000).toLocaleString()}K` : `$${n.toLocaleString()}`;

// Synthetic price series — interpolates last_sale_price → current value over the
// hold period using the YoY trend. Renders a "stock chart" feel.
function buildPriceSeries(d: TickerData): { x: number; y: number; label: string }[] {
  if (!d.last_sale_price || !d.rentcast_value) return [];
  const start = d.last_sale_price;
  const end = d.rentcast_value;
  const saleDate = d.last_sale_date ? new Date(d.last_sale_date) : new Date(Date.now() - 5 * 365 * 86400000);
  const months = Math.max(6, Math.round((Date.now() - saleDate.getTime()) / (30.44 * 86400000)));
  const series = [];
  const monthly = Math.pow(end / start, 1 / months);
  for (let i = 0; i <= months; i += Math.max(1, Math.floor(months / 24))) {
    const d2 = new Date(saleDate.getTime() + i * 30.44 * 86400000);
    const v = start * Math.pow(monthly, i);
    // Add subtle noise so it looks like a real chart
    const noise = 1 + (((i * 7) % 13 - 6) / 100) * 0.4;
    series.push({ x: i, y: v * noise, label: d2.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) });
  }
  series.push({ x: months + 1, y: end, label: 'Now' });
  return series;
}

function PriceChart({ data, gain }: { data: { x: number; y: number; label: string }[]; gain: boolean }) {
  if (data.length < 2) return null;
  const W = 600, H = 200, PAD = 30;
  const xs = data.map(d => d.x);
  const ys = data.map(d => d.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys) * 0.98, yMax = Math.max(...ys) * 1.02;
  const sx = (x: number) => PAD + ((x - xMin) / (xMax - xMin)) * (W - 2 * PAD);
  const sy = (y: number) => H - PAD - ((y - yMin) / (yMax - yMin)) * (H - 2 * PAD);
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${sx(d.x)},${sy(d.y)}`).join(' ');
  const areaPath = `${path} L ${sx(xs[xs.length - 1])},${H - PAD} L ${sx(xs[0])},${H - PAD} Z`;
  const color = gain ? C.green : C.red;
  const fadeColor = gain ? 'rgba(0,204,119,0.15)' : 'rgba(255,68,68,0.15)';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 220, display: 'block' }}>
      <defs>
        <linearGradient id="fade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={fadeColor} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#fade)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
      {/* Endpoint dot */}
      <circle cx={sx(xs[xs.length - 1])} cy={sy(ys[ys.length - 1])} r="4" fill={color} />
      {/* Min / max gridlines */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <text x={W - PAD - 4} y={sy(yMax) - 4} fill={C.muted} fontSize="9" textAnchor="end" fontFamily="monospace">
        {fmtUSD(yMax)}
      </text>
      <text x={W - PAD - 4} y={sy(yMin) + 12} fill={C.muted} fontSize="9" textAnchor="end" fontFamily="monospace">
        {fmtUSD(yMin)}
      </text>
    </svg>
  );
}

export default function TickerStock() {
  const { symbol } = useParams();
  const [data, setData] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!symbol) return;
    fetch(`/.netlify/functions/ticker-lookup?symbol=${encodeURIComponent(symbol)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d); else setData(d); })
      .catch(e => setError({ error: e.message }))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (loading) {
    return <div style={{ background: C.bg, color: C.muted, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_SANS, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>Loading {symbol}…</div>;
  }

  if (error || !data) {
    return (
      <div style={{ background: C.bg, color: C.text, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 36, fontWeight: 300, marginBottom: 16 }}>Ticker not found</h1>
          <p style={{ fontFamily: FONT_SANS, fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 24 }}>
            <code style={{ color: C.gold }}>{symbol}</code> isn't in the sovereign index yet.<br />
            Every home in America will have a ticker — we're indexing more every day.
          </p>
          <Link to="/property-dna" style={{ display: 'inline-block', padding: '14px 28px', background: C.gold, color: '#0F0E0D', textDecoration: 'none', fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' }}>
            Run a free DNA report →
          </Link>
        </div>
      </div>
    );
  }

  const series = buildPriceSeries(data);
  const currentValue = data.rentcast_value || 0;
  const startValue = data.last_sale_price || currentValue;
  const change = currentValue - startValue;
  const changePct = startValue ? (change / startValue) * 100 : 0;
  const gain = change >= 0;

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh' }}>
      <header style={{ padding: '20px 32px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: C.text, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 24, height: 24, border: `1px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="12" stroke={C.gold} />
              <line x1="7" y1="1" x2="7" y2="13" stroke={C.gold} strokeWidth="0.75" />
              <line x1="1" y1="7" x2="13" y2="7" stroke={C.gold} strokeWidth="0.75" />
            </svg>
          </div>
          PropertyDNA
        </Link>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 2, color: C.gold }}>{data.ticker}</div>
      </header>

      <div style={{ maxWidth: 880, margin: '0 auto', padding: 'clamp(32px,5vw,64px) clamp(20px,4vw,40px)' }}>
        {/* Ticker header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: C.gold, letterSpacing: 4, marginBottom: 8 }}>
            ${data.ticker}
          </div>
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, lineHeight: 1.1, margin: 0, marginBottom: 6 }}>
            {data.address_line1}
          </h1>
          <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.muted, letterSpacing: 1 }}>
            {[data.city, data.state, data.zip].filter(Boolean).join(', ')}
          </div>
        </div>

        {/* Price + change */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(40px,6vw,64px)', fontWeight: 300, lineHeight: 1, color: C.text }}>
              {fmtUSD(currentValue)}
            </div>
            <div style={{ fontFamily: FONT_SANS, fontSize: 18, color: gain ? C.green : C.red, fontWeight: 500 }}>
              {gain ? '↑' : '↓'} {fmtUSD(Math.abs(change))} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%)
            </div>
          </div>
          <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: C.muted, letterSpacing: 1, marginTop: 6 }}>
            Since last sale {data.last_sale_date ? `· ${new Date(data.last_sale_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}
          </div>
        </div>

        {/* Chart */}
        {series.length > 1 && (
          <div style={{ background: C.card, padding: 16, marginBottom: 32, border: `1px solid ${C.border}` }}>
            <PriceChart data={series} gain={gain} />
          </div>
        )}

        {/* Key stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1, background: C.border, marginBottom: 32 }}>
          {[
            ['Beds', data.beds],
            ['Baths', data.baths],
            ['Sq Ft', data.sqft?.toLocaleString()],
            ['Built', data.year_built],
            ['Last Sale', data.last_sale_price ? fmtUSD(data.last_sale_price) : '—'],
            ['YoY', data.market_price_yoy != null ? `${data.market_price_yoy > 0 ? '+' : ''}${Number(data.market_price_yoy).toFixed(1)}%` : '—'],
          ].map(([k, v]) => (
            <div key={String(k)} style={{ background: C.card, padding: 14 }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: 9, color: C.muted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>{k}</div>
              <div style={{ fontFamily: FONT_SERIF, fontSize: 20, color: C.text }}>{v ?? '—'}</div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
          <Link to={`/property-dna?address=${encodeURIComponent(data.address_line1 || '')}`} style={{ flex: 1, minWidth: 200, textAlign: 'center', padding: '14px 24px', background: C.gold, color: '#0F0E0D', textDecoration: 'none', fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 500 }}>
            Run full DNA report →
          </Link>
          <Link to="/watch" style={{ flex: 1, minWidth: 200, textAlign: 'center', padding: '14px 24px', background: 'transparent', color: C.text, border: `1px solid ${C.border}`, textDecoration: 'none', fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' }}>
            ★ Watch this ticker
          </Link>
        </div>

        {/* Footer link */}
        <div style={{ textAlign: 'center', fontFamily: FONT_SANS, fontSize: 11, color: C.muted, letterSpacing: 1 }}>
          Every home in America gets a ticker. <Link to="/" style={{ color: C.gold, textDecoration: 'none' }}>Browse all →</Link>
        </div>
      </div>
    </div>
  );
}
