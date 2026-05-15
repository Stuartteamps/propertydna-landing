import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import RequestDossierModal from '@/components/RequestDossierModal';

type Property = {
  apn: string;
  address: string;
  city: string;
  state: string;
  year_built?: number | null;
  sqft?: number | null;
  lot_sqft?: number | null;
  luxury_tier?: string | null;
  luxury_value_basis?: number | null;
  provenance_score?: number | null;
  architectural_significance_score?: number | null;
  architect_attribution?: string | null;
  architect_verified?: boolean | null;
  has_provenance_dossier?: boolean | null;
  pedigree_tier?: string | null;
  pedigree_neighborhood?: string | null;
};

const PEDIGREE_TIER_INFO: Record<string, { label: string; color: string }> = {
  A: { label: 'A — Verified Pedigree',                color: '#fbbf24' },
  B: { label: 'B — Top Neighborhood + MCM Era',        color: '#a78bfa' },
  C: { label: 'C — Named Neighborhood / MCM Era',      color: '#60a5fa' },
  D: { label: 'D — Mid-Century Provenance',            color: '#34d399' },
};

type Architect = {
  id: string;
  name: string;
  birth_year?: number | null;
  death_year?: number | null;
  primary_style?: string | null;
  bio?: string | null;
  verified_commissions?: number | null;
  trade_frequency_years?: number | null;
  reputation_tier?: string | null;
  archive_sources?: string[];
};

type NotableOwner = {
  owner_name: string;
  owner_role?: string | null;
  ownership_start?: string | null;
  ownership_end?: string | null;
  verification_status: string;
  verification_sources?: string[];
  notable_events?: { year: number; event: string }[];
};

type ProvenanceEvent = {
  event_type: string;
  event_year?: number | null;
  title?: string | null;
  description?: string | null;
  source_publication?: string | null;
  verification_status?: string | null;
};

type Commission = {
  commission_year?: number | null;
  attribution_strength: string;
  primary_source_drawings?: boolean;
  primary_source_permit?: boolean;
  primary_source_press?: boolean;
  source_archives?: string[];
  notes?: string | null;
};

const TIER_LABELS: Record<string, string> = {
  trophy: 'Trophy',
  ultra_luxury: 'Ultra Luxury',
  super_luxury: 'Super Luxury',
  luxury: 'Luxury',
  premium: 'Premium',
};

const VERIFY_BADGE: Record<string, { label: string; color: string }> = {
  verified: { label: '✓ Verified', color: '#15803d' },
  partial: { label: '◐ Partial', color: '#a16207' },
  claimed_unverified: { label: '? Claimed', color: '#64748b' },
  refuted: { label: '✗ Refuted', color: '#dc2626' },
};

