import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

type Req = {
  id: string;
  apn?: string | null;
  source_page: string;
  property_address?: string | null;
  full_name?: string | null;
  email: string;
  phone?: string | null;
  role?: string | null;
  message?: string | null;
  pedigree_tier?: string | null;
  utm_source?: string | null;
  status: string;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  new: '#fbbf24', contacted: '#60a5fa', qualified: '#a78bfa', closed_won: '#34d399', closed_lost: '#94a3b8',
};

export default function DossierRequestsAdmin() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    (async () => {
      let q = supabase.from('dossier_requests').select('*').order('created_at', { ascending: false }).limit(200);
      if (filter) q = q.eq('status', filter);
      const { data } = await q;
      setRows((data || []) as Req[]);
      setLoading(false);
    })();
  }, [filter]);

  async function updateStatus(id: string, status: string) {
    await supabase.from('dossier_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    setRows(rows.map(r => r.id === id ? { ...r, status } : r));
  }

  // Gate to owner only
  const isOwner = user?.email === 'stuartteamps@gmail.com';
  if (!isOwner) {
    return <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Owner access only. <Link to="/" style={{ color: '#fbbf24', marginLeft: 8 }}>Home</Link></div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 400, color: '#fafafa', marginBottom: 8 }}>Dossier Requests</h1>
        <p style={{ color: '#94a3b8', marginBottom: 24 }}>Inbound luxury dossier leads from /dossier/:apn and /luxury-inventory.</p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {['', 'new', 'contacted', 'qualified', 'closed_won', 'closed_lost'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
              border: '1px solid', borderColor: filter === s ? '#fbbf24' : '#334155',
              background: filter === s ? '#fbbf24' : 'transparent',
              color: filter === s ? '#0a0a0a' : '#cbd5e1',
              borderRadius: 4, cursor: 'pointer', textTransform: 'uppercase',
            }}>{s || 'all'}</button>
          ))}
        </div>

        {loading ? 'Loading…' : rows.length === 0 ? (
          <div style={{ background: '#111827', padding: 32, borderRadius: 6, color: '#94a3b8' }}>
            No requests yet. They'll appear here when leads submit the dossier modal on /dossier/:apn or /luxury-inventory.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rows.map(r => (
              <div key={r.id} style={{ background: '#111827', borderRadius: 6, padding: 20, borderLeft: `3px solid ${STATUS_COLORS[r.status] || '#475569'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#fafafa' }}>
                      {r.full_name || r.email}
                      {r.pedigree_tier && <span style={{ marginLeft: 12, fontSize: 11, color: '#fbbf24', letterSpacing: 1 }}>{r.pedigree_tier}-TIER</span>}
                    </div>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                      <a href={`mailto:${r.email}`} style={{ color: '#fbbf24' }}>{r.email}</a>
                      {r.phone && <> · <a href={`tel:${r.phone}`} style={{ color: '#cbd5e1' }}>{r.phone}</a></>}
                      {r.role && <> · {r.role}</>}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{new Date(r.created_at).toLocaleString()}</div>
                </div>

                {r.property_address && (
                  <div style={{ marginTop: 8, fontSize: 13, color: '#cbd5e1' }}>
                    <strong>Property:</strong> {r.apn ? <Link to={`/dossier/${r.apn}`} style={{ color: '#fbbf24' }}>{r.property_address}</Link> : r.property_address}
                  </div>
                )}
                {r.message && (
                  <div style={{ marginTop: 10, padding: 12, background: '#0f172a', borderRadius: 4, fontSize: 13, color: '#cbd5e1', fontStyle: 'italic' }}>
                    "{r.message}"
                  </div>
                )}

                <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['contacted', 'qualified', 'closed_won', 'closed_lost'].map(s => (
                    <button key={s} onClick={() => updateStatus(r.id, s)} disabled={r.status === s} style={{
                      padding: '4px 10px', fontSize: 11, fontWeight: 600,
                      border: '1px solid #334155', borderRadius: 3, cursor: r.status === s ? 'default' : 'pointer',
                      background: r.status === s ? STATUS_COLORS[s] : 'transparent',
                      color: r.status === s ? '#0a0a0a' : '#94a3b8',
                      opacity: r.status === s ? 1 : 0.85, textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>{s.replace('_', ' ')}</button>
                  ))}
                  <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto', alignSelf: 'center' }}>
                    {r.source_page} {r.utm_source ? `· ${r.utm_source}` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
