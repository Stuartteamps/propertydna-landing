import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_KTTgVO3mROxubE_A9OQ7Kg_aRrnzPVT';

interface MarketSnapshot {
  snapshot_date: string;
  median_price: number | null;
  avg_price_per_sqft: number | null;
  median_dom: number | null;
  active_listings: number | null;
  pending_listings: number | null;
  sold_listings: number | null;
  absorption_rate: number | null;
  ma_30_day: number | null;
  ma_60_day: number | null;
  ma_90_day: number | null;
  appreciation_rate_yoy: number | null;
  volatility_score: number | null;
  demand_score: number | null;
}

interface Props {
  zip?: string;
  neighborhood?: string;
}

const statStyle: React.CSSProperties = { marginBottom: 20 };
const statLbl: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2,
  textTransform: 'uppercase', color: '#6B6252', marginBottom: 4,
};
const statVal: React.CSSProperties = {
  fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 18, fontWeight: 300, color: '#F0EBE0',
};

const fmt = (v: number | null | undefined, prefix = '', suffix = '') =>
  v != null ? `${prefix}${Number(v).toLocaleString()}${suffix}` : '—';

function scoreBar(score: number | null) {
  const pct = score != null ? Math.min(100, Math.max(0, score)) : 0;
  const color = pct >= 70 ? '#2D6A4F' : pct >= 45 ? '#C9A84C' : '#A07850';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#F0EBE0', minWidth: 32, textAlign: 'right' }}>
        {score != null ? Math.round(score) : '—'}
      </div>
    </div>
  );
}

export const MarketTrendPanel: React.FC<Props> = ({ zip, neighborhood }) => {
  const [snapshots, setSnapshots] = useState<MarketSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const geoKey = zip || neighborhood;
    const geoType = zip ? 'zip' : 'neighborhood';
    if (!geoKey) { setLoading(false); return; }

    const qs = [
      `select=${encodeURIComponent('snapshot_date,median_price,avg_price_per_sqft,median_dom,active_listings,pending_listings,sold_listings,absorption_rate,ma_30_day,ma_60_day,ma_90_day,appreciation_rate_yoy,volatility_score,demand_score')}`,
      `geo_key=eq.${encodeURIComponent(geoKey)}`,
      `geo_type=eq.${encodeURIComponent(geoType)}`,
      'order=snapshot_date.asc',
      'limit=12',
    ].join('&');

    fetch(`${SUPA_URL}/rest/v1/market_snapshots?${qs}`, {
      headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` },
    })
      .then(r => r.json())
      .then(rows => setSnapshots(Array.isArray(rows) ? rows : []))
      .catch(() => setSnapshots([]))
      .finally(() => setLoading(false));
  }, [zip, neighborhood]);

  const latest = snapshots[snapshots.length - 1];

  const chartData = snapshots.map(s => ({
    date: s.snapshot_date?.slice(0, 7) || '',
    'Median Price': s.median_price ? Math.round(s.median_price / 1000) : null,
    '30d MA': s.ma_30_day ? Math.round(s.ma_30_day / 1000) : null,
    '90d MA': s.ma_90_day ? Math.round(s.ma_90_day / 1000) : null,
  })).filter(d => d.date);

  if (loading) {
    return (
      <div style={{ color: '#6B6252', fontFamily: 'Jost, sans-serif', fontSize: 13, padding: '24px 0' }}>
        Loading market data…
      </div>
    );
  }

  if (!snapshots.length) {
    return (
      <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)', padding: 28 }}>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#6B6252', marginBottom: 8 }}>
          Market data
        </div>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, color: '#F0EBE0', marginBottom: 8 }}>
          Compiling market intelligence…
        </div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.7 }}>
          Market snapshots for {zip ? `ZIP ${zip}` : neighborhood || 'this area'} are being compiled.
          Data is refreshed nightly via market feeds.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0 40px', marginBottom: 32 }}>
        <div style={statStyle}>
          <div style={statLbl}>Median Price</div>
          <div style={statVal}>{fmt(latest?.median_price, '$')}</div>
        </div>
        <div style={statStyle}>
          <div style={statLbl}>Price / sqft</div>
          <div style={statVal}>{fmt(latest?.avg_price_per_sqft, '$')}</div>
        </div>
        <div style={statStyle}>
          <div style={statLbl}>Median DOM</div>
          <div style={statVal}>{fmt(latest?.median_dom, '', ' days')}</div>
        </div>
        <div style={statStyle}>
          <div style={statLbl}>Absorption</div>
          <div style={statVal}>{fmt(latest?.absorption_rate, '', ' mo')}</div>
        </div>
        <div style={statStyle}>
          <div style={statLbl}>YoY Appreciation</div>
          <div style={statVal}>{fmt(latest?.appreciation_rate_yoy, '', '%')}</div>
        </div>
      </div>

      {/* Price trend chart */}
      {chartData.length > 1 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#6B6252', marginBottom: 16 }}>
            Price Trend (000s) — 30d &amp; 90d Moving Averages
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="medGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fill: '#6B6252' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fill: '#6B6252' }} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Jost, sans-serif', fontSize: 12 }}
                labelStyle={{ color: '#C9A84C' }}
                itemStyle={{ color: '#F0EBE0' }}
                formatter={(v: number) => [`$${v}K`]}
              />
              <Area type="monotone" dataKey="Median Price" stroke="#C9A84C" fill="url(#medGrad)" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="30d MA" stroke="rgba(201,168,76,0.5)" fill="none" strokeWidth={1} strokeDasharray="4 2" dot={false} />
              <Area type="monotone" dataKey="90d MA" stroke="rgba(201,168,76,0.3)" fill="none" strokeWidth={1} strokeDasharray="2 3" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Active/Pending/Sold + Scores */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Listing inventory */}
        <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 14 }}>
            Listing Inventory
          </div>
          {[
            ['Active', latest?.active_listings, '#C9A84C'],
            ['Pending', latest?.pending_listings, '#74C69D'],
            ['Sold (mo)', latest?.sold_listings, '#6B6252'],
          ].map(([label, val, color]) => (
            <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color as string }} />
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252' }}>{label}</div>
              </div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, color: '#F0EBE0' }}>
                {val != null ? Number(val).toLocaleString() : '—'}
              </div>
            </div>
          ))}
        </div>

        {/* Market scores */}
        <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 14 }}>
            Market Signals
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', marginBottom: 6 }}>Demand Score</div>
            {scoreBar(latest?.demand_score ?? null)}
          </div>
          <div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', marginBottom: 6 }}>Volatility Score</div>
            {scoreBar(latest?.volatility_score ?? null)}
          </div>
        </div>
      </div>
    </div>
  );
};
