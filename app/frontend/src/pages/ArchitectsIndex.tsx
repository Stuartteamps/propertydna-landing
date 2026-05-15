import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

type Architect = {
  id: string;
  name: string;
  birth_year?: number;
  death_year?: number;
  primary_style?: string;
  bio?: string;
  verified_commissions?: number;
  trade_frequency_years?: number;
  reputation_tier?: string;
};

const TIER_COLOR: Record<string, string> = { iconic: '#fbbf24', major: '#a78bfa', documented: '#60a5fa', regional: '#34d399' };

export default function ArchitectsIndex() {
  const [architects, setArchitects] = useState<Architect[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Documented Palm Springs Architects — PropertyDNA';
    const setMeta = (n: string, c: string, p = false) => {
      const a = p ? 'property' : 'name';
      let m = document.querySelector(`meta[${a}="${n}"]`);
      if (!m) { m = document.createElement('meta'); m.setAttribute(a, n); document.head.appendChild(m); }
      m.setAttribute('content', c);
    };
    setMeta('description', 'Eleven documented Palm Springs mid-century modern architects — Frey, Lautner, Neutra, Krisel, Wexler, Williams, Kaptur, Cody, Lapham, White, DuBois. Verified commission counts and primary source archives.');

    (async () => {
      const { data } = await supabase.from('architects').select('*').order('reputation_tier').order('verified_commissions', { ascending: false });
      setArchitects((data || []) as Architect[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>
            PropertyDNA — Documented Palm Springs Architects
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 46, lineHeight: 1.1, margin: 0, fontWeight: 400, color: '#fafafa' }}>
            The Architects
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 16, marginTop: 14, maxWidth: 720 }}>
            Eleven mid-century modern architects whose Palm Springs commissions define the city's architectural identity.
            Every attribution traces to a primary source — original drawings, building permits, or period press.
          </p>
        </div>

        {loading ? 'Loading…' : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
            {architects.map(a => {
              const slug = a.name.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-');
              const accent = TIER_COLOR[a.reputation_tier || 'documented'] || '#475569';
              return (
                <Link key={a.id} to={`/architect/${slug}`} style={{
                  background: '#111827', borderLeft: `3px solid ${accent}`, borderRadius: 6,
                  padding: 24, textDecoration: 'none', color: '#e5e7eb', display: 'flex', flexDirection: 'column', gap: 10,
                  transition: 'background 0.15s',
                }} onMouseEnter={e => (e.currentTarget.style.background = '#1f2937')}
                   onMouseLeave={e => (e.currentTarget.style.background = '#111827')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#fafafa', lineHeight: 1.2 }}>{a.name}</div>
                    <span style={{ fontSize: 10, color: accent, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>{a.reputation_tier}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    {a.birth_year}{a.death_year ? `–${a.death_year}` : '–present'} · {a.primary_style}
                  </div>
                  {a.bio && (
                    <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.55, margin: '6px 0 0', flex: 1 }}>
                      {a.bio.length > 180 ? a.bio.slice(0, 180) + '…' : a.bio}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                    {a.verified_commissions != null && <span><strong style={{ color: '#fbbf24' }}>{a.verified_commissions}</strong> works</span>}
                    {a.trade_frequency_years != null && <span>Trades ≈ <strong style={{ color: '#e5e7eb' }}>{a.trade_frequency_years} yr</strong></span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 56, padding: 28, background: 'linear-gradient(135deg, #1f2937 0%, #0f172a 100%)', borderRadius: 6, textAlign: 'center', border: '1px solid #334155' }}>
          <Link to="/pedigree-index" style={{ display: 'inline-block', padding: '14px 28px', background: '#fbbf24', color: '#0a0a0a', textDecoration: 'none', borderRadius: 4, fontWeight: 600, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
            Full Pedigree Index
          </Link>
        </div>
      </div>
    </div>
  );
}
