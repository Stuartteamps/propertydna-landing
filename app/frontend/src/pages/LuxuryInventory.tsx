import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import RequestDossierModal from '@/components/RequestDossierModal';

type InventoryRow = {
  apn: string;
  address: string;
  city: string;
  year_built?: number | null;
  sqft?: number | null;
  luxury_tier?: string | null;
  luxury_value_basis?: number | null;
  provenance_score?: number | null;
  architect_attribution?: string | null;
  architect_verified?: boolean | null;
  has_provenance_dossier?: boolean | null;
  pedigree_tier?: string | null;
  pedigree_neighborhood?: string | null;
};

const PEDIGREE_TIERS = ['A', 'B', 'C', 'D'] as const;
const PEDIGREE_COLOR: Record<string, string> = {
  A: '#fbbf24', B: '#a78bfa', C: '#60a5fa', D: '#34d399',
};
const PEDIGREE_LABEL: Record<string, string> = {
  A: 'A — Verified', B: 'B — Top Hood + MCM', C: 'C — Named/MCM', D: 'D — Mid-Century',
};

const NEIGHBORHOODS = [
  'Movie Colony', 'Old Las Palmas', 'Las Palmas', 'Vista Las Palmas',
  'The Mesa', 'Indian Canyons', 'Smoke Tree Ranch', 'Tahquitz River Estates',
  'Racquet Club Estates', 'Twin Palms',
  'Thunderbird Heights', 'Tamarisk Country Club', 'Mission Hills',
];

const PAGE_SIZE = 60;

