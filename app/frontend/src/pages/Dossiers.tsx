/**
 * Dossiers — Unified hub for the luxury dossier section.
 *
 * Replaces the confusing two-tab flow (Luxury Index + Inventory) with one
 * landing page that:
 *   1. Explains what a PropertyDNA dossier is
 *   2. Shows live stats (verified dossiers, architects, pedigree tiers)
 *   3. Features the top 8 most-recent verified dossiers
 *   4. Offers three clear next actions (Browse, Pedigree Index, Request Custom)
 *
 * Existing deep pages (/pedigree-index, /luxury-inventory, /dossier/:apn,
 * /dossier-request) all remain — this is the entry point that ties them
 * together.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Nav from '@/components/Nav';
import { supabase } from '@/lib/supabase';

const GOLD = '#C9A84C';
const SERIF = '"Cormorant Garamond", Georgia, serif';
const SANS  = '"Jost", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const TIER_COLOR: Record<string, string> = {
  A: '#fbbf24', B: '#a78bfa', C: '#60a5fa', D: '#34d399',
};

interface Stats {
  verifiedDossiers: number;
  architects: number;
  totalIndexed: number;
  topNeighborhoods: number;
}

interface Dossier {
  apn: string;
  address: string;
  city: string;
  pedigree_tier?: string;
  architect_attribution?: string;
  provenance_score?: number;
  luxury_value_basis?: number;
}

export default function Dossiers() {
  const [stats, setStats] = useState<Stats>({ verifiedDossiers: 0, architects: 0, totalIndexed: 0, topNeighborhoods: 13 });
  const [featured, setFeatured] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [dossierCount, archCount, totalCount, top] = await Promise.all([
        supabase.from('property_master').select('apn', { count: 'exact', head: true }).eq('has_provenance_dossier', true),
        supabase.from('architects').select('id', { count: 'exact', head: true }),
        supabase.from('property_master').select('apn', { count: 'exact', head: true }).not('pedigree_tier', 'is', null),
        supabase.from('property_master')
          .select('apn,address,city,pedigree_tier,architect_attribution,provenance_score,luxury_value_basis')
          .eq('has_provenance_dossier', true)
          .order('provenance_score', { ascending: false })
          .limit(8),
      ]);

      setStats({
        verifiedDossiers: dossierCount.count || 0,
        architects:       archCount.count    || 0,
        totalIndexed:     totalCount.count   || 0,
        topNeighborhoods: 13,
      });
      setFeatured((top.data as Dossier[]) || []);
      setLoading(false);
    })().catch(() => setLoading(false));
  }, []);

  const fmtMoney = (n?: number) => !n ? '' : n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : `$${(n/1000).toFixed(0)}K`;

  return (
    <>
      <Nav />

      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: SANS, paddingTop: 64 }}>

        {/* ── HERO ─────────────────────────────────────────────────── */}
        <section style={{
          position: 'relative', padding: 'clamp(48px,8vw,96px) clamp(20px,5vw,64px) clamp(40px,6vw,72px)',
          maxWidth: 1200, margin: '0 auto',
        }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: GOLD, textTransform: 'uppercase', marginBottom: 16, fontWeight: 600 }}>
            PropertyDNA — Verified Luxury Dossiers
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(36px,6vw,72px)', lineHeight: 1.05, fontWeight: 300, color: '#fafafa', margin: '0 0 24px', letterSpacing: '-0.01em' }}>
            The provenance behind every<br />landmark home.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: '#94a3b8', maxWidth: 680, margin: '0 0 32px' }}>
            A PropertyDNA dossier is a primary-source-verified record of a property's architectural lineage,
            celebrity provenance, ownership history, and cultural significance. Sourced from the Palm Springs
            Modernism Committee, Preservation Foundation archives, and county records — never speculation.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Link to="/luxury-inventory" style={ctaPrimary}>Browse Inventory →</Link>
            <Link to="/pedigree-index" style={ctaSecondary}>Pedigree Index</Link>
            <Link to="/dossier-request" style={ctaSecondary}>Request a Custom Dossier</Link>
          </div>
        </section>

        {/* ── STATS ────────────────────────────────────────────────── */}
        <section style={{ background: '#0f1419', padding: '40px clamp(20px,5vw,64px)', borderTop: '1px solid #1e293b', borderBottom: '1px solid #1e293b' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24 }}>
            {[
              ['Verified Dossiers',   stats.verifiedDossiers],
              ['Documented Architects', stats.architects],
              ['Pedigree-Classified',  stats.totalIndexed],
              ['Named Neighborhoods',  stats.topNeighborhoods],
            ].map(([label, value]) => (
              <div key={label as string}>
                <div style={{ fontFamily: SERIF, fontSize: 44, fontWeight: 300, color: '#fafafa', lineHeight: 1 }}>
                  {loading ? '—' : (value as number).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, letterSpacing: 2, color: GOLD, textTransform: 'uppercase', marginTop: 8, fontWeight: 600 }}>
                  {label as string}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FEATURED DOSSIERS ────────────────────────────────────── */}
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(48px,8vw,80px) clamp(20px,5vw,64px)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 4, color: GOLD, textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>
                Featured
              </div>
              <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, color: '#fafafa', margin: 0 }}>
                Top Verified Dossiers
              </h2>
            </div>
            <Link to="/luxury-inventory" style={{ fontSize: 12, color: GOLD, textDecoration: 'none', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>
              View All →
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Loading dossiers…</div>
          ) : featured.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
              No published dossiers yet. <Link to="/dossier-request" style={{ color: GOLD }}>Request the first one →</Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {featured.map(d => (
                <Link key={d.apn} to={`/dossier/${d.apn}`} style={{
                  background: '#111827',
                  padding: 22,
                  borderLeft: `3px solid ${TIER_COLOR[d.pedigree_tier || ''] || '#475569'}`,
                  textDecoration: 'none', color: '#e5e7eb',
                  display: 'block',
                  transition: 'background 0.15s, transform 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#1a2332'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#111827'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TIER_COLOR[d.pedigree_tier || ''] || '#94a3b8', textTransform: 'uppercase' }}>
                      Tier {d.pedigree_tier} · {d.provenance_score ?? '—'}/100
                    </span>
                    {d.luxury_value_basis ? (
                      <span style={{ fontSize: 11, color: GOLD, fontWeight: 600 }}>{fmtMoney(d.luxury_value_basis)}</span>
                    ) : null}
                  </div>
                  <div style={{ fontFamily: SERIF, fontSize: 18, color: '#fafafa', lineHeight: 1.3, fontWeight: 400 }}>{d.address}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{d.city}</div>
                  {d.architect_attribution && (
                    <div style={{ fontSize: 12, color: GOLD, fontStyle: 'italic', marginTop: 8 }}>
                      {d.architect_attribution}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── WHAT'S IN A DOSSIER ──────────────────────────────────── */}
        <section style={{ background: '#0f1419', padding: 'clamp(48px,8vw,80px) clamp(20px,5vw,64px)', borderTop: '1px solid #1e293b' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ fontSize: 11, letterSpacing: 4, color: GOLD, textTransform: 'uppercase', marginBottom: 14, fontWeight: 600 }}>
              What's Inside
            </div>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, color: '#fafafa', margin: '0 0 36px' }}>
              Every dossier includes
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
              {[
                ['Architect Attribution', 'Verified primary-source attribution from preservation archives — not realtor copy.'],
                ['Celebrity Provenance',  'Owner history cross-referenced with the Palm Springs Modernism Committee and public records.'],
                ['Permit History',        'Every permit pulled since 1985 — additions, remodels, pools, ADUs, with assessed value impact.'],
                ['Pedigree Tier (A–D)',   'Classification ranking from "verified celebrity + named architect" (A) through "MCM-era only" (D).'],
                ['Provenance Score',      '0–100 composite score factoring documentation completeness, source quality, and cultural rank.'],
                ['Comparable Trades',     'Verified arms-length sales of architecturally peer homes — the only valid comp universe at this tier.'],
              ].map(([title, body]) => (
                <div key={title} style={{ borderTop: '1px solid #1e293b', paddingTop: 18 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 19, color: '#fafafa', marginBottom: 8, fontWeight: 400 }}>{title}</div>
                  <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ────────────────────────────────────────────── */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(56px,9vw,96px) clamp(20px,5vw,64px)', textAlign: 'center' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, color: '#fafafa', margin: '0 0 16px' }}>
            Have a property worth documenting?
          </h2>
          <p style={{ fontSize: 16, color: '#94a3b8', maxWidth: 580, margin: '0 auto 28px', lineHeight: 1.6 }}>
            Custom dossier research begins at the architect attribution level and includes archive-grade verification.
            Typical turnaround: 14–21 days.
          </p>
          <Link to="/dossier-request" style={ctaPrimary}>Request a Custom Dossier →</Link>
        </section>

      </div>
    </>
  );
}

const ctaPrimary: React.CSSProperties = {
  display: 'inline-block', padding: '14px 26px',
  background: GOLD, color: '#0a0a0a',
  textDecoration: 'none', fontFamily: SANS, fontSize: 11, fontWeight: 600,
  letterSpacing: 2, textTransform: 'uppercase', transition: 'background 0.15s',
};

const ctaSecondary: React.CSSProperties = {
  display: 'inline-block', padding: '14px 26px',
  background: 'transparent', color: '#fafafa', border: '1px solid #334155',
  textDecoration: 'none', fontFamily: SANS, fontSize: 11, fontWeight: 600,
  letterSpacing: 2, textTransform: 'uppercase', transition: 'border-color 0.15s, color 0.15s',
};
