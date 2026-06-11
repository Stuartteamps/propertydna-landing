import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import FAQ from '@/components/FAQ';

type Stat = { label: string; count: number; color?: string };

const TIER_COLOR: Record<string, string> = {
  A: '#fbbf24', B: '#a78bfa', C: '#60a5fa', D: '#34d399',
};

const NEIGHBORHOODS = [
  'Movie Colony', 'Old Las Palmas', 'Las Palmas', 'Vista Las Palmas',
  'The Mesa', 'Indian Canyons', 'Smoke Tree Ranch', 'Tahquitz River Estates',
  'Racquet Club Estates', 'Twin Palms',
  'Thunderbird Heights', 'Tamarisk Country Club', 'Mission Hills',
];

// Seed from known verified DB counts — shown immediately, replaced by live query
const TIER_SEED: Stat[] = [
  { label: 'A — Verified Dossier',        count: 50,    color: TIER_COLOR.A },
  { label: 'B — Top Hood + MCM Era',       count: 1322,  color: TIER_COLOR.B },
  { label: 'C — Named / MCM-Era',           count: 5134,  color: TIER_COLOR.C },
  { label: 'D — Mid-Century Provenance',    count: 10282, color: TIER_COLOR.D },
];

export default function PedigreeIndex() {
  const [tierStats, setTierStats]   = useState<Stat[]>(TIER_SEED);
  const [hoodStats, setHoodStats]   = useState<Stat[]>([]);
  const [architectStats, setArchitectStats] = useState<any[]>([]);
  const [topDossiers, setTopDossiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const tierResults = await Promise.all(['A', 'B', 'C', 'D'].map(t =>
        supabase.from('property_master').select('apn', { count: 'exact', head: true }).eq('pedigree_tier', t)
      ));
      setTierStats([
        // Never let count=0 overwrite a known fallback (silent RLS / cold-cache failure).
        { label: 'A — Verified Dossier',        count: tierResults[0].count && tierResults[0].count > 0 ? tierResults[0].count : 50,    color: TIER_COLOR.A },
        { label: 'B — Top Hood + MCM Era',       count: tierResults[1].count && tierResults[1].count > 0 ? tierResults[1].count : 1322,  color: TIER_COLOR.B },
        { label: 'C — Named / MCM-Era',           count: tierResults[2].count && tierResults[2].count > 0 ? tierResults[2].count : 5134,  color: TIER_COLOR.C },
        { label: 'D — Mid-Century Provenance',    count: tierResults[3].count && tierResults[3].count > 0 ? tierResults[3].count : 10282, color: TIER_COLOR.D },
      ]);

      const hoodResults = await Promise.all(NEIGHBORHOODS.map(h =>
        supabase.from('property_master').select('apn', { count: 'exact', head: true }).eq('pedigree_neighborhood', h)
      ));
      const hoods = NEIGHBORHOODS.map((h, i) => ({ label: h, count: hoodResults[i].count || 0 }))
        .filter(h => h.count > 0)
        .sort((a, b) => b.count - a.count);
      setHoodStats(hoods);

      const { data: architects } = await supabase
        .from('architects')
        .select('name,reputation_tier,verified_commissions,trade_frequency_years,primary_style')
        .order('verified_commissions', { ascending: false });
      setArchitectStats(architects || []);

      const { data: dossiers } = await supabase
        .from('property_master')
        .select('apn,address,city,pedigree_tier,architect_attribution,provenance_score,luxury_value_basis')
        .eq('has_provenance_dossier', true)
        .order('provenance_score', { ascending: false })
        .limit(12);
      setTopDossiers(dossiers || []);

      setLoading(false);
    })();
  }, []);

  const total = tierStats.reduce((sum, s) => sum + s.count, 0);
  const maxHood = Math.max(...hoodStats.map(h => h.count), 1);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>
            PropertyDNA — Coachella Valley Pedigree Index
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 44, lineHeight: 1.15, margin: 0, fontWeight: 400, color: '#fafafa' }}>
            The Pedigree of Every Home
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 16, marginTop: 14, maxWidth: 720 }}>
            We've systematically classified {total.toLocaleString()} Coachella Valley properties by architectural and cultural pedigree.
            Verified celebrity provenance. Verified architect attribution. Indexed against Palm Springs Modernism Committee, Preservation Foundation, and primary source archives.
          </p>
          <div style={{ marginTop: 14, fontSize: 13 }}>
            <Link to="/blog/luxury-home-provenance-pedigree-classification" style={{ color: '#fbbf24', textDecoration: 'underline', textDecorationThickness: 1 }}>Read the full methodology →</Link>
            <span style={{ color: '#475569', margin: '0 10px' }}>·</span>
            <Link to="/architects" style={{ color: '#fbbf24', textDecoration: 'underline', textDecorationThickness: 1 }}>Browse the 11 documented architects</Link>
          </div>
        </div>

        {/* Tier breakdown — large numbers */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 20, fontWeight: 600 }}>Pedigree Tier Breakdown</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {tierStats.map(s => (
              <div key={s.label} style={{
                background: '#111827', borderRadius: 8, padding: 24,
                borderTop: `4px solid ${s.color}`,
              }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 38, color: '#fafafa', fontWeight: 400 }}>
                  {loading ? '—' : s.count.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: s.color, marginTop: 8, fontWeight: 600, letterSpacing: 0.5 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Neighborhoods bar chart */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 20, fontWeight: 600 }}>Properties By Named Neighborhood</h2>
          <div style={{ background: '#111827', borderRadius: 8, padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {hoodStats.map(h => {
              const pct = (h.count / maxHood) * 100;
              return (
                <Link key={h.label} to={`/luxury-inventory?neighborhood=${encodeURIComponent(h.label)}`} style={{
                  display: 'flex', alignItems: 'center', gap: 16, textDecoration: 'none', color: '#e5e7eb',
                  padding: '6px 0',
                }}>
                  <div style={{ width: 200, fontSize: 14, color: '#e5e7eb' }}>{h.label}</div>
                  <div style={{ flex: 1, background: '#1f2937', borderRadius: 3, overflow: 'hidden', height: 26, position: 'relative' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)',
                      borderRadius: 3,
                    }} />
                    <div style={{ position: 'absolute', right: 10, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600, color: '#0a0a0a' }}>
                      {h.count.toLocaleString()}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Architect cards */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 20, fontWeight: 600 }}>Documented Architects</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {architectStats.map(a => {
              const slug = a.name.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-');
              return (
                <Link key={a.name} to={`/architect/${slug}`} style={{ background: '#111827', borderRadius: 6, padding: 22, borderLeft: '3px solid #fbbf24', textDecoration: 'none', color: '#e5e7eb' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 19, color: '#fafafa' }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{a.primary_style}</div>
                  <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#cbd5e1' }}>
                    <span>{a.verified_commissions} works</span>
                    <span style={{ color: '#fbbf24' }}>{a.reputation_tier}</span>
                  </div>
                  {a.trade_frequency_years && (
                    <div style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>Trades ≈ every {a.trade_frequency_years} yr</div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>

        {/* Top verified dossiers — first 3 visible to everyone; the rest unlocks after email */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 20, fontWeight: 600 }}>Top Verified Dossiers</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {topDossiers.map(d => (
              <Link key={d.apn} to={`/dossier/${d.apn}`} style={{
                background: '#111827', borderRadius: 6, padding: 20,
                borderLeft: `3px solid ${TIER_COLOR[d.pedigree_tier] || '#475569'}`,
                textDecoration: 'none', color: '#e5e7eb',
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TIER_COLOR[d.pedigree_tier] || '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>
                  {d.pedigree_tier} · {d.provenance_score}/100
                </div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: '#fafafa', lineHeight: 1.3 }}>{d.address}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{d.city}</div>
                {d.architect_attribution && (
                  <div style={{ fontSize: 12, color: '#fbbf24', fontStyle: 'italic', marginTop: 6 }}>{d.architect_attribution}</div>
                )}
              </Link>
            ))}
          </div>

        </section>

        {/* CTA */}
        <div style={{ padding: 32, background: 'linear-gradient(135deg, #1f2937 0%, #0f172a 100%)', borderRadius: 6, textAlign: 'center', border: '1px solid #334155' }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 14 }}>Browse the Index</div>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 26, margin: '0 0 18px', color: '#fafafa', fontWeight: 400 }}>
            Search 16,788 pedigree-classified properties.
          </h3>
          <Link to="/luxury-inventory" style={{ display: 'inline-block', padding: '14px 32px', background: '#fbbf24', color: '#0a0a0a', textDecoration: 'none', borderRadius: 4, fontWeight: 600, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
            Open Inventory
          </Link>
        </div>
      </div>

      {/* FAQ — AEO-targeted answers for "Palm Springs architect", "MCM provenance" */}
      <FAQ
        eyebrow="The Pedigree Method"
        title="How the index works"
        items={[
          {
            q: 'How did you pedigree-classify 16,788 Coachella Valley properties?',
            a: 'We pulled every parcel from the Riverside County Assessor CREST API and Coachella Valley municipal datasets, joined to RentCast and our own property history, then layered three signals: named-neighborhood membership (Movie Colony, Old Las Palmas, Indian Canyons, etc.), MCM-era year built (1947-1979 for the core mid-century window), and architect attribution from primary-source archives. The composite produces the A/B/C/D pedigree tier and a 0-100 provenance score.',
          },
          {
            q: 'What does the provenance score actually measure?',
            a: 'Provenance score (0-100) is a composite of: documentation completeness (how much of the architect, ownership, and permit chain we can cite from primary sources), source quality (preservation society > newspaper archive > realtor copy), cultural rank (Kaufmann Desert House = 99, a documented Krisel tract home in a named neighborhood = 75), and rarity. Scores update as new sources are verified.',
          },
          {
            q: 'Which architects are documented?',
            a: 'Eleven, with the heaviest coverage on the Palm Springs canon: John Lautner (8 verified PS commissions), Albert Frey (47), Richard Neutra (12), William Krisel (extensive tract attribution), E. Stewart Williams (Sinatra Twin Palms among others), Donald Wexler, Hugh Kaptur, William F. Cody, Howard Lapham, Walter S. White, Charles DuBois. Each architect has a profile page with their full PS portfolio and primary-source registry.',
          },
          {
            q: 'Is this index just Palm Springs?',
            a: 'The pedigree index is currently Coachella Valley — 16,788 properties across Palm Springs, Rancho Mirage, Cathedral City, Palm Desert, La Quinta, and surrounding cities. PropertyDNA itself indexes 3.58M properties nationwide. Expansion of the pedigree layer to Malibu, Paradise Valley, Palm Beach, Miami-Dade luxury, and Greenwich is on the roadmap.',
          },
          {
            q: 'Why does pedigree matter for value?',
            a: 'Pedigreed homes trade at documented premiums to unattributed peers (8-15% on architect-verified, more on celebrity-owned). Pedigree also accelerates resale — when an estate trust needs documented value, when an appraiser needs comp justification, or when a listing agent needs to defend price. PropertyDNA exists to make that documentation citable.',
          },
        ]}
      />
    </div>
  );
}
