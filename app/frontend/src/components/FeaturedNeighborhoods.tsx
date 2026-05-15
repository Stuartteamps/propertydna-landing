import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const NEIGHBORHOODS = [
  { slug: 'movie-colony',         name: 'Movie Colony',         pitch: 'Sinatra · Elvis · Liberace · Marilyn Monroe' },
  { slug: 'old-las-palmas',       name: 'Old Las Palmas',       pitch: 'Kirk Douglas · Dinah Shore · Cary Grant' },
  { slug: 'thunderbird-heights',  name: 'Thunderbird Heights',  pitch: 'Sinatra Compound · JFK 1962 visit' },
  { slug: 'indian-canyons',       name: 'Indian Canyons',       pitch: 'Elrod House · Bob Hope · Lautner hillside' },
  { slug: 'smoke-tree-ranch',     name: 'Smoke Tree Ranch',     pitch: "Walt Disney's winter retreat" },
  { slug: 'vista-las-palmas',     name: 'Vista Las Palmas',     pitch: 'Elvis Honeymoon · Krisel butterfly roofs' },
];

export default function FeaturedNeighborhoods() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const results = await Promise.all(
        NEIGHBORHOODS.map(n => supabase.from('property_master').select('apn', { count: 'exact', head: true }).eq('pedigree_neighborhood', n.name))
      );
      const map: Record<string, number> = {};
      NEIGHBORHOODS.forEach((n, i) => { map[n.slug] = results[i].count || 0; });
      setCounts(map);
    })();
  }, []);

  return (
    <section style={{ background: '#0A0908', padding: '72px 24px', borderTop: '1px solid #1f2937' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>Pedigree Neighborhoods</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 36, color: '#fafafa', margin: 0, fontWeight: 400 }}>13 Named Luxury Districts</h2>
          </div>
          <Link to="/luxury-inventory" style={{ color: '#fbbf24', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600, textDecoration: 'none' }}>
            Browse the Inventory →
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          {NEIGHBORHOODS.map(n => (
            <Link key={n.slug} to={`/neighborhood/${n.slug}`} style={{
              background: '#111827', borderRadius: 6, padding: 24,
              textDecoration: 'none', color: '#e5e7eb',
              borderTop: '3px solid #fbbf24',
              transition: 'background 0.15s',
            }} onMouseEnter={e => (e.currentTarget.style.background = '#1f2937')}
               onMouseLeave={e => (e.currentTarget.style.background = '#111827')}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#fafafa', marginBottom: 6 }}>{n.name}</div>
              <div style={{ fontSize: 13, color: '#fbbf24', fontStyle: 'italic', marginBottom: 12 }}>{n.pitch}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                {counts[n.slug] != null ? `${counts[n.slug].toLocaleString()} pedigree-classified properties` : '—'}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
