/**
 * /admin/oauth — Owner UI for social OAuth status.
 *
 * Shows per-platform: connected status, account handle, expiry, whether
 * the dev-portal CLIENT_ID is set in Netlify env. One-click "Connect"
 * opens /social-oauth-start?platform=X in a new tab.
 *
 * Owner-gated by email match.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

interface Platform {
  platform: string;
  label: string;
  desc: string;
  client_env: string;
  client_id_set: boolean;
  connected: boolean;
  expired: boolean;
  account_handle?: string | null;
  account_name?: string | null;
  expires_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  connect_url: string;
  setup_doc: string;
}

const C = {
  bg: '#0A0908',
  card: '#12100D',
  border: 'rgba(255,255,255,0.08)',
  gold: '#C9A84C',
  text: '#F4F0E8',
  muted: 'rgba(244,240,232,0.55)',
  green: '#00cc77',
  red: '#ff4444',
  amber: '#ff8800',
};

const FONT_SERIF = "'Cormorant Garamond', Georgia, serif";
const FONT_SANS  = "'Jost', -apple-system, BlinkMacSystemFont, sans-serif";

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtRelative(iso?: string | null) {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  const hours = Math.round(ms / 3600000);
  if (hours < 0) return `expired ${Math.abs(hours)}h ago`;
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}

export default function AdminSocialOauth() {
  const { user } = useAuth();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [summary, setSummary] = useState<{ connected: number; total: number; client_ids_configured: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.email) { setLoading(false); return; }
    fetch(`/.netlify/functions/social-oauth-status?email=${encodeURIComponent(user.email)}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
      .then(d => {
        setPlatforms(d.platforms || []);
        setSummary(d.summary || null);
      })
      .catch(e => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }, [user?.email]);

  if (!user) {
    return (
      <div style={{ background: C.bg, color: C.text, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 36, fontWeight: 300, marginBottom: 16 }}>Sign in required</h1>
          <Link to="/" style={{ display: 'inline-block', padding: '14px 28px', background: C.gold, color: '#0F0E0D', textDecoration: 'none', fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' }}>
            Home →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: FONT_SANS }}>
      <header style={{ padding: '24px 32px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: C.text, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, border: `1px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="12" stroke={C.gold} />
              <line x1="7" y1="1" x2="7" y2="13" stroke={C.gold} strokeWidth="0.75" />
              <line x1="1" y1="7" x2="13" y2="7" stroke={C.gold} strokeWidth="0.75" />
            </svg>
          </div>
          PropertyDNA
        </Link>
        <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: C.gold }}>Admin · Social OAuth</div>
      </header>

      <div style={{ maxWidth: 1024, margin: '0 auto', padding: 'clamp(32px,5vw,72px) clamp(20px,4vw,48px)' }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: C.gold, marginBottom: 14 }}>
            Social platform connections
          </div>
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(32px,4.5vw,56px)', fontWeight: 300, lineHeight: 1.05, margin: 0, marginBottom: 12 }}>
            {summary ? `${summary.connected} of ${summary.total} platforms connected` : 'Loading…'}
          </h1>
          {summary && (
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, maxWidth: 720, margin: 0 }}>
              {summary.client_ids_configured} of {summary.total} dev-portal CLIENT_IDs are set in Netlify env. Each platform needs (1) the CLIENT_ID env var, then (2) a one-click OAuth grant — instructions in <a href="https://github.com/Stuartteamps/propertydna-landing/blob/main/tools/social-oauth/README.md" target="_blank" rel="noopener" style={{ color: C.gold, textDecoration: 'none' }}>tools/social-oauth/README.md</a>.
            </p>
          )}
        </div>

        {error && (
          <div style={{ padding: '14px 18px', background: 'rgba(255,68,68,0.1)', border: `1px solid ${C.red}`, color: C.red, marginBottom: 24, fontSize: 13 }}>
            Error loading status: {error}{error === '401' ? ' — only the owner email can view this page.' : ''}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: C.muted, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
            Loading…
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {platforms.map(p => {
              let statusColor = C.muted;
              let statusText = 'Not configured';
              if (p.connected) { statusColor = C.green; statusText = 'Connected'; }
              else if (p.expired) { statusColor = C.amber; statusText = 'Token expired'; }
              else if (p.client_id_set) { statusColor = C.amber; statusText = 'Ready to connect'; }

              return (
                <div key={p.platform} style={{ background: C.card, padding: 24, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontFamily: FONT_SERIF, fontSize: 22, fontWeight: 300, color: C.text, lineHeight: 1.1, marginBottom: 4 }}>
                        {p.label}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{p.desc}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
                      <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: statusColor }}>{statusText}</span>
                    </div>
                  </div>

                  <div style={{ padding: '10px 0', borderTop: `1px solid ${C.border}`, fontSize: 12, lineHeight: 1.8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: C.muted }}>Dev-portal CLIENT_ID env</span>
                      <span style={{ color: p.client_id_set ? C.green : C.amber }}>
                        {p.client_id_set ? `${p.client_env} ✓` : `${p.client_env} not set`}
                      </span>
                    </div>
                    {p.connected && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: C.muted }}>Account</span>
                          <span style={{ color: C.text }}>{p.account_handle || p.account_name || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: C.muted }}>Token expires</span>
                          <span style={{ color: p.expired ? C.red : C.text }}>{p.expires_at ? `${fmtRelative(p.expires_at)} · ${fmtDate(p.expires_at)}` : 'long-lived'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: C.muted }}>Connected</span>
                          <span style={{ color: C.text }}>{fmtDate(p.created_at)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                    {p.client_id_set ? (
                      <a
                        href={p.connect_url}
                        target="_blank"
                        rel="noopener"
                        style={{
                          flex: 1, textAlign: 'center', padding: '12px 18px',
                          background: p.connected ? 'transparent' : C.gold,
                          color: p.connected ? C.gold : '#0F0E0D',
                          border: p.connected ? `1px solid ${C.gold}` : 'none',
                          fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 500,
                          textDecoration: 'none',
                        }}
                      >
                        {p.connected ? 'Re-connect' : (p.expired ? 'Refresh' : 'Connect')} →
                      </a>
                    ) : (
                      <a
                        href="https://github.com/Stuartteamps/propertydna-landing/blob/main/tools/social-oauth/README.md"
                        target="_blank" rel="noopener"
                        style={{
                          flex: 1, textAlign: 'center', padding: '12px 18px',
                          background: 'transparent', color: C.muted,
                          border: `1px solid ${C.border}`,
                          fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', textDecoration: 'none',
                        }}
                      >
                        Setup steps →
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 48, padding: '20px 0', borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
          <p style={{ margin: '0 0 8px' }}>
            <strong style={{ color: C.text }}>Setup order:</strong> YouTube → Instagram/Facebook (same Meta app) → X → LinkedIn → TikTok → Reddit. Each takes 5-15 min in the dev portal once, then a 30-second OAuth grant.
          </p>
          <p style={{ margin: 0 }}>
            Once granted, <code style={{ color: C.gold }}>social-poster</code> Netlify function can cross-post to all connected platforms in a single call.
          </p>
        </div>
      </div>
    </div>
  );
}
