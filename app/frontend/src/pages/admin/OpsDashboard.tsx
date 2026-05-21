import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

type Activity = {
  id: string;
  agent: string;
  event_type: string;
  status: string;
  summary: string | null;
  affected_rows: number | null;
  duration_ms: number | null;
  error_message: string | null;
  metadata: any;
  created_at: string;
};

type LeadCounts = { new: number; contacted: number; qualified: number; closed_won: number; closed_lost: number };

const STATUS_COLOR: Record<string, string> = { ok: '#34d399', warning: '#fbbf24', error: '#ef4444', skipped: '#94a3b8' };

export default function OpsDashboard() {
  const { user } = useAuth();
  const [activity, setActivity] = useState<Activity[]>([]);
  const [leadCounts, setLeadCounts] = useState<LeadCounts>({ new: 0, contacted: 0, qualified: 0, closed_won: 0, closed_lost: 0 });
  const [counts, setCounts] = useState({ aTier: 0, classified: 0, dossierReqs: 0, last24hActivity: 0 });
  const [loading, setLoading] = useState(true);

  const isOwner = user?.email === 'stuartteamps@gmail.com';

  useEffect(() => {
    if (!isOwner) return;
    (async () => {
      const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [act, reqs, aT, cls, since] = await Promise.all([
        supabase.from('ops_activity_log').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('dossier_requests').select('status', { count: 'exact' }),
        supabase.from('property_master').select('apn', { count: 'exact', head: true }).eq('pedigree_tier', 'A'),
        supabase.from('property_master').select('apn', { count: 'exact', head: true }).not('pedigree_tier', 'is', null),
        supabase.from('ops_activity_log').select('id', { count: 'exact', head: true }).gte('created_at', yesterday),
      ]);

      setActivity((act.data || []) as Activity[]);
      const reqRows = (reqs.data || []) as { status: string }[];
      setLeadCounts({
        new: reqRows.filter(r => r.status === 'new').length,
        contacted: reqRows.filter(r => r.status === 'contacted').length,
        qualified: reqRows.filter(r => r.status === 'qualified').length,
        closed_won: reqRows.filter(r => r.status === 'closed_won').length,
        closed_lost: reqRows.filter(r => r.status === 'closed_lost').length,
      });
      setCounts({
        aTier: aT.count || 0,
        classified: cls.count || 0,
        dossierReqs: reqRows.length,
        last24hActivity: since.count || 0,
      });
      setLoading(false);
    })();
  }, [isOwner]);

  if (!isOwner) {
    return <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Owner access only.</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', fontWeight: 600 }}>PropertyDNA — Ops</div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 400, margin: '4px 0 0', color: '#fafafa' }}>Operations Dashboard</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/admin/dossier-requests" style={btnLink}>Leads Inbox</Link>
            <Link to="/admin/kpis" style={btnLink}>KPIs</Link>
            <Link to="/admin/campaigns" style={btnLink}>Campaigns</Link>
            <Link to="/pedigree-index" style={btnLink}>Pedigree Index</Link>
          </div>
        </div>

        {/* Headline stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
          <StatCard label="A-tier dossiers" value={counts.aTier} accent="#fbbf24" />
          <StatCard label="Pedigree-classified" value={counts.classified.toLocaleString()} accent="#a78bfa" />
          <StatCard label="Dossier requests" value={counts.dossierReqs} accent="#60a5fa" sub={`${leadCounts.new} new`} />
          <StatCard label="Activity / 24h" value={counts.last24hActivity} accent="#34d399" />
        </div>

        {/* Lead pipeline */}
        <Section title="Lead Pipeline">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {(['new', 'contacted', 'qualified', 'closed_won', 'closed_lost'] as const).map(s => (
              <Link key={s} to={`/admin/dossier-requests`} style={{ background: '#0f172a', padding: 14, borderRadius: 4, textDecoration: 'none', color: '#e5e7eb', border: '1px solid #1f2937', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: '#fafafa' }}>{leadCounts[s]}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>{s.replace('_', ' ')}</div>
              </Link>
            ))}
          </div>
        </Section>

        {/* Activity feed */}
        <Section title="Recent Activity">
          {loading ? 'Loading…' : activity.length === 0 ? (
            <div style={{ color: '#94a3b8' }}>No activity logged yet. Agents will start writing to ops_activity_log on their next run.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activity.map(a => (
                <div key={a.id} style={{ display: 'grid', gridTemplateColumns: 'auto 100px 1fr auto', gap: 14, padding: '10px 14px', background: '#0f172a', borderRadius: 4, borderLeft: `2px solid ${STATUS_COLOR[a.status] || '#475569'}`, fontSize: 13 }}>
                  <span style={{ color: STATUS_COLOR[a.status], fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    {a.status === 'ok' ? '✓' : a.status === 'warning' ? '⚠' : a.status === 'error' ? '✗' : '○'}
                  </span>
                  <span style={{ color: '#fbbf24', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>{a.agent}</span>
                  <span style={{ color: '#e5e7eb' }}>{a.summary || a.event_type}</span>
                  <span style={{ color: '#64748b', fontSize: 11 }}>{relTime(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div style={{ marginTop: 32, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
          Daily digest sent to stuartteamps@gmail.com at 6:00 PM PT · /admin/ops always reflects live state
        </div>
      </div>
    </div>
  );
}

const btnLink: React.CSSProperties = {
  padding: '8px 14px', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase',
  border: '1px solid #334155', borderRadius: 4, color: '#cbd5e1', textDecoration: 'none', background: 'transparent',
};

function StatCard({ label, value, accent, sub }: { label: string; value: any; accent: string; sub?: string }) {
  return (
    <div style={{ background: '#111827', borderTop: `3px solid ${accent}`, padding: 18, borderRadius: 6 }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#fafafa' }}>{value}</div>
      <div style={{ fontSize: 11, color: accent, marginTop: 6, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 10, letterSpacing: 3, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>{title}</h2>
      <div style={{ background: '#111827', padding: 18, borderRadius: 6 }}>{children}</div>
    </section>
  );
}

function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
