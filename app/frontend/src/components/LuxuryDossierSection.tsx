import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';

type Props = { apn?: string | null };

type DossierSummary = {
  has_provenance_dossier: boolean;
  provenance_score: number | null;
  architect_attribution: string | null;
  architect_verified: boolean | null;
  luxury_tier: string | null;
  pedigree_tier: string | null;
  pedigree_neighborhood: string | null;
  ownerCount: number;
  eventCount: number;
};

const PEDIGREE_LABEL: Record<string, { label: string; color: string; desc: string }> = {
  A: { label: 'A — Verified Pedigree', color: '#fbbf24', desc: 'Verified architect attribution or celebrity provenance with primary source documentation.' },
  B: { label: 'B — Top Neighborhood + MCM Era', color: '#a78bfa', desc: 'In a documented luxury neighborhood built during the mid-century modern golden age (1947-1975).' },
  C: { label: 'C — Named Neighborhood / MCM Era', color: '#60a5fa', desc: 'Property in a named luxury neighborhood or substantial MCM-era home.' },
  D: { label: 'D — Mid-Century Provenance', color: '#34d399', desc: 'Mid-century era Palm Springs property or Coachella Valley luxury-tier asset.' },
};

const TIER_LABEL: Record<string, string> = {
  trophy: 'Trophy',
  ultra_luxury: 'Ultra Luxury',
  super_luxury: 'Super Luxury',
  luxury: 'Luxury',
};

export default function LuxuryDossierSection({ apn }: Props) {
  const [data, setData] = useState<DossierSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!apn) { setLoading(false); return; }
      const [{ data: prop }, { count: ownerCount }, { count: eventCount }] = await Promise.all([
        supabase.from('property_master')
          .select('has_provenance_dossier,provenance_score,architect_attribution,architect_verified,luxury_tier,pedigree_tier,pedigree_neighborhood')
          .eq('apn', apn).maybeSingle(),
        supabase.from('notable_owners').select('owner_name', { count: 'exact', head: true }).eq('apn', apn),
        supabase.from('provenance_events').select('event_type', { count: 'exact', head: true }).eq('apn', apn),
      ]);
      // Render if EITHER full dossier OR pedigree tier exists
      if (cancelled || !prop || (!prop.has_provenance_dossier && !prop.pedigree_tier)) { setLoading(false); return; }
      setData({
        has_provenance_dossier: !!prop.has_provenance_dossier,
        provenance_score: prop.provenance_score,
        architect_attribution: prop.architect_attribution,
        architect_verified: prop.architect_verified,
        luxury_tier: prop.luxury_tier,
        pedigree_tier: prop.pedigree_tier,
        pedigree_neighborhood: prop.pedigree_neighborhood,
        ownerCount: ownerCount || 0,
        eventCount: eventCount || 0,
      });
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [apn]);

  if (loading || !data) return null;

  const pedigree = data.pedigree_tier ? PEDIGREE_LABEL[data.pedigree_tier] : null;
  const accentColor = pedigree?.color || '#fbbf24';
  const headline = data.has_provenance_dossier
    ? 'Verified provenance dossier'
    : `Pedigree-classified property${data.pedigree_neighborhood ? ` — ${data.pedigree_neighborhood}` : ''}`;

  return (
    <div style={{
      background: `linear-gradient(135deg, ${accentColor}14 0%, rgba(15,23,42,0.95) 100%)`,
      border: `1px solid ${accentColor}4D`,
      borderRadius: 8,
      padding: 28,
      margin: '24px 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, letterSpacing: 4, color: accentColor, textTransform: 'uppercase', fontWeight: 600 }}>
          {data.has_provenance_dossier ? '★ Luxury Provenance Dossier' : 'Pedigree Classification'}
        </span>
        {pedigree && (
          <span style={{ padding: '3px 10px', background: accentColor, color: '#0a0a0a', borderRadius: 3, fontWeight: 700, fontSize: 10, letterSpacing: 1 }}>
            {pedigree.label}
          </span>
        )}
        {data.luxury_tier && TIER_LABEL[data.luxury_tier] && (
          <span style={{ padding: '3px 10px', background: 'transparent', color: '#fbbf24', border: '1px solid #fbbf24', borderRadius: 3, fontWeight: 700, fontSize: 10, letterSpacing: 1 }}>
            {TIER_LABEL[data.luxury_tier]}
          </span>
        )}
      </div>

      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#fafafa', margin: '0 0 8px', fontWeight: 400 }}>
        {headline}
      </h3>
      {pedigree && !data.has_provenance_dossier && (
        <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.5, marginBottom: 14 }}>{pedigree.desc}</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 22 }}>
        {data.provenance_score != null && (
          <div>
            <div style={{ fontSize: 10, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Provenance Score</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: '#fafafa' }}>{data.provenance_score}<span style={{ fontSize: 14, color: '#94a3b8' }}>/100</span></div>
          </div>
        )}
        {data.architect_attribution && (
          <div>
            <div style={{ fontSize: 10, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Architect</div>
            <div style={{ color: '#e5e7eb', fontSize: 15 }}>
              {data.architect_attribution}
              {data.architect_verified && <span style={{ color: '#15803d', marginLeft: 6, fontSize: 11 }}>✓</span>}
            </div>
          </div>
        )}
        {data.ownerCount > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Notable Owners</div>
            <div style={{ color: '#e5e7eb', fontSize: 15 }}>{data.ownerCount} documented</div>
          </div>
        )}
        {data.eventCount > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Provenance Events</div>
            <div style={{ color: '#e5e7eb', fontSize: 15 }}>{data.eventCount} verified</div>
          </div>
        )}
      </div>

      <Link to={`/dossier/${apn}`} style={{
        display: 'inline-block',
        padding: '10px 22px',
        background: '#fbbf24',
        color: '#0a0a0a',
        textDecoration: 'none',
        borderRadius: 4,
        fontWeight: 600,
        fontSize: 12,
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}>
        View Full Dossier →
      </Link>
    </div>
  );
}
