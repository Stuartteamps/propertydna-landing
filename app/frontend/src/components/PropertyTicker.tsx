import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface TickerItem {
  address: string;
  city: string;
  state: string;
  value: number | null;
  yoy: number | null;
}

const fmt = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${Math.round(v / 1_000)}K`;
  return `$${v.toLocaleString()}`;
};

const FALLBACK: TickerItem[] = [
  { address: '420 Camino Norte',   city: 'Palm Springs', state: 'CA', value: 2850000, yoy:  5.2 },
  { address: '1234 Lakeshore Dr',  city: 'Austin',       state: 'TX', value: 1420000, yoy:  3.8 },
  { address: '88 Brickell Ave',    city: 'Miami',        state: 'FL', value: 3200000, yoy:  7.1 },
  { address: '5500 Camelback Rd',  city: 'Scottsdale',   state: 'AZ', value: 1870000, yoy:  4.5 },
  { address: '220 Belmont Ave',    city: 'Nashville',    state: 'TN', value: 890000,  yoy:  6.2 },
  { address: '1200 Eastlake Ave',  city: 'Seattle',      state: 'WA', value: 2100000, yoy:  2.9 },
  { address: '3401 E 17th Ave',    city: 'Denver',       state: 'CO', value: 760000,  yoy: -1.2 },
  { address: '9910 Sunset Blvd',   city: 'Los Angeles',  state: 'CA', value: 4500000, yoy:  1.8 },
  { address: '4890 Legacy Dr',     city: 'Dallas',       state: 'TX', value: 980000,  yoy:  3.3 },
  { address: '2240 Myers Park Dr', city: 'Charlotte',    state: 'NC', value: 680000,  yoy:  5.7 },
  { address: '6600 Gulf Blvd',     city: 'Tampa',        state: 'FL', value: 1150000, yoy:  4.0 },
  { address: '1885 N 44th St',     city: 'Phoenix',      state: 'AZ', value: 540000,  yoy: -0.8 },
  { address: '1500 N Clark St',    city: 'Chicago',      state: 'IL', value: 920000,  yoy:  1.5 },
];

export default function PropertyTicker() {
  const [items, setItems] = useState<TickerItem[]>(FALLBACK);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from('property_master')
      .select('address_line1,city,state,rentcast_value,market_price_yoy')
      .not('rentcast_value', 'is', null)
      .order('last_updated', { ascending: false })
      .limit(40)
      .then(({ data }) => {
        if (data && data.length >= 8) {
          setItems(
            data.map((r: any) => ({
              address: r.address_line1 || '—',
              city:    r.city  || '',
              state:   r.state || '',
              value:   r.rentcast_value      ? Number(r.rentcast_value)      : null,
              yoy:     r.market_price_yoy    ? Number(r.market_price_yoy)    : null,
            }))
          );
        }
      })
      // Supabase's builder resolves to PromiseLike<void>, which has no `.catch`;
      // `.then(undefined, fn)` is the equivalent rejection handler.
      .then(undefined, () => {});
  }, []);

  const doubled = [...items, ...items];

  return (
    <div style={{
      width: '100%',
      background: '#0A0908',
      borderTop:    '1px solid rgba(255,255,255,0.06)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
      padding: '10px 0',
      position: 'relative',
    }}>
      {/* left fade */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(to right, #0A0908, transparent)', zIndex: 2, pointerEvents: 'none' }} />
      {/* right fade */}
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(to left, #0A0908, transparent)', zIndex: 2, pointerEvents: 'none' }} />

      <div
        ref={trackRef}
        style={{
          display: 'flex',
          gap: 0,
          animation: `ticker-scroll ${items.length * 4}s linear infinite`,
          willChange: 'transform',
        }}
      >
        {doubled.map((item, i) => {
          const yoyColor = item.yoy === null ? '#6B6252' : item.yoy >= 0 ? '#2D9142' : '#B85245';
          const yoySign  = item.yoy !== null && item.yoy >= 0 ? '+' : '';
          return (
            <div
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 28px',
                borderRight: '1px solid rgba(255,255,255,0.06)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: '0.5px', color: 'rgba(244,240,232,0.55)' }}>
                {item.address}{item.city ? `, ${item.city}` : ''}{item.state ? ` ${item.state}` : ''}
              </span>
              {item.value && (
                <span style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 14, fontWeight: 500, color: '#F0EBE0', letterSpacing: '-0.3px' }}>
                  {fmt(item.value)}
                </span>
              )}
              {item.yoy !== null && (
                <span style={{
                  fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
                  color: yoyColor,
                  background: `${yoyColor}18`,
                  border: `1px solid ${yoyColor}40`,
                  padding: '2px 6px',
                  letterSpacing: '0.3px',
                }}>
                  {yoySign}{item.yoy.toFixed(1)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
