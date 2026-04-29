import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface Zone { label: string; heat: number; yoy: number; color: string; }
interface Props { isPremium?: boolean; onUpgrade?: () => void; }

const heatColor = (h: number) => {
  if (h >= 0.8) return '#ff4444';
  if (h >= 0.65) return '#ff8800';
  if (h >= 0.5) return '#ffbb00';
  return '#4A7EC9';
};

const FALLBACK: Zone[] = [
  { label: 'Palm Springs',   heat: 0.88, yoy: 9.2, color: '#ff4444' },
  { label: 'Rancho Mirage',  heat: 0.74, yoy: 6.8, color: '#ff8800' },
  { label: 'Indian Wells',   heat: 0.82, yoy: 8.1, color: '#ff4444' },
  { label: 'Palm Desert',    heat: 0.65, yoy: 5.3, color: '#ffbb00' },
  { label: 'La Quinta',      heat: 0.71, yoy: 7.4, color: '#ff8800' },
  { label: 'Cathedral City', heat: 0.48, yoy: 3.9, color: '#4A7EC9' },
  { label: 'Indio',          heat: 0.42, yoy: 3.1, color: '#4A7EC9' },
  { label: 'Desert Hot Springs', heat: 0.35, yoy: 2.8, color: '#4A7EC9' },
];

const GEO_KEYS: Record<string, string> = {
  'palm-springs': 'Palm Springs', 'rancho-mirage': 'Rancho Mirage',
  'indian-wells': 'Indian Wells', 'palm-desert': 'Palm Desert',
  'la-quinta': 'La Quinta', 'cathedral-city': 'Cathedral City',
  'indio': 'Indio', 'desert-hot-springs': 'Desert Hot Springs',
};

export default function MarketHeatMapPreview({ isPremium = false, onUpgrade }: Props) {
  const [zones, setZones] = useState<Zone[]>(FALLBACK);

  useEffect(() => {
    supabase
      .from('market_snapshots')
      .select('geo_key, appreciation_rate_yoy, demand_score')
      .eq('geo_type', 'city')
      .order('snapshot_date', { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const seen = new Set<string>();
        const live: Zone[] = [];
        for (const r of data) {
          if (seen.has(r.geo_key) || !GEO_KEYS[r.geo_key]) continue;
          seen.add(r.geo_key);
          const heat = Math.min(1, Math.max(0, Number(r.demand_score) / 100));
          live.push({ label: GEO_KEYS[r.geo_key], heat, yoy: Number(r.appreciation_rate_yoy) || 0, color: heatColor(heat) });
        }
        if (live.length >= 3) setZones(live.sort((a, b) => b.heat - a.heat));
      }).catch(() => {});
  }, []);

  return (
    <div style={{ position: 'relative', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', background: '#0a0a0a' }}>
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(0,255,136,0.7)', marginBottom: 4 }}>Market Intelligence</div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 300, color: '#F4F0E8' }}>Coachella Valley Heat Index</div>
        </div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252' }}>
          {isPremium ? 'Live Data' : 'Preview'}
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {zones.map((z, i) => (
          <div key={z.label} style={{ marginBottom: i < zones.length - 1 ? 14 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: isPremium ? '#F4F0E8' : (i < 3 ? '#F4F0E8' : 'rgba(244,240,232,0.4)'), letterSpacing: 1 }}>{z.label}</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 14, color: z.color, filter: !isPremium && i >= 3 ? 'blur(4px)' : 'none' }}>
                {z.yoy >= 0 ? '+' : ''}{z.yoy.toFixed(1)}%
              </div>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${z.heat * 100}%`, background: z.color, opacity: !isPremium && i >= 3 ? 0.2 : 0.85, filter: !isPremium && i >= 3 ? 'blur(3px)' : 'none', transition: 'width 1s ease' }} />
            </div>
          </div>
        ))}
      </div>

      {!isPremium && (
        <div style={{ padding: '0 24px 24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ border: '1px solid rgba(0,255,136,0.1)', padding: '20px 24px', textAlign: 'center', marginTop: 16 }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(0,255,136,0.7)', marginBottom: 8 }}>Premium Market Intelligence</div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: 'rgba(244,240,232,0.5)', lineHeight: 1.7, marginBottom: 16 }}>Unlock street-level heat maps, market velocity, and opportunity zones.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {onUpgrade ? (
                <button onClick={onUpgrade} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: '#000', background: '#00ff88', border: 'none', padding: '10px 22px', cursor: 'pointer' }}>
                  Unlock Premium
                </button>
              ) : (
                <Link to="/market-heatmaps" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: '#000', background: '#00ff88', padding: '10px 22px', textDecoration: 'none', display: 'inline-block' }}>
                  See Full Map →
                </Link>
              )}
              <Link to="/#pricing" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(244,240,232,0.4)', textDecoration: 'none', padding: '10px 4px' }}>
                View Plans →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