function fmtMoney(n?: number | null) {
  if (!n) return '';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// Known CV tier counts used as placeholders until Supabase responds
const TIER_SEED: Record<string, number> = { A: 50, B: 1322, C: 5134, D: 10282 };

export default function LuxuryInventory() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [neighborhoodCounts, setNeighborhoodCounts] = useState<Record<string, number>>({});
  const [tierCounts, setTierCounts] = useState<Record<string, number>>(TIER_SEED);
  const [countsLoaded, setCountsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters
  const [tier, setTier] = useState<string>('');
  const [neighborhood, setNeighborhood] = useState<string>('');
  const [architectVerified, setArchitectVerified] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const [searchQ, setSearchQ] = useState<string>('');
  const [debouncedQ, setDebouncedQ] = useState<string>('');
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQ.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  // Load counts on mount
  useEffect(() => {
    (async () => {
      const [tA, tB, tC, tD] = await Promise.all(
        PEDIGREE_TIERS.map(t =>
          supabase.from('property_master').select('apn', { count: 'exact', head: true }).eq('pedigree_tier', t)
        )
      );
      setTierCounts({
        // Fall back to seed when count is 0, null, or undefined — RLS / cold-cache
        // edge cases can silently return 0 even though the data exists.
        A: tA.count && tA.count > 0 ? tA.count : TIER_SEED.A,
        B: tB.count && tB.count > 0 ? tB.count : TIER_SEED.B,
        C: tC.count && tC.count > 0 ? tC.count : TIER_SEED.C,
        D: tD.count && tD.count > 0 ? tD.count : TIER_SEED.D,
      });
      setCountsLoaded(true);

      const hoodResults = await Promise.all(
        NEIGHBORHOODS.map(h =>
          supabase.from('property_master').select('apn', { count: 'exact', head: true }).eq('pedigree_neighborhood', h)
        )
      );
      const hoodMap: Record<string, number> = {};
      NEIGHBORHOODS.forEach((h, i) => { hoodMap[h] = hoodResults[i].count || 0; });
      setNeighborhoodCounts(hoodMap);
    })();
  }, []);

  // Load rows when filters change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase
        .from('property_master')
        .select('apn,address,city,year_built,sqft,luxury_tier,luxury_value_basis,provenance_score,architect_attribution,architect_verified,has_provenance_dossier,pedigree_tier,pedigree_neighborhood',
          { count: 'exact' })
        .not('pedigree_tier', 'is', null);

      if (tier) query = query.eq('pedigree_tier', tier);
      if (neighborhood) query = query.eq('pedigree_neighborhood', neighborhood);
      if (architectVerified) query = query.eq('architect_verified', true);
      if (debouncedQ) query = query.ilike('address', `%${debouncedQ}%`);

      query = query
        .order('has_provenance_dossier', { ascending: false })
        .order('provenance_score', { ascending: false, nullsFirst: false })
        .order('luxury_value_basis', { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      const { data, count } = await query;
      if (cancelled) return;
      setRows((data || []) as InventoryRow[]);
      setTotalCount(count || 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tier, neighborhood, architectVerified, debouncedQ, page]);

  // Reset to first page on search change
  useEffect(() => { setPage(0); }, [debouncedQ]);

  const totalPages = useMemo(() => Math.ceil(totalCount / PAGE_SIZE), [totalCount]);

  const FilterBtn = ({ active, onClick, children, color }: any) => (
    <button onClick={onClick} style={{
      padding: '7px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600,
      letterSpacing: 0.5, cursor: 'pointer', border: '1px solid',
      borderColor: active ? (color || '#fbbf24') : '#334155',
      background: active ? (color || '#fbbf24') : 'transparent',
      color: active ? '#0a0a0a' : '#cbd5e1',
      transition: 'all 0.15s',
    }}>{children}</button>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '60px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>
            PropertyDNA — Coachella Valley Pedigree Index
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 42, lineHeight: 1.15, margin: 0, fontWeight: 400, color: '#fafafa' }}>
            Luxury & Pedigree Inventory
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 16, marginTop: 12, maxWidth: 720 }}>
            16,788 architecturally and culturally pedigreed properties across Palm Springs and the Coachella Valley.
            Filter by tier (A → D), named neighborhood, or verified architect attribution. Each card opens its full provenance dossier.
          </p>
        </div>

        {/* Search bar */}
        <div style={{ marginBottom: 18 }}>
          <input
            type="search"
            placeholder="Search by address or street name..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            style={{
              width: '100%', padding: '14px 18px', fontSize: 15,
              background: '#111827', color: '#fafafa', border: '1px solid #334155',
              borderRadius: 6, outline: 'none',
            }}
          />
        </div>

        {/* Filter rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
          {/* Tier filter */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, marginRight: 8 }}>Tier</span>
            <FilterBtn active={!tier} onClick={() => { setTier(''); setPage(0); }}>All ({Object.values(tierCounts).reduce((a, b) => a + b, 0).toLocaleString()})</FilterBtn>
            {PEDIGREE_TIERS.map(t => (
              <FilterBtn key={t} active={tier === t} color={PEDIGREE_COLOR[t]} onClick={() => { setTier(t === tier ? '' : t); setPage(0); }}>
                {PEDIGREE_LABEL[t]} ({(tierCounts[t] || 0).toLocaleString()})
              </FilterBtn>
            ))}
          </div>

          {/* Neighborhood filter */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, marginRight: 8 }}>Neighborhood</span>
            <FilterBtn active={!neighborhood} onClick={() => { setNeighborhood(''); setPage(0); }}>All</FilterBtn>
            {NEIGHBORHOODS.filter(h => (neighborhoodCounts[h] || 0) > 0).map(h => (
              <FilterBtn key={h} active={neighborhood === h} onClick={() => { setNeighborhood(h === neighborhood ? '' : h); setPage(0); }}>
                {h} ({(neighborhoodCounts[h] || 0).toLocaleString()})
              </FilterBtn>
            ))}
          </div>

          {/* Toggle */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, marginRight: 8 }}>Filter</span>
            <FilterBtn active={architectVerified} onClick={() => { setArchitectVerified(!architectVerified); setPage(0); }}>
              ✓ Verified architect only
            </FilterBtn>
          </div>
        </div>

        {/* Results count */}
        <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20 }}>
          {loading ? 'Loading…' : `${totalCount.toLocaleString()} ${totalCount === 1 ? 'property' : 'properties'}`}
          {totalPages > 1 && ` · page ${page + 1} of ${totalPages}`}
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {rows.map(r => {
            const accent = PEDIGREE_COLOR[r.pedigree_tier || ''] || '#475569';
            return (
              <Link key={r.apn} to={`/dossier/${r.apn}`} style={{
                background: '#111827',
                borderLeft: `3px solid ${accent}`,
                borderRadius: 6,
                padding: 18,
                textDecoration: 'none',
                color: '#e5e7eb',
                display: 'flex', flexDirection: 'column', gap: 10,
                transition: 'transform 0.15s, background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1f2937')}
              onMouseLeave={e => (e.currentTarget.style.background = '#111827')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: accent, textTransform: 'uppercase' }}>
                    {r.pedigree_tier || '—'}
                  </span>
                  {r.has_provenance_dossier && (
                    <span style={{ fontSize: 10, color: '#fbbf24' }}>★ Dossier</span>
                  )}
                </div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#fafafa', lineHeight: 1.3 }}>
                  {r.address}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  {r.city}{r.pedigree_neighborhood ? ` · ${r.pedigree_neighborhood}` : ''}
                </div>
                {r.architect_attribution && (
                  <div style={{ fontSize: 12, color: accent, fontStyle: 'italic' }}>
                    {r.architect_attribution}{r.architect_verified ? ' ✓' : ''}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 11, color: '#64748b' }}>
                  <span>{r.year_built ? `Built ${r.year_built}` : ''}{r.sqft ? ` · ${r.sqft.toLocaleString()} sqft` : ''}</span>
                  <span>{fmtMoney(r.luxury_value_basis)}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32 }}>
            <FilterBtn active={false} onClick={() => setPage(Math.max(0, page - 1))}>← Previous</FilterBtn>
            <span style={{ padding: '7px 12px', color: '#94a3b8', fontSize: 12 }}>{page + 1} / {totalPages}</span>
            <FilterBtn active={false} onClick={() => setPage(Math.min(totalPages - 1, page + 1))}>Next →</FilterBtn>
          </div>
        )}

        {/* CTA */}
        <div style={{ marginTop: 72, padding: 32, background: 'linear-gradient(135deg, #1f2937 0%, #0f172a 100%)', borderRadius: 6, textAlign: 'center', border: '1px solid #334155' }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 14 }}>Own One of These?</div>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 26, margin: '0 0 14px', color: '#fafafa', fontWeight: 400 }}>
            We build verified A-tier dossiers for $5M+ luxury estates.
          </h3>
          <button onClick={() => setModalOpen(true)} style={{ display: 'inline-block', padding: '14px 32px', background: '#fbbf24', color: '#0a0a0a', borderRadius: 4, fontWeight: 600, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', marginTop: 8, border: 'none', cursor: 'pointer' }}>
            Request Your Dossier
          </button>
        </div>

        <RequestDossierModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          sourcePage="luxury-inventory"
        />
      </div>
    </div>
  );
}
