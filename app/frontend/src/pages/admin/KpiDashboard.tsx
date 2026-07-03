import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';

const OWNER = 'stuartteamps@gmail.com';
const ADMIN_ALT = 'danstuart.vp.ins@gmail.com';
const INTERNAL_KEY = import.meta.env.VITE_INTERNAL_API_KEY || '';

const S = {
  page: { background: '#0A0908', minHeight: '100vh', padding: '40px clamp(16px,4vw,48px)', fontFamily: 'Jost, sans-serif', color: '#F4F0E8' },
  header: { marginBottom: 36 },
  title: { fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 400, color: '#F4F0E8', margin: '0 0 6px' },
  sub: { fontSize: 12, color: '#6B6252', letterSpacing: '0.1em', textTransform: 'uppercase' as const },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 16, marginBottom: 32 },
  kpiCard: { background: '#111', border: '1px solid rgba(184,147,85,0.15)', borderRadius: 10, padding: '20px 22px' },
  kpiVal: { fontFamily: 'Georgia, serif', fontSize: 32, color: '#B89355', lineHeight: 1, margin: 0 },
  kpiLabel: { fontSize: 10, color: '#6B6252', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginTop: 6 },
  kpiSub: { fontSize: 11, color: '#888', marginTop: 4 },
  section: { background: '#111', border: '1px solid rgba(184,147,85,0.15)', borderRadius: 10, padding: '24px 28px', marginBottom: 24 },
  sectionTitle: { fontSize: 11, color: '#6B6252', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 18 },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { padding: '8px 14px', textAlign: 'left' as const, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#6B6252', borderBottom: '1px solid rgba(107,98,82,0.25)' },
  td: { padding: '10px 14px', fontSize: 12, borderBottom: '1px solid rgba(107,98,82,0.1)', color: '#F4F0E8' },
  bar: (pct: number, color: string) => ({
    height: 6, borderRadius: 3, background: `linear-gradient(90deg,${color} ${pct}%,rgba(255,255,255,0.05) ${pct}%)`,
  }),
  badge: (color: string) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
    fontSize: 10, fontWeight: 600, background: color + '22', color,
  }),
  btn: { background: 'rgba(184,147,85,0.15)', border: '1px solid rgba(184,147,85,0.3)', borderRadius: 6, padding: '8px 16px', color: '#B89355', fontSize: 11, cursor: 'pointer', letterSpacing: '0.05em' },
};

interface Campaign {
  id: string; name: string; type: string; status: string; subject: string;
  total_contacts: number; sent_count: number; opened_count: number;
  clicked_count: number; bounced_count: number; unsubscribed_count: number;
  converted_count: number; launched_at: string | null; created_at: string;
}

function pct(num: number, den: number) {
  if (!den) return '—';
  return (num / den * 100).toFixed(1) + '%';
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function RateBar({ value, total, color }: { value: number; total: number; color: string }) {
  const p = total ? Math.min(value / total * 100, 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, ...S.bar(p, color) }} />
      <span style={{ fontSize: 11, color: '#888', width: 36, textAlign: 'right' }}>{pct(value, total)}</span>
    </div>
  );
}

