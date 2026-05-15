import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

type Featured = {
  apn: string;
  address: string;
  city: string;
  architect_attribution?: string | null;
  provenance_score?: number | null;
  pedigree_tier?: string | null;
};

export default function FeaturedDossiers() {
  const [items, setItems] = useState<Featured[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('property_master')
        .select('apn,address,city,architect_attribution,provenance_score,pedigree_tier')
        .eq('has_provenance_dossier', true)
        .eq('pedigree_tier', 'A')
        .gte('provenance_score', 90)
        .order('provenance_score', { ascending: false })
        .limit(6);
      setItems((data || []) as Featured[]);
    })();
  }, []);

  if (items.length === 0) return null;

  return (
    <section style={{ background: '#0a0a0a', padding: '72px 24px', borderTop: '1px solid #1f2937', borderBottom: '1px solid #1f2937' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>Verified Provenance Dossiers</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 36, color: '#fafafa', margin: 0, fontWeight: 400 }}>The Most Documented Estates in Palm Springs</h2>
          </div>
          <Link to="/pedigree-index" style={{ color: '#fbbf24', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600, textDecoration: 'none' }}>
            View the Full Index →
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 18 }}>
          {items.map(p => (
            <Link key={p.apn} to={`/dossier/${p.apn}`} style={{
              background: '#111827', borderLeft: '3px solid #fbbf24', borderRadius: 6,
              padding: 22, textDecoration: 'none', color: '#e5e7eb',
              display: 'flex', flexDirection: 'column', gap: 8,
              transition: 'background 0.15s',
            }} onMouseEnter={e => (e.currentTarget.style.background = '#1f2937')}
               onMouseLeave={e => (e.currentTarget.style.background = '#111827')}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#fbbf24', textTransform: 'uppercase' }}>
                A — {p.provenance_score}/100
              </div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 19, color: '#fafafa', lineHeight: 1.25 }}>{p.address}</div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>{p.city}</div>
              {p.architect_attribution && (
                <div style={{ fontSize: 13, color: '#fbbf24', fontStyle: 'italic', marginTop: 4 }}>{p.architect_attribution}</div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
