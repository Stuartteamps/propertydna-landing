import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Listing {
  id: string; address: string; street: string; city: string; state: string; zip: string;
  price: number; priceFormatted: string; pricePerSqft: number | null;
  sqft: number | null; beds: number | null; baths: number | null;
  yearBuilt: number | null; dom: number | null; propertyType: string;
  status: string; score: number; scoreLabel: string; scoreColor: string;
  reportUrl: string;
}

// ── Region config ─────────────────────────────────────────────────────────────
const REGIONS: Record<string, { title: string; subtitle: string; description: string; tag: string }> = {
  'west-valley': {
    title: 'West Valley',
    subtitle: 'Palm Springs · Cathedral City · Desert Hot Springs',
    description: 'The original desert playground. Mid-century architecture, world-class golf, and the most recognized zip codes in the Coachella Valley.',
    tag: 'west',
  },
  'east-valley': {
    title: 'East Valley',
    subtitle: 'Palm Desert · Rancho Mirage · Indian Wells · La Quinta · Indio',
    description: 'Master-planned communities, resort living, and exceptional value. The east valley offers the strongest appreciation trajectory in the region.',
    tag: 'east',
  },
  'recently-sold': {
    title: 'Recently Sold',
    subtitle: 'All Coachella Valley Cities',
    description: 'Closed transactions across the valley. The most accurate picture of where the market is actually pricing homes right now.',
    tag: 'sold',
  },
};

// ── Stat pill ─────────────────────────────────────────────────────────────────
function Stat({ label, value }: { label: string; value: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 48 }}>
      <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, fontWeight: 400, color: '#F0EBE0' }}>{value}</div>
      <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: '#6B6252', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Listing card ──────────────────────────────────────────────────────────────