export default function KpiDashboard() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const isOwner = user?.email === OWNER || user?.email === ADMIN_ALT;

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/.netlify/functions/get-campaign-stats', {
        headers: { 'x-internal-key': INTERNAL_KEY },
      });
      if (r.ok) {
        const d = await r.json();
        setCampaigns(d.campaigns || []);
        setLastRefresh(new Date());
      }
    } catch { /* noop: keep last-known campaigns on transient fetch failure */ }
    setLoading(false);
  };

  useEffect(() => { if (isOwner) load(); }, [isOwner]);

  if (!isOwner) {
    return <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#6B6252' }}>Access restricted.</p>
    </div>;
  }

  // Aggregate metrics across all campaigns (exclude test/cancelled)
  const active = campaigns.filter(c => c.status !== 'cancelled' && !c.name.includes('Debug') && !c.name.includes('Test'));
  const totalSent = active.reduce((a, c) => a + (c.sent_count || 0), 0);
  const totalOpened = active.reduce((a, c) => a + (c.opened_count || 0), 0);
  const totalClicked = active.reduce((a, c) => a + (c.clicked_count || 0), 0);
  const totalBounced = active.reduce((a, c) => a + (c.bounced_count || 0), 0);
  const totalUnsub = active.reduce((a, c) => a + (c.unsubscribed_count || 0), 0);
  const totalConverted = active.reduce((a, c) => a + (c.converted_count || 0), 0);
  const totalContacts = active.reduce((a, c) => a + (c.total_contacts || 0), 0);

  const deliveryRate = totalSent ? (totalSent - totalBounced) / totalSent * 100 : 0;
  const openRate = totalSent ? totalOpened / totalSent * 100 : 0;
  const clickRate = totalOpened ? totalClicked / totalOpened * 100 : 0;
  const bounceRate = totalSent ? totalBounced / totalSent * 100 : 0;

  // Industry benchmarks (real estate email)
  const benchmarks = {
    open: 22.6,
    click: 3.4,
    bounce: 1.8,
    unsub: 0.1,
  };

  const skipTracedCampaigns = active.filter(c => c.name.includes('Skip-Traced'));
  const skipSent = skipTracedCampaigns.reduce((a, c) => a + (c.sent_count || 0), 0);

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Campaign KPIs</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={S.sub}>PropertyDNA Marketing Intelligence</span>
          {lastRefresh && <span style={{ fontSize: 10, color: '#6B6252' }}>Updated {lastRefresh.toLocaleTimeString()}</span>}
          <button style={S.btn} onClick={load}>↻ Refresh</button>
          <a href="/admin/campaigns" style={{ ...S.btn, textDecoration: 'none' }}>Campaigns →</a>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#6B6252', fontSize: 13 }}>Loading...</p>
      ) : (
        <>
          {/* Top KPI tiles */}
          <div style={S.grid}>
            <div style={S.kpiCard}>
              <div style={S.kpiVal}>{totalSent.toLocaleString()}</div>
              <div style={S.kpiLabel}>Total Emails Sent</div>
              <div style={S.kpiSub}>{totalContacts.toLocaleString()} contacts total</div>
            </div>
            <div style={S.kpiCard}>
              <div style={{ ...S.kpiVal, color: deliveryRate > 95 ? '#22c55e' : deliveryRate > 90 ? '#B89355' : '#ef4444' }}>
                {deliveryRate.toFixed(1)}%
              </div>
              <div style={S.kpiLabel}>Delivery Rate</div>
              <div style={S.kpiSub}>{totalBounced.toLocaleString()} bounced</div>
            </div>
            <div style={S.kpiCard}>
              <div style={{ ...S.kpiVal, color: openRate >= benchmarks.open ? '#22c55e' : '#B89355' }}>
                {openRate.toFixed(1)}%
              </div>
              <div style={S.kpiLabel}>Open Rate</div>
              <div style={S.kpiSub}>Benchmark: {benchmarks.open}%</div>
            </div>
            <div style={S.kpiCard}>
              <div style={{ ...S.kpiVal, color: clickRate >= benchmarks.click ? '#22c55e' : '#B89355' }}>
                {clickRate.toFixed(1)}%
              </div>
              <div style={S.kpiLabel}>Click Rate</div>
              <div style={S.kpiSub}>of opens · Benchmark: {benchmarks.click}%</div>
            </div>
            <div style={S.kpiCard}>
              <div style={{ ...S.kpiVal, color: bounceRate < benchmarks.bounce ? '#22c55e' : bounceRate < 5 ? '#B89355' : '#ef4444' }}>
                {bounceRate.toFixed(1)}%
              </div>
              <div style={S.kpiLabel}>Bounce Rate</div>
              <div style={S.kpiSub}>Benchmark: &lt;{benchmarks.bounce}%</div>
            </div>
            <div style={S.kpiCard}>
              <div style={{ ...S.kpiVal, color: totalUnsub === 0 ? '#22c55e' : '#B89355' }}>
                {totalUnsub}
              </div>
              <div style={S.kpiLabel}>Unsubscribes</div>
              <div style={S.kpiSub}>{pct(totalUnsub, totalSent)} rate</div>
            </div>
            <div style={S.kpiCard}>
              <div style={{ ...S.kpiVal, color: totalConverted > 0 ? '#22c55e' : '#6B6252' }}>
                {totalConverted}
              </div>
              <div style={S.kpiLabel}>Paid Conversions</div>
              <div style={S.kpiSub}>{pct(totalConverted, totalSent)} conversion</div>
            </div>
            <div style={S.kpiCard}>
              <div style={{ ...S.kpiVal, color: '#B89355' }}>{skipSent.toLocaleString()}</div>
              <div style={S.kpiLabel}>Skip-Traced Sent</div>
              <div style={S.kpiSub}>New wave — May 2026</div>
            </div>
          </div>

          {/* Funnel visualization */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Email Funnel</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480 }}>
              {[
                { label: 'Sent', val: totalSent, color: '#3b82f6', pctOf: totalContacts },
                { label: 'Delivered', val: totalSent - totalBounced, color: '#6366f1', pctOf: totalSent },
                { label: 'Opened', val: totalOpened, color: '#B89355', pctOf: totalSent - totalBounced },
                { label: 'Clicked', val: totalClicked, color: '#22c55e', pctOf: totalOpened },
                { label: 'Converted (Paid)', val: totalConverted, color: '#f59e0b', pctOf: totalClicked },
              ].map(({ label, val, color, pctOf }) => (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 60px', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: '#ccc' }}>{label}</span>
                  <RateBar value={val} total={pctOf} color={color} />
                  <span style={{ fontSize: 12, color: '#F4F0E8', textAlign: 'right', fontFamily: 'Georgia,serif' }}>{val.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Campaign-by-campaign table */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Campaign Performance ({active.length} campaigns)</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Campaign', 'Sent', 'Opened', 'Clicked', 'Bounced', 'Open%', 'Click%', 'Bounce%', 'Date', 'Status'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {active.map(c => {
                    const oRate = c.sent_count ? c.opened_count / c.sent_count * 100 : 0;
                    const cRate = c.opened_count ? c.clicked_count / c.opened_count * 100 : 0;
                    const bRate = c.sent_count ? c.bounced_count / c.sent_count * 100 : 0;
                    const isSkipTraced = c.name.includes('Skip-Traced');
                    return (
                      <tr key={c.id} style={{ background: isSkipTraced ? 'rgba(184,147,85,0.04)' : 'transparent' }}>
                        <td style={{ ...S.td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <a href={`/admin/campaigns`} style={{ color: '#F4F0E8', textDecoration: 'none' }}>{c.name}</a>
                          {isSkipTraced && <span style={{ ...S.badge('#B89355'), marginLeft: 6, fontSize: 8 }}>NEW</span>}
                        </td>
                        <td style={S.td}>{(c.sent_count || 0).toLocaleString()}</td>
                        <td style={S.td}>{(c.opened_count || 0).toLocaleString()}</td>
                        <td style={S.td}>{(c.clicked_count || 0).toLocaleString()}</td>
                        <td style={S.td}>{(c.bounced_count || 0).toLocaleString()}</td>
                        <td style={{ ...S.td, color: oRate >= benchmarks.open ? '#22c55e' : oRate > 0 ? '#B89355' : '#555' }}>{oRate.toFixed(1)}%</td>
                        <td style={{ ...S.td, color: cRate >= benchmarks.click ? '#22c55e' : cRate > 0 ? '#B89355' : '#555' }}>{cRate.toFixed(1)}%</td>
                        <td style={{ ...S.td, color: bRate > 5 ? '#ef4444' : bRate > 2 ? '#B89355' : '#22c55e' }}>{bRate.toFixed(1)}%</td>
                        <td style={{ ...S.td, color: '#6B6252' }}>{fmtDate(c.launched_at || c.created_at)}</td>
                        <td style={S.td}>
                          <span style={S.badge(
                            c.status === 'complete' ? '#22c55e' :
                            c.status === 'sending' ? '#B89355' :
                            c.status === 'draft' ? '#3b82f6' : '#6B6252'
                          )}>{c.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 10-Touch Workflow */}
          <div style={S.section}>
            <div style={S.sectionTitle}>10-Touch Monthly Workflow</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
              {[
                { day: 'Day 1',   step: 0, label: 'Initial Blast', channel: 'Resend', desc: '"Your [City] Property Ranked X/100"', status: 'live' },
                { day: 'Day 1',   step: 1, label: 'Click Auto-Reply', channel: 'Resend', desc: 'Instant — "Your report is ready"', status: 'live' },
                { day: 'Day 2',   step: 2, label: 'Opener Follow-Up', channel: 'Resend', desc: '24h — market context', status: 'live' },
                { day: 'Day 7',   step: 3, label: '7-Day Cold Re-Engage', channel: 'Resend', desc: '"Last look — market moving"', status: 'live' },
                { day: 'Day 10',  step: 4, label: 'Market Insight', channel: 'Resend', desc: '"What\'s moving values in [City]"', status: 'live' },
                { day: 'Day 14',  step: 5, label: 'Social Proof', channel: 'Resend', desc: '"What a homeowner discovered"', status: 'live' },
                { day: 'Day 17',  step: 6, label: 'Value Unlock', channel: 'Resend', desc: '"3 things that move the needle"', status: 'live' },
                { day: 'Day 21',  step: 7, label: 'Personal Note', channel: 'Resend', desc: 'Dan personal email', status: 'live' },
                { day: 'Day 28',  step: 8, label: 'Final + Referral', channel: 'Resend', desc: '"Last message + share ask"', status: 'live' },
                { day: 'Weekly',  step: '-', label: 'CC Newsletter', channel: 'Constant Contact', desc: 'Market intelligence weekly', status: 'pending-token' },
              ].map((t, i) => (
                <div key={i} style={{ background: '#0F0F0F', border: '1px solid rgba(107,98,82,0.2)', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontSize: 10, color: '#6B6252', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.day} · Step {t.step}</div>
                    <span style={S.badge(t.status === 'live' ? '#22c55e' : '#B89355')}>
                      {t.status === 'live' ? '● live' : '○ pending'}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#F4F0E8', fontWeight: 500, marginBottom: 4 }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{t.desc}</div>
                  <div style={{ fontSize: 10, color: '#6B6252', marginTop: 6 }}>via {t.channel}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Platform status */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Platform Status</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
              {[
                { label: 'Resend (Email Engine)', status: 'live', detail: 'Sending + webhooks active' },
                { label: 'Drip Sequence (Cron)', status: 'live', detail: 'Steps 2–8 · runs hourly' },
                { label: 'Campaign Webhook', status: 'live', detail: 'Open/click/bounce tracking' },
                { label: 'Constant Contact', status: 'pending', detail: 'Need correct OAuth secret' },
                { label: 'CC Newsletter (n8n)', status: 'pending', detail: 'Workflow ready, no token' },
                { label: 'SMS Outreach', status: 'planned', detail: '830 phone-only contacts waiting' },
              ].map((p, i) => (
                <div key={i} style={{ background: '#0F0F0F', border: '1px solid rgba(107,98,82,0.15)', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#F4F0E8' }}>{p.label}</span>
                    <span style={S.badge(p.status === 'live' ? '#22c55e' : p.status === 'pending' ? '#B89355' : '#6B6252')}>
                      {p.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#6B6252' }}>{p.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
