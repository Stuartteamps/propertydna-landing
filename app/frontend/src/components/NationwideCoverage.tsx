/**
 * NationwideCoverage — replaces the Coachella-only PedigreeProofBar +
 * FeaturedDossiers on the landing page with a multi-state stats showcase.
 *
 * Pulls live per-state counts from property_master so numbers grow as we
 * index more. Falls back to known totals if Supabase is unreachable.
 *
 * The luxury/dossier-specific content lives on /dossiers — landing should
 * communicate platform scope, not pigeon-hole us as a Coachella site.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const GOLD = '#fbbf24';

interface Market {
  state: string;
  region: string;
  fallback: number;
  count?: number;
}

// Ordered by current indexed count (highest first)
const MARKETS: Market[] = [
  { state: 'AZ', region: 'Maricopa County — Scottsdale, Paradise Valley, Phoenix', fallback: 1_511_365 },
  { state: 'CA', region: 'Coachella Valley, Greater LA, Bay Area, San Diego',       fallback: 821_647 },
  { state: 'WA', region: 'Snohomish County, Greater Seattle',                       fallback: 206_000 },
  { state: 'TX', region: 'Austin, Dallas-Fort Worth, Houston metros',               fallback: 113_184 },
  { state: 'CT', region: 'Fairfield County — Greenwich, Westport, Darien',          fallback: 91_204 },
  { state: 'FL', region: 'Miami-Dade, statewide FDOR cadastral',                    fallback: 24_000 },
  { state: 'NY', region: 'Manhattan, Westchester — expanding',                      fallback: 400 },
];

export default function NationwideCoverage() {
  const [data, setData] = useState<Market[]>(MARKETS);
  const [total, setTotal] = useState<number>(MARKETS.reduce((s, m) => s + m.fallback, 0));
  const [loaded, setLoaded] = useState(true); // show fallback numbers immediately; update on resolve

  useEffect(() => {
    (async () => {
      try {
        const results = await Promise.all(
          MARKETS.map(m =>
            supabase.from('property_master')
              .select('apn', { count: 'exact', head: true })
              .eq('state', m.state)
              // Important: use fallback when count is 0, null, OR undefined.
              // RLS issues can return count=0 silently; never let 0 overwrite a
              // known fallback (we have 3.58M parcels in the DB; 0 is always wrong).
              .then(r => ({ ...m, count: r.count && r.count > 0 ? r.count : m.fallback }))
          )
        );
        setData(results);
        setTotal(results.reduce((s, r) => s + (r.count && r.count > 0 ? r.count : r.fallback), 0));
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    })();
  }, []);

  return (
    <section style={{
      background: '#0a0a0a', color: '#e5e7eb',
      padding: 'clamp(64px,9vw,112px) clamp(20px,5vw,64px)',
      borderTop: '1px solid #1f2937',
      borderBottom: '1px solid #1f2937',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Section header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: GOLD, textTransform: 'uppercase', marginBottom: 14, fontWeight: 600 }}>
            Nationwide Coverage
          </div>
          <h2 style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 300,
            lineHeight: 1.05, color: '#fafafa', margin: '0 0 18px', letterSpacing: '-0.01em',
          }}>
            {(total).toLocaleString()}<span style={{ color: GOLD }}>+</span> properties indexed.
          </h2>
          <p style={{ fontSize: 17, color: '#94a3b8', lineHeight: 1.7, maxWidth: 720, margin: 0 }}>
            PropertyDNA scrapes county assessor and cadastral data directly — no MLS license required,
            no per-call fees to third-party aggregators. {data.length} active markets across the US,
            expanding monthly. Every property gets a DNA score on the same model.
          </p>
        </div>

        {/* Market grid — one row per state with count + region */}
        <div style={{ background: '#0f1419', border: '1px solid #1e293b' }}>
          {data
            .slice()
            .sort((a, b) => (b.count ?? b.fallback) - (a.count ?? a.fallback))
            .map((m, i) => {
              const count = m.count ?? m.fallback;
              return (
                <div key={m.state} style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 160px',
                  alignItems: 'center', gap: 16,
                  padding: '18px 22px',
                  borderTop: i === 0 ? 'none' : '1px solid #1e293b',
                }}>
                  <div style={{
                    fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 400,
                    color: GOLD, letterSpacing: 1,
                  }}>{m.state}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: '#fafafa', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.region}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: '"Share Tech Mono", monospace', fontSize: 16, fontWeight: 600, color: '#fafafa' }}>
                    {loaded ? count.toLocaleString() : '—'}
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 400, letterSpacing: 1, marginTop: 2, textTransform: 'uppercase' }}>
                      properties
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 32 }}>
          <Link to="/market-heatmaps" style={ctaPrimary}>Explore the Heat Map →</Link>
          <Link to="/intellagraph" style={ctaSecondary}>IntellaGraph AI</Link>
          <Link to="/dossiers" style={ctaSecondary}>Luxury Dossiers</Link>
        </div>

      </div>
    </section>
  );
}

const ctaPrimary: React.CSSProperties = {
  display: 'inline-block', padding: '14px 26px',
  background: GOLD, color: '#0a0a0a',
  textDecoration: 'none', fontSize: 11, fontWeight: 600,
  letterSpacing: 2, textTransform: 'uppercase',
  fontFamily: 'inherit', transition: 'background 0.15s',
};

const ctaSecondary: React.CSSProperties = {
  display: 'inline-block', padding: '14px 26px',
  background: 'transparent', color: '#fafafa', border: '1px solid #334155',
  textDecoration: 'none', fontSize: 11, fontWeight: 600,
  letterSpacing: 2, textTransform: 'uppercase',
  fontFamily: 'inherit', transition: 'border-color 0.15s, color 0.15s',
};