function ListingCard({ l }: { l: Listing }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.025)',
        border: `1px solid ${hovered ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.07)'}`,
        transition: 'all 0.2s ease',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Price band */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 28, fontWeight: 400, color: '#F0EBE0', lineHeight: 1 }}>
              {l.priceFormatted || '—'}
            </div>
            {l.pricePerSqft && (
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', marginTop: 4 }}>
                ${l.pricePerSqft}/sqft
              </div>
            )}
          </div>

          {/* DNA Score ring */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: `conic-gradient(${l.scoreColor} ${l.score * 3.6}deg, rgba(107,98,82,0.2) 0)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: '#0A0908',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Jost, sans-serif', fontSize: 12, fontWeight: 500, color: l.scoreColor,
              }}>
                {l.score}
              </div>
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 8, letterSpacing: '1.5px', textTransform: 'uppercase', color: l.scoreColor, marginTop: 4 }}>
              {l.scoreLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Address */}
      <div style={{ padding: '14px 24px 10px' }}>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, fontWeight: 400, color: '#F0EBE0', lineHeight: 1.4 }}>
          {l.street || l.address}
        </div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', marginTop: 3 }}>
          {l.city}, {l.state} {l.zip}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ padding: '10px 24px 16px', display: 'flex', gap: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Stat label="Beds"  value={l.beds} />
        <Stat label="Baths" value={l.baths} />
        <Stat label="SqFt"  value={l.sqft ? l.sqft.toLocaleString() : null} />
        <Stat label="Built" value={l.yearBuilt} />
        <Stat label="DOM"   value={l.dom !== null ? `${l.dom}d` : null} />
      </div>

      {/* Property type + CTA */}
      <div style={{ padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: '#6B6252' }}>
          {l.propertyType}
        </div>
        <a
          href={l.reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: 'Jost, sans-serif', fontSize: 9, fontWeight: 500,
            letterSpacing: '2.5px', textTransform: 'uppercase',
            color: '#C9A84C', textDecoration: 'none',
            borderBottom: '1px solid rgba(201,168,76,0.3)',
            paddingBottom: 2,
          }}
        >
          DNA Report →
        </a>
      </div>
    </div>
  );
}

// ── Filters ───────────────────────────────────────────────────────────────────
type SortKey = 'dom' | 'price_asc' | 'price_desc' | 'score';

function applyFilters(
  listings: Listing[],
  minPrice: number,
  maxPrice: number,
  minBeds: number,
  sort: SortKey
): Listing[] {
  let out = listings.filter(l =>
    (!minPrice || (l.price || 0) >= minPrice) &&
    (!maxPrice || (l.price || 0) <= maxPrice) &&
    (!minBeds  || (l.beds  || 0) >= minBeds)
  );
  if (sort === 'price_asc')  out = [...out].sort((a,b) => (a.price||0) - (b.price||0));
  if (sort === 'price_desc') out = [...out].sort((a,b) => (b.price||0) - (a.price||0));
  if (sort === 'score')      out = [...out].sort((a,b) => b.score - a.score);
  // dom = default (already sorted by freshness from API)
  return out;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Listings() {
  const { region = 'west-valley' } = useParams<{ region: string }>();
  const navigate    = useNavigate();
  const cfg         = REGIONS[region] || REGIONS['west-valley'];

  const [listings, setListings]   = useState<Listing[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [medianPrice, setMedianPrice] = useState<number | null>(null);
  const [authOpen, setAuthOpen]   = useState(false);
  const [displayCount, setDisplayCount] = useState(24);

  // Filters
  const [minPrice, setMinPrice]   = useState(0);
  const [maxPrice, setMaxPrice]   = useState(0);
  const [minBeds, setMinBeds]     = useState(0);
  const [sort, setSort]           = useState<SortKey>('dom');

  useEffect(() => {
    setLoading(true);
    setError('');
    setListings([]);
    setDisplayCount(24);
    fetch(`/.netlify/functions/get-listings?region=${cfg.tag}&limit=24`)
      .then(r => r.json())
      .then(data => {
        setListings(data.listings || []);
        setMedianPrice(data.medianPrice || null);
        setLoading(false);
      })

      .catch(() => { setError('Could not load listings. Please try again.'); setLoading(false); });
  }, [region, cfg.tag]);

  const filtered = applyFilters(listings, minPrice, maxPrice, minBeds, sort);
  const visible  = filtered.slice(0, displayCount);

  const inp: React.CSSProperties = {
    fontFamily: 'Jost, sans-serif', fontSize: 13, fontWeight: 300,
    color: '#F0EBE0', background: 'transparent',
    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.12)',
    padding: '8px 0 10px', outline: 'none', width: '100%',
  };

  const selStyle: React.CSSProperties = { ...inp, backgroundImage: 'none', cursor: 'pointer' };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '2.5px',
    textTransform: 'uppercase', padding: '10px 0', cursor: 'pointer',
    background: 'transparent', border: 'none',
    borderBottom: active ? '1px solid #C9A84C' : '1px solid transparent',
    color: active ? '#C9A84C' : '#6B6252',
    marginRight: 24,
  });

  return (
    <div style={{ background: '#0A0908', minHeight: '100vh', color: '#F0EBE0' }}>
      <Nav onSignInClick={() => setAuthOpen(true)} onRequestAccessClick={() => setAuthOpen(true)} />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialView="signin" />

      {/* ── Hero ── */}
      <section style={{ padding: 'clamp(100px,12vw,160px) clamp(24px,6vw,80px) 60px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '4px', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 16 }}>
            Stuart Team · Live Listings
          </div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(40px,5vw,68px)', fontWeight: 300, color: '#F0EBE0', margin: '0 0 12px', lineHeight: 1.05 }}>
            {cfg.title}
          </h1>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', color: '#6B6252', marginBottom: 20 }}>
            {cfg.subtitle}
          </div>
          <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 15, fontWeight: 300, color: 'rgba(240,235,224,0.55)', lineHeight: 1.8, maxWidth: 560, margin: '0 0 40px' }}>
            {cfg.description}
          </p>

          {/* Region tabs */}
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 40 }}>
            {Object.entries(REGIONS).map(([slug, r]) => (
              <button key={slug} style={tabStyle(region === slug)} onClick={() => navigate(`/listings/${slug}`)}>
                {r.title}
              </button>
            ))}
          </div>

          {/* Stats bar */}
          {!loading && listings.length > 0 && (
            <div style={{ display: 'flex', gap: 40, marginBottom: 40, flexWrap: 'wrap' }}>
              {[
                { label: 'Active Listings', value: listings.length },
                { label: 'Median Price', value: medianPrice ? '$' + Math.round(medianPrice).toLocaleString() : '—' },
                { label: 'Avg Days on Market', value: listings.filter(l=>l.dom!=null).length ? Math.round(listings.filter(l=>l.dom!=null).reduce((s,l)=>s+(l.dom||0),0)/listings.filter(l=>l.dom!=null).length) + 'd' : '—' },
                { label: 'Avg DNA Score', value: Math.round(listings.reduce((s,l)=>s+l.score,0)/listings.length) + '/100' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, color: '#C9A84C' }}>{s.value}</div>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#6B6252', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0 32px', marginBottom: 40 }}>
            <div>
              <label style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: '#6B6252', display: 'block', marginBottom: 4 }}>Min Price</label>
              <select style={selStyle} value={minPrice} onChange={e => setMinPrice(Number(e.target.value))}>
                <option value={0}>Any</option>
                {[300000,500000,750000,1000000,1500000,2000000].map(v => <option key={v} value={v}>${(v/1000).toFixed(0)}k</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: '#6B6252', display: 'block', marginBottom: 4 }}>Max Price</label>
              <select style={selStyle} value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))}>
                <option value={0}>Any</option>
                {[500000,750000,1000000,1500000,2000000,3000000].map(v => <option key={v} value={v}>${(v/1000).toFixed(0)}k</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: '#6B6252', display: 'block', marginBottom: 4 }}>Min Beds</label>
              <select style={selStyle} value={minBeds} onChange={e => setMinBeds(Number(e.target.value))}>
                <option value={0}>Any</option>
                {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}+</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: '#6B6252', display: 'block', marginBottom: 4 }}>Sort By</label>
              <select style={selStyle} value={sort} onChange={e => setSort(e.target.value as SortKey)}>
                <option value="dom">Newest First</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
                <option value="score">DNA Score</option>
              </select>
            </div>
          </div>

          {/* Listings grid */}
          {loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: 260, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          )}

          {error && (
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: '#ef5350', padding: '40px 0' }}>{error}</div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: '#6B6252', padding: '40px 0' }}>
              No listings match your filters. Try adjusting the price or bed count.
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {visible.map(l => <ListingCard key={l.id} l={l} />)}
              </div>
              {filtered.length > displayCount && (
                <div style={{ textAlign: 'center', marginTop: 40 }}>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', marginBottom: 16 }}>
                    Showing {displayCount} of {filtered.length} listings
                  </div>
                  <button
                    onClick={() => setDisplayCount(n => n + 24)}
                    style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#C9A84C', background: 'transparent', border: '1px solid rgba(201,168,76,0.4)', padding: '14px 32px', cursor: 'pointer' }}>
                    Load More
                  </button>
                </div>
              )}
            </>
          )}

          {/* CTA band */}
          {!loading && filtered.length > 0 && (
            <div style={{ marginTop: 60, padding: '40px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, color: '#F0EBE0', marginBottom: 12 }}>
                See the full intelligence behind any listing
              </div>
              <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300, color: 'rgba(240,235,224,0.55)', marginBottom: 24, lineHeight: 1.8 }}>
                Every listing above has a Property DNA report — valuation range, comparable sales, hazard exposure, and a direct buy/hold verdict.
              </p>
              <a href="https://thepropertydna.com" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '16px 32px', textDecoration: 'none', display: 'inline-block' }}>
                Run a Free Report →
              </a>
            </div>
          )}
        </div>
      </section>

      <Footer />
      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.7} }`}</style>
    </div>
  );
}
