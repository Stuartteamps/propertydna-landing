import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

interface WatchedProperty {
  id: string;
  address: string;
  city?: string; state?: string; zip?: string;
  dna_score_at_watch?: number;
  dna_score_current?: number;
  estimated_value_at_watch?: number;
  estimated_value_current?: number;
  score_delta?: number;
  value_delta?: number;
  value_pct_change?: number | null;
  label?: string;
  notes?: string;
  notify_on_score_change?: boolean;
  notify_on_value_change?: boolean;
  notify_threshold_pct?: number;
  created_at?: string;
  updated_at?: string;
}

const fmtUSD = (n?: number | null) => {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
};

const arrow = (delta?: number | null) => {
  if (delta == null || delta === 0) return '→';
  return delta > 0 ? '↑' : '↓';
};

const deltaColor = (delta?: number | null) => {
  if (delta == null || delta === 0) return '#9C9082';
  return delta > 0 ? '#00cc77' : '#ff4444';
};

export default function WatchList() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [properties, setProperties] = useState<WatchedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addAddress, setAddAddress] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.email) { setLoading(false); return; }
    fetch(`/.netlify/functions/watch-list?email=${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(d => setProperties(d.properties || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.email]);

  const addProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !addAddress.trim()) return;
    setAdding(true); setError('');
    try {
      const res = await fetch('/.netlify/functions/watch-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, address: addAddress.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to add'); return; }
      setProperties(p => [data.property, ...p]);
      setAddAddress('');
      setAddOpen(false);
    } finally { setAdding(false); }
  };

  const removeProperty = async (id: string) => {
    if (!user?.email || !confirm('Stop watching this property?')) return;
    await fetch(`/.netlify/functions/watch-list?email=${encodeURIComponent(user.email)}&id=${id}`, { method: 'DELETE' });
    setProperties(p => p.filter(x => x.id !== id));
  };

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0908', color: '#F4F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 36, fontWeight: 300, marginBottom: 16 }}>Watch List</h1>
          <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: 'rgba(244,240,232,0.6)', lineHeight: 1.7, marginBottom: 24 }}>
            Sign in to track properties you're watching. Get alerts when DNA scores or valuations move.
          </p>
          <Link to="/" style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#0F0E0D', background: '#C9A84C', padding: '14px 28px', textDecoration: 'none' }}>
            Sign in →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0908', color: '#F4F0E8' }}>
      {/* Header */}
      <header style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#F4F0E8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, border: '1px solid #C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" stroke="#C9A84C" /><line x1="7" y1="1" x2="7" y2="13" stroke="#C9A84C" strokeWidth="0.75" /><line x1="1" y1="7" x2="13" y2="7" stroke="#C9A84C" strokeWidth="0.75" /></svg>
          </div>
          PropertyDNA
        </Link>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#C9A84C' }}>Watch list</div>
      </header>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(32px,5vw,72px) clamp(20px,4vw,48px)' }}>
        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 10 }}>
              Your portfolio
            </div>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(32px,4vw,52px)', fontWeight: 300, lineHeight: 1.05, margin: 0 }}>
              {properties.length} {properties.length === 1 ? 'property' : 'properties'} watched
            </h1>
            <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: 'rgba(244,240,232,0.55)', marginTop: 12, lineHeight: 1.7, maxWidth: 540 }}>
              Track DNA score + valuation movement. Get alerts when something shifts — flood-zone changes, permits filed, comp sales, score drift.
            </p>
          </div>
          <button onClick={() => setAddOpen(true)} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: '#0F0E0D', background: '#C9A84C', border: 'none', padding: '14px 26px', cursor: 'pointer' }}>
            + Watch a property
          </button>
        </div>

        {/* Add modal */}
        {addOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }} onClick={e => { if (e.target === e.currentTarget) setAddOpen(false); }}>
            <div style={{ background: '#0F0E0D', border: '1px solid rgba(201,168,76,0.2)', padding: 32, maxWidth: 480, width: '100%' }}>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 8 }}>Add to watch list</div>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, fontWeight: 300, marginBottom: 20 }}>Which property?</h2>
              <form onSubmit={addProperty}>
                <input
                  type="text" autoFocus value={addAddress} onChange={e => setAddAddress(e.target.value)}
                  placeholder="123 Main St, Palm Springs, CA 92262"
                  style={{ width: '100%', padding: '14px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#F4F0E8', fontFamily: 'Jost, sans-serif', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }}
                />
                {error && <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#ff4444', marginBottom: 12 }}>{error}</div>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setAddOpen(false)} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#F4F0E8', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', padding: '12px 22px', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={adding || !addAddress.trim()} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#0F0E0D', background: adding ? 'rgba(201,168,76,0.5)' : '#C9A84C', border: 'none', padding: '12px 22px', cursor: adding ? 'wait' : 'pointer' }}>{adding ? 'Adding…' : 'Watch'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Property list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(244,240,232,0.4)', fontFamily: 'Jost, sans-serif', fontSize: 12, letterSpacing: 2 }}>Loading…</div>
        ) : properties.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', border: '1px dashed rgba(201,168,76,0.2)' }}>
            <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 300, color: 'rgba(244,240,232,0.6)', marginBottom: 12 }}>No properties watched yet.</p>
            <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: 'rgba(244,240,232,0.45)', lineHeight: 1.7 }}>
              Add an address you're considering. We'll track the DNA score, valuation, and risk signals — and alert you when something material shifts.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 1, background: 'rgba(255,255,255,0.06)' }}>
            {properties.map(p => (
              <div key={p.id} style={{ background: '#0A0908', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 19, color: '#F4F0E8', lineHeight: 1.2 }}>
                      {p.address}
                    </div>
                    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#9C9082', letterSpacing: 1, marginTop: 4 }}>
                      {[p.city, p.state, p.zip].filter(Boolean).join(', ')}
                    </div>
                  </div>
                  <button onClick={() => removeProperty(p.id)} title="Stop watching" style={{ background: 'transparent', border: 'none', color: '#6B6252', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '14px 0', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, color: '#6B6252', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>DNA Score</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: '#F4F0E8' }}>{p.dna_score_current ?? '—'}</span>
                      {p.score_delta != null && p.score_delta !== 0 && (
                        <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: deltaColor(p.score_delta) }}>{arrow(p.score_delta)} {Math.abs(p.score_delta)}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, color: '#6B6252', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Estimated Value</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: '#F4F0E8' }}>{fmtUSD(p.estimated_value_current)}</span>
                      {p.value_pct_change != null && p.value_pct_change !== 0 && (
                        <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: deltaColor(p.value_pct_change) }}>{arrow(p.value_pct_change)} {Math.abs(p.value_pct_change)}%</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>
                  <button onClick={() => nav(`/property-dna?address=${encodeURIComponent(p.address)}`)} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', padding: '10px', cursor: 'pointer' }}>Open report</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 48, padding: '24px 0', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: 'rgba(244,240,232,0.4)', lineHeight: 1.6, margin: 0 }}>
            Alerts fire when score changes ≥ 5 points or value moves ≥ 5%. Adjust per-property in settings.
          </p>
          <Link to="/" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#C9A84C', textDecoration: 'none' }}>
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