function fmtMoney(n?: number | null) {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function fmtYearRange(start?: string | null, end?: string | null) {
  const s = start ? new Date(start).getFullYear() : null;
  const e = end ? new Date(end).getFullYear() : null;
  if (!s && !e) return 'period unknown';
  if (s && e) return `${s}–${e}`;
  if (s) return `${s}–present`;
  return `–${e}`;
}

export default function Dossier() {
  const { apn } = useParams<{ apn: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [architect, setArchitect] = useState<Architect | null>(null);
  const [commission, setCommission] = useState<Commission | null>(null);
  const [owners, setOwners] = useState<NotableOwner[]>([]);
  const [events, setEvents] = useState<ProvenanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!apn) return;
      setLoading(true);
      setError(null);

      const { data: prop, error: propErr } = await supabase
        .from('property_master')
        .select('apn,address,city,state,year_built,sqft,lot_sqft,luxury_tier,luxury_value_basis,provenance_score,architectural_significance_score,architect_attribution,architect_verified,has_provenance_dossier,architect_id,pedigree_tier,pedigree_neighborhood')
        .eq('apn', apn)
        .maybeSingle();

      // Render the page for any property that has either a full dossier OR a pedigree tier.
      if (propErr || !prop || (!prop.has_provenance_dossier && !prop.pedigree_tier)) {
        if (!cancelled) { setError('Dossier not found'); setLoading(false); }
        return;
      }
      if (!cancelled) {
        setProperty(prop as Property);
        // Set page title + OG tags for SEO/social
        const title = `${prop.address}, ${prop.city} — PropertyDNA Dossier`;
        document.title = title;
        const setMeta = (name: string, content: string, prop = false) => {
          const attr = prop ? 'property' : 'name';
          let m = document.querySelector(`meta[${attr}="${name}"]`);
          if (!m) { m = document.createElement('meta'); m.setAttribute(attr, name); document.head.appendChild(m); }
          m.setAttribute('content', content);
        };
        const desc = `Verified provenance dossier for ${prop.address}, ${prop.city}` +
          (prop.architect_attribution ? ` — designed by ${prop.architect_attribution}` : '') +
          (prop.pedigree_neighborhood ? ` · ${prop.pedigree_neighborhood}` : '') + '.';
        setMeta('description', desc);
        setMeta('og:title', title, true);
        setMeta('og:description', desc, true);
        setMeta('og:type', 'article', true);
        setMeta('og:url', `https://www.thepropertydna.com/dossier/${prop.apn}`, true);
        setMeta('twitter:card', 'summary_large_image');
        setMeta('twitter:title', title);
        setMeta('twitter:description', desc);
      }

      const [ownersRes, eventsRes, commRes] = await Promise.all([
        supabase.from('notable_owners').select('*').eq('apn', apn).order('ownership_start', { ascending: true }),
        supabase.from('provenance_events').select('*').eq('apn', apn).order('event_year', { ascending: true }),
        supabase.from('architect_commissions').select('*').eq('apn', apn).maybeSingle(),
      ]);

      if (!cancelled) {
        setOwners((ownersRes.data || []) as NotableOwner[]);
        setEvents((eventsRes.data || []) as ProvenanceEvent[]);
        setCommission((commRes.data as Commission) || null);
      }

      if ((prop as any).architect_id) {
        const { data: arch } = await supabase
          .from('architects')
          .select('*')
          .eq('id', (prop as any).architect_id)
          .maybeSingle();
        if (!cancelled && arch) setArchitect(arch as Architect);
      }

      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [apn]);

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#e5e7eb' }}>
      Loading dossier…
    </div>;
  }

  if (error || !property) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#e5e7eb', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontFamily: 'serif', fontSize: 32 }}>Dossier not found</h1>
      <p style={{ color: '#94a3b8' }}>The provenance dossier for this property has not been compiled yet.</p>
      <Link to="/" style={{ color: '#fbbf24', textDecoration: 'underline' }}>Return to PropertyDNA</Link>
    </div>;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Residence",
    "name": `${property.address}, ${property.city}`,
    "url": `https://www.thepropertydna.com/dossier/${property.apn}`,
    "address": { "@type": "PostalAddress", "streetAddress": property.address, "addressLocality": property.city, "addressRegion": property.state },
    ...(architect ? {
      "subjectOf": {
        "@type": "CreativeWork",
        "creator": { "@type": "Person", "name": architect.name, "jobTitle": "Architect" },
      }
    } : {}),
    ...(owners.length > 0 ? {
      "owner": owners.map(o => ({ "@type": "Person", "name": o.owner_name, ...(o.owner_role ? { "jobTitle": o.owner_role } : {}) })),
    } : {}),
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '60px 24px' }}>

        {/* Header */}
        <div style={{ borderBottom: '1px solid #1f2937', paddingBottom: 40, marginBottom: 40 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>
            PropertyDNA — Provenance Dossier
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 42, lineHeight: 1.15, margin: '0 0 12px', fontWeight: 400, color: '#fafafa' }}>
            {property.address}
          </h1>
          <div style={{ color: '#9ca3af', fontSize: 16 }}>
            {property.city}, {property.state}
            {property.year_built ? ` · Built ${property.year_built}` : ''}
            {property.sqft ? ` · ${property.sqft.toLocaleString()} sqft` : ''}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
            {property.pedigree_tier && PEDIGREE_TIER_INFO[property.pedigree_tier] && (
              <span style={{ padding: '6px 14px', background: PEDIGREE_TIER_INFO[property.pedigree_tier].color, color: '#0a0a0a', borderRadius: 4, fontWeight: 700, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
                {PEDIGREE_TIER_INFO[property.pedigree_tier].label}
              </span>
            )}
            {property.pedigree_neighborhood && (
              <Link to={`/neighborhood/${property.pedigree_neighborhood.toLowerCase().replace(/\s+/g, '-')}`}
                style={{ padding: '6px 14px', background: 'transparent', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 4, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                {property.pedigree_neighborhood} →
              </Link>
            )}
            {property.luxury_tier && TIER_LABELS[property.luxury_tier] && (
              <span style={{ padding: '6px 14px', background: 'transparent', color: '#fbbf24', border: '1px solid #fbbf24', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                {TIER_LABELS[property.luxury_tier]}
              </span>
            )}
            {property.luxury_value_basis && (
              <span style={{ padding: '6px 14px', background: 'transparent', color: '#9ca3af', border: '1px solid #1f2937', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                {fmtMoney(property.luxury_value_basis)}
              </span>
            )}
            {property.provenance_score != null && (
              <span style={{ padding: '6px 14px', background: '#1f2937', color: '#e5e7eb', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                Provenance Score: {property.provenance_score}/100
              </span>
            )}
          </div>
        </div>

        {/* Architect attribution */}
        {architect && (
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 20, fontWeight: 600 }}>
              Architect Attribution {commission?.attribution_strength === 'verified' && <span style={{ color: '#15803d', marginLeft: 8 }}>✓ Verified</span>}
            </h2>
            <div style={{ background: '#111827', padding: 28, borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <Link
                  to={`/architect/${architect.name.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-')}`}
                  style={{ fontFamily: 'Georgia, serif', fontSize: 28, margin: 0, color: '#fafafa', fontWeight: 400, textDecoration: 'none', borderBottom: '1px dotted #fbbf24' }}
                >{architect.name}</Link>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  {architect.birth_year}{architect.death_year ? `–${architect.death_year}` : '–present'}
                </span>
              </div>
              {architect.bio && <p style={{ color: '#cbd5e1', lineHeight: 1.6, fontSize: 15 }}>{architect.bio}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 18, marginTop: 20 }}>
                {architect.primary_style && (<div><div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Primary Style</div><div style={{ color: '#e5e7eb' }}>{architect.primary_style}</div></div>)}
                {commission?.commission_year && (<div><div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Commissioned</div><div style={{ color: '#e5e7eb' }}>{commission.commission_year}</div></div>)}
                {architect.verified_commissions != null && (<div><div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Documented Works</div><div style={{ color: '#e5e7eb' }}>{architect.verified_commissions}</div></div>)}
                {architect.trade_frequency_years != null && (<div><div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Trade Frequency</div><div style={{ color: '#e5e7eb' }}>Once every {architect.trade_frequency_years} yr</div></div>)}
              </div>
              {commission && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #1f2937' }}>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Primary Sources</div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#cbd5e1', flexWrap: 'wrap' }}>
                    <span>{commission.primary_source_drawings ? '✓' : '·'} Original drawings</span>
                    <span>{commission.primary_source_permit ? '✓' : '·'} Building permit</span>
                    <span>{commission.primary_source_press ? '✓' : '·'} Period press</span>
                  </div>
                  {commission.source_archives && commission.source_archives.length > 0 && (
                    <div style={{ marginTop: 14, fontSize: 12, color: '#94a3b8' }}>
                      Archives: {commission.source_archives.join(' · ')}
                    </div>
                  )}
                  {commission.notes && <p style={{ marginTop: 14, fontSize: 13, color: '#cbd5e1', fontStyle: 'italic' }}>{commission.notes}</p>}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Notable owners */}
        {owners.length > 0 && (
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 20, fontWeight: 600 }}>
              Notable Owners
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {owners.map((o, i) => {
                const badge = VERIFY_BADGE[o.verification_status] || VERIFY_BADGE.claimed_unverified;
                return (
                  <div key={i} style={{ background: '#111827', padding: 24, borderRadius: 6, borderLeft: `3px solid ${badge.color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#fafafa' }}>{o.owner_name}</div>
                        <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>{o.owner_role ? `${o.owner_role} · ` : ''}{fmtYearRange(o.ownership_start, o.ownership_end)}</div>
                      </div>
                      <span style={{ fontSize: 11, color: badge.color, fontWeight: 600 }}>{badge.label}</span>
                    </div>
                    {o.notable_events && o.notable_events.length > 0 && (
                      <ul style={{ marginTop: 12, paddingLeft: 18, color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 }}>
                        {o.notable_events.map((e, j) => <li key={j}><strong style={{ color: '#fbbf24' }}>{e.year}</strong> — {e.event}</li>)}
                      </ul>
                    )}
                    {o.verification_sources && o.verification_sources.length > 0 && (
                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #1f2937', fontSize: 12, color: '#94a3b8' }}>
                        Sources: {o.verification_sources.join(' · ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Provenance events */}
        {events.length > 0 && (
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 20, fontWeight: 600 }}>
              Provenance Events
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {events.map((e, i) => (
                <div key={i} style={{ background: '#111827', padding: 22, borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 11, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: 1 }}>{e.event_type.replace(/_/g, ' ')}</div>
                    {e.event_year && <div style={{ fontSize: 12, color: '#9ca3af' }}>{e.event_year}</div>}
                  </div>
                  {e.title && <div style={{ fontFamily: 'Georgia, serif', fontSize: 19, color: '#fafafa', marginBottom: 6 }}>{e.title}</div>}
                  {e.description && <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{e.description}</p>}
                  {e.source_publication && <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8' }}>— {e.source_publication}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div style={{ marginTop: 72, padding: 32, background: 'linear-gradient(135deg, #1f2937 0%, #0f172a 100%)', borderRadius: 6, textAlign: 'center', border: '1px solid #334155' }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 14 }}>Own a Luxury Estate?</div>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 26, margin: '0 0 14px', color: '#fafafa', fontWeight: 400 }}>We build dossiers like this for $5M+ luxury homes.</h3>
          <p style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.6, maxWidth: 560, margin: '0 auto 24px' }}>
            Verified celebrity provenance · Architect attribution · Cross-asset benchmarking · 50-year climate-adjusted asset value. The documentation layer Sotheby's charges 15% for.
          </p>
          <button onClick={() => setModalOpen(true)} style={{ display: 'inline-block', padding: '14px 32px', background: '#fbbf24', color: '#0a0a0a', textDecoration: 'none', borderRadius: 4, fontWeight: 600, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>
            Request Your Dossier
          </button>
        </div>

        <RequestDossierModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          apn={property.apn}
          propertyAddress={`${property.address}, ${property.city}`}
          pedigreeTier={property.pedigree_tier}
          sourcePage={`dossier/${property.apn}`}
        />

        <div style={{ marginTop: 48, fontSize: 11, color: '#475569', textAlign: 'center' }}>
          PropertyDNA · APN {property.apn}
        </div>
      </div>
    </div>
  );
}
