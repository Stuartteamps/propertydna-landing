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
  ownerCount: number;
  eventCount: number;
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
          .select('has_provenance_dossier,provenance_score,architect_attribution,architect_verified,luxury_tier')
          .eq('apn', apn).maybeSingle(),
        supabase.from('notable_owners').select('owner_name', { count: 'exact', head: true }).eq('apn', apn),
        supabase.from('provenance_events').select('event_type', { count: 'exact', head: true }).eq('apn', apn),
      ]);
      if (cancelled || !prop || !prop.has_provenance_dossier) { setLoading(false); return; }
      setData({
        has_provenance_dossier: prop.has_provenance_dossier,
        provenance_score: prop.provenance_score,
        architect_attribution: prop.architect_attribution,
        architect_verified: prop.architect_verified,
        luxury_tier: prop.luxury_tier,
        ownerCount: ownerCount || 0,
        eventCount: eventCount || 0,
      });
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [apn]);

  if (loading || !data) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(15,23,42,0.95) 100%)',
      border: '1px solid rgba(251,191,36,0.3)',
      borderRadius: 8,
      padding: 28,
      margin: '24px 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', fontWeight: 600 }}>
          ★ Luxury Provenance Dossier
        </span>
        {data.luxury_tier && TIER_LABEL[data.luxury_tier] && (
          <span style={{ padding: '3px 10px', background: '#fbbf24', color: '#0a0a0a', borderRadius: 3, fontWeight: 700, fontSize: 10, letterSpacing: 1 }}>
            {TIER_LABEL[data.luxury_tier]}
          </span>
        )}
      </div>

      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#fafafa', margin: '0 0 14px', fontWeight: 400 }}>
        This property has a verified provenance dossier
      </h3>

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
