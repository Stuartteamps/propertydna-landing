import React, { useEffect, useState } from 'react';

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_KTTgVO3mROxubE_A9OQ7Kg_aRrnzPVT';

interface LocationScore {
  neighborhood: string | null;
  subdivision: string | null;
  same_side_street: boolean | null;
  gated_score: number | null;
  golf_frontage_score: number | null;
  view_score: number | null;
  road_noise_score: number | null;
  walkability_score: number | null;
  school_score: number | null;
  environmental_risk_score: number | null;
  luxury_neighborhood_score: number | null;
  micro_location_premium_pct: number | null;
}

interface Props {
  address?: string;
  lat?: number | null;
  lon?: number | null;
}

function ScoreRow({ label, score, invert = false }: { label: string; score: number | null; invert?: boolean }) {
  const pct = score != null ? Math.min(100, Math.max(0, score)) : null;
  const displayPct = invert && pct != null ? 100 - pct : pct;
  const color = displayPct == null ? '#6B6252'
    : displayPct >= 70 ? '#2D6A4F'
    : displayPct >= 45 ? '#C9A84C'
    : '#A07850';

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252' }}>{label}</div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#F0EBE0' }}>
          {pct != null ? `${Math.round(pct)}/100` : '—'}
        </div>
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
        {displayPct != null && (
          <div style={{ width: `${displayPct}%`, height: '100%', background: color, transition: 'width 0.6s ease' }} />
        )}
      </div>
    </div>
  );
}

export const LocationScorePanel: React.FC<Props> = ({ address }) => {
  const [scores, setScores] = useState<LocationScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) { setLoading(false); return; }

    // Find property by address, then get its location_scores
    const qs = `select=${encodeURIComponent('id')}&address=eq.${encodeURIComponent(address)}&limit=1`;
    fetch(`${SUPA_URL}/rest/v1/properties?${qs}`, {
      headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` },
    })
      .then(r => r.json())
      .then(async (rows: any[]) => {
        if (!Array.isArray(rows) || !rows.length) return;
        const propertyId = rows[0].id;
        const lqs = `select=*&property_id=eq.${encodeURIComponent(propertyId)}&order=created_at.desc&limit=1`;
        const lRes = await fetch(`${SUPA_URL}/rest/v1/location_scores?${lqs}`, {
          headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` },
        });
        const lRows = await lRes.json();
        if (Array.isArray(lRows) && lRows.length) setScores(lRows[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) {
    return <div style={{ color: '#6B6252', fontFamily: 'Jost, sans-serif', fontSize: 13, padding: '24px 0' }}>Loading micro-location data…</div>;
  }

  if (!scores) {
    return (
      <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)', padding: 28 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, color: '#F0EBE0', marginBottom: 8 }}>
          Micro-location analysis compiling…
        </div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.7 }}>
          Location scoring requires address verification against our geo-intelligence layer.
          Data will appear within 24 hours of report generation.
        </div>
      </div>
    );
  }

  const premium = scores.micro_location_premium_pct;
  const premiumColor = premium == null ? '#6B6252' : premium > 0 ? '#2D6A4F' : '#A07850';
  const premiumLabel = premium == null ? '—' : `${premium > 0 ? '+' : ''}${premium.toFixed(1)}%`;

  return (
    <div>
      {/* Header stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: '0 40px', marginBottom: 28 }}>
        {scores.neighborhood && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 4 }}>Neighborhood</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 300, color: '#F0EBE0' }}>{scores.neighborhood}</div>
          </div>
        )}
        {scores.subdivision && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 4 }}>Subdivision</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 300, color: '#F0EBE0' }}>{scores.subdivision}</div>
          </div>
        )}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 4 }}>Micro-Location Premium</div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 300, color: premiumColor }}>{premiumLabel}</div>
        </div>
        {scores.same_side_street != null && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 4 }}>Same-Side Comp Weight</div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: '#F0EBE0' }}>{scores.same_side_street ? 'Applied' : 'N/A'}</div>
          </div>
        )}
      </div>

      {/* Score grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 16 }}>Desirability Scores</div>
          <ScoreRow label="Luxury Neighborhood" score={scores.luxury_neighborhood_score} />
          <ScoreRow label="Gated / Security" score={scores.gated_score} />
          <ScoreRow label="Golf Frontage" score={scores.golf_frontage_score} />
          <ScoreRow label="Views" score={scores.view_score} />
          <ScoreRow label="Walkability" score={scores.walkability_score} />
        </div>
        <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 16 }}>Risk Factors</div>
          <ScoreRow label="Road Noise Exposure" score={scores.road_noise_score} invert />
          <ScoreRow label="School District" score={scores.school_score} />
          <ScoreRow label="Environmental Risk" score={scores.environmental_risk_score} invert />
        </div>
      </div>
    </div>
  );
};
