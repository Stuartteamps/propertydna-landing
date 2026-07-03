import { useState, useEffect, useCallback } from 'react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import PricingModal from '@/components/PricingModal';
import { setPremiumStatus } from '@/lib/isPremiumUser';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { tapHaptic, isNative } from '@/lib/nativeFeatures';

interface Report {
  id: string;
  address: string;
  status: string;
  reportUrl: string | null;
  reportPdfUrl: string | null;
  createdAt: string;
  source: string;
}

type LoadStatus = 'idle' | 'loading' | 'done' | 'error';

/** Copies the public, no-login report link (/report/view/:token) to share with
 *  clients or other agents — they never need to log into your account. */
function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: copied ? '#2D9142' : '#6B6252', background: 'none', border: `1px solid ${copied ? 'rgba(45,145,66,0.5)' : 'rgba(255,255,255,0.12)'}`, padding: '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
    >
      {copied ? '✓ Copied' : '⧉ Copy Link'}
    </button>
  );
}

export default function Dashboard() {
  // iOS has no concept of user accounts. The redirect (Apple Guideline 3.1.1 +
  // 2.1(a)) is handled in an effect below and the early return happens *after*
  // every hook has run — hooks must be called unconditionally (rules-of-hooks).
  const native = isNative();

  const { user, signOut } = useAuth();
  const [loadStatus, setLoadStatus]   = useState<LoadStatus>('idle');
  const [reports, setReports]         = useState<Report[]>([]);
  const [isSubscribed, setSubscribed] = useState(false);
  const [plan, setPlan]               = useState<string | null>(null);
  const [error, setError]             = useState('');
  const [modalOpen, setModalOpen]     = useState(false);
  const [modalTab, setModalTab]       = useState<'signin' | 'pricing'>('signin');
  const [pricingOpen, setPricingOpen] = useState(false);
  const [deleteState, setDeleteState] = useState<'idle' | 'confirming' | 'deleting' | 'error'>('idle');
  const [deleteError, setDeleteError] = useState('');

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || '';
  const avatarUrl   = user?.user_metadata?.avatar_url;

  const loadReports = useCallback(async (email: string) => {
    setLoadStatus('loading');
    setError('');
    try {
      const res  = await fetch('/.netlify/functions/get-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoadStatus('error'); return; }
      setReports(data.reports || []);
      setSubscribed(data.isSubscribed || false);
      setPlan(data.plan || null);
      setLoadStatus('done');
      try {
        setPremiumStatus(data.isSubscribed || false, data.plan || null);
        sessionStorage.setItem('pdna_email', email.toLowerCase().trim());
      } catch { /* sessionStorage unavailable */ }
    } catch {
      setError('Network error. Please try again.');
      setLoadStatus('error');
    }
  }, []);

  // iOS redirect to home — Saved reports live in the Home tab via
  // SavedReportsStore. Runs as an effect so all hooks are called first.
  useEffect(() => {
    if (!native) return;
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.history.replaceState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [native]);

  // Auto-load when signed in
  useEffect(() => {
    if (native) return;
    if (user?.email && loadStatus === 'idle') loadReports(user.email);
  }, [user, loadStatus, loadReports, native]);

  // All hooks have run — safe to bail out for native (rules-of-hooks).
  if (native) return null;

  const fmt = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return iso; }
  };

  async function handleDeleteAccount() {
    tapHaptic();
    setDeleteState('deleting');
    setDeleteError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('Not signed in.');
      const res = await fetch('/.netlify/functions/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.deleted) throw new Error(data.error || 'Failed to delete account.');
      await signOut();
      window.location.href = '/?account_deleted=1';
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete account.');
      setDeleteState('error');
    }
  }

  const planLabel = (p: string | null) => {
    if (!p) return 'Pro';
    if (p.includes('enterprise') || p.includes('investor')) return 'Enterprise';
    if (p.includes('realtor') || p.includes('pro')) return 'Realtor Pro';
    if (p.includes('consumer')) return 'Consumer';
    return 'Pro';
  };

  /* ── Not signed in ──────────────────────────────────────────────── */
  if (!user) {
    return (
      <div style={{ background: '#0A0908', minHeight: '100vh', color: '#F0EBE0' }}>
        <Nav
          onSignInClick={() => { setModalTab('signin'); setModalOpen(true); }}
          onRequestAccessClick={() => setPricingOpen(true)}
        />
        <AuthModal isOpen={modalOpen} initialView={modalTab} onClose={() => setModalOpen(false)} />
      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} />
        <section style={{ padding: 'clamp(120px,14vw,180px) clamp(24px,6vw,80px) 80px', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 16 }}>Dashboard</div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px,4vw,44px)', fontWeight: 300, color: '#F0EBE0', marginBottom: 16, lineHeight: 1.1 }}>
            Sign in to view<br />your reports.
          </div>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: '#6B6252', lineHeight: 1.8, marginBottom: 32 }}>
            Your full report history and subscription status live here.
          </div>
          <button
            onClick={() => { setModalTab('signin'); setModalOpen(true); }}
            style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: '#000', background: '#C9A84C', border: 'none', padding: '16px 32px', cursor: 'pointer' }}
          >
            Sign In →
          </button>
        </section>
        <Footer />
      </div>
    );
  }

  /* ── Loading ────────────────────────────────────────────────────── */
  if (loadStatus === 'loading') {
    return (
      <div style={{ background: '#0A0908', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '1px solid rgba(201,168,76,0.3)', borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" style={{ animation: 'spin 1.2s linear infinite' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          </div>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#6B6252' }}>Loading your reports…</div>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  /* ── Signed in ──────────────────────────────────────────────────── */
  return (
    <div style={{ background: '#0A0908', minHeight: '100vh', color: '#F0EBE0' }}>
      <Nav
        onSignInClick={() => { setModalTab('signin'); setModalOpen(true); }}
        onRequestAccessClick={() => setPricingOpen(true)}
      />
      <AuthModal isOpen={modalOpen} initialView={modalTab} onClose={() => setModalOpen(false)} />
      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      <section style={{ padding: 'clamp(100px,12vw,140px) clamp(24px,6vw,80px) 80px', maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" style={{ width: 52, height: 52, borderRadius: '50%', border: '1px solid rgba(201,168,76,0.3)' }} />
            ) : (
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 300, color: '#000' }}>
                {displayName[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 6 }}>Dashboard</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(22px,3vw,34px)', fontWeight: 300, color: '#F0EBE0', lineHeight: 1.1 }}>
                {displayName ? `Welcome back, ${displayName}.` : 'Your intelligence history.'}
              </div>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', marginTop: 3 }}>{user.email}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="/" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '11px 20px', textDecoration: 'none', display: 'inline-block' }}>
              + New Report
            </a>
            <button onClick={signOut} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', background: 'none', border: '1px solid rgba(255,255,255,0.08)', padding: '11px 16px', cursor: 'pointer' }}>
              Sign Out
            </button>
            <a
              href="#delete-account"
              style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#C94C4C', background: 'none', border: '1px solid rgba(201,76,76,0.35)', padding: '11px 16px', cursor: 'pointer', textDecoration: 'none' }}
            >
              Delete Account
            </a>
          </div>
        </div>

        {/* ── Account · Delete (top-level, surfaces what's also at #delete-account below) ── */}
        <div id="delete-account-top" style={{ marginBottom: 32, padding: '20px 24px', border: '1px solid rgba(201,76,76,0.25)', background: 'rgba(201,76,76,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#C94C4C', marginBottom: 6 }}>
                Account · Privacy
              </div>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.7, maxWidth: 520 }}>
                Permanently delete your PropertyDNA account and all associated data. Available immediately in-app.
              </div>
            </div>
            <a
              href="#delete-account"
              style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: '#C94C4C', background: 'transparent', border: '1px solid rgba(201,76,76,0.45)', padding: '11px 18px', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              Delete Account →
            </a>
          </div>
        </div>

        {/* Subscription bar — hidden on iOS (Apple Guideline 3.1.1: no
            reference to paid plans in the iOS app). Web users see their
            tier; iOS users see only their report count below. */}
        {!isNative() && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 36, padding: '16px 20px', border: `1px solid ${isSubscribed ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.07)'}`, background: isSubscribed ? 'rgba(201,168,76,0.04)' : 'transparent' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: isSubscribed ? '#C9A84C' : '#6B6252' }} />
            <div>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: isSubscribed ? '#C9A84C' : '#6B6252', letterSpacing: 2, textTransform: 'uppercase' }}>
                {isSubscribed ? `${planLabel(plan)} — Active` : 'Free Account'}
              </div>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: 'rgba(240,235,224,0.3)', marginTop: 2 }}>
                {reports.length} report{reports.length !== 1 ? 's' : ''} on file
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {!isSubscribed && (
              <button onClick={() => setPricingOpen(true)} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: '#000', background: '#C9A84C', border: 'none', padding: '10px 18px', cursor: 'pointer' }}>
                Upgrade Pro →
              </button>
            )}
          </div>
        </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#C94C4C', border: '1px solid rgba(201,76,76,0.25)', background: 'rgba(201,76,76,0.05)', padding: '12px 16px', marginBottom: 24 }}>
            {error} —{' '}
            <button onClick={() => loadReports(user.email!)} style={{ color: '#C9A84C', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Jost, sans-serif', fontSize: 12 }}>
              retry
            </button>
          </div>
        )}

        {/* Reports list */}
        {loadStatus === 'done' && (
          reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 300, color: '#F0EBE0', marginBottom: 12 }}>No reports yet.</div>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: '#6B6252', lineHeight: 1.8, marginBottom: 28 }}>
                Run your first PropertyDNA report — it's free.
              </div>
              <a href="/" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }}>
                Sequence a Property →
              </a>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#6B6252', marginBottom: 12 }}>
                Recent Reports
              </div>
              {reports.map(report => (
                <div key={report.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#F0EBE0', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {report.address}
                    </div>
                    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252' }}>
                      {fmt(report.createdAt)}
                      {report.status && report.status !== 'completed' && (
                        <span style={{ marginLeft: 10, color: '#C9A84C' }}>· {report.status}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                    {report.reportUrl ? (
                      <>
                        <CopyLinkButton url={report.reportUrl} />
                        <a
                          href={report.reportUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.4)', padding: '8px 16px', textDecoration: 'none', display: 'inline-block' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.08)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          Open Report →
                        </a>
                      </>
                    ) : (
                      <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: 'rgba(107,98,82,0.5)' }}>Delivered by email</span>
                    )}
                  </div>
                </div>
              ))}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 28, marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <a href="/" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '14px 24px', textDecoration: 'none', display: 'inline-block' }}>
                  New Report →
                </a>
                {!isSubscribed && (
                  <button onClick={() => setPricingOpen(true)} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: '#F0EBE0', background: 'none', border: '1px solid rgba(255,255,255,0.15)', padding: '14px 24px', cursor: 'pointer' }}>
                    Unlimited $49/mo
                  </button>
                )}
                <button onClick={() => loadReports(user.email!)} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', background: 'none', border: 'none', cursor: 'pointer' }}>
                  ↻ Refresh
                </button>
              </div>
            </>
          )
        )}

        {/* ── #delete-account · Apple Guideline 5.1.1(v) confirmation flow ── */}
        <div id="delete-account" style={{ marginTop: 60, paddingTop: 32, borderTop: '1px solid rgba(201,76,76,0.18)' }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#C94C4C', marginBottom: 6 }}>
            Delete Account
          </div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 300, color: '#F0EBE0', marginBottom: 6 }}>
            Permanently erase your account.
          </div>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.8, marginBottom: 20, maxWidth: 560 }}>
            Deletes your sign-in identity, profile, saved reports, and subscription record from PropertyDNA. This cannot be undone — you'll need to start over with a new account.
          </div>

          {deleteState === 'idle' && (
            <button
              onClick={() => setDeleteState('confirming')}
              style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: '#fff', background: '#C94C4C', border: 'none', padding: '12px 22px', cursor: 'pointer' }}
            >
              Delete My Account
            </button>
          )}

          {deleteState === 'confirming' && (
            <div style={{ border: '1px solid rgba(201,76,76,0.4)', background: 'rgba(201,76,76,0.05)', padding: 20, maxWidth: 560 }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 300, color: '#F0EBE0', marginBottom: 8 }}>
                Are you sure?
              </div>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.7, marginBottom: 18 }}>
                This will permanently erase <strong style={{ color: '#F0EBE0' }}>{user.email}</strong> from PropertyDNA.
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={handleDeleteAccount}
                  style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: '#fff', background: '#C94C4C', border: 'none', padding: '12px 20px', cursor: 'pointer' }}
                >
                  Yes, delete permanently
                </button>
                <button
                  onClick={() => setDeleteState('idle')}
                  style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#F0EBE0', background: 'none', border: '1px solid rgba(255,255,255,0.15)', padding: '12px 20px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {deleteState === 'deleting' && (
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', letterSpacing: 2, textTransform: 'uppercase' }}>
              Deleting account…
            </div>
          )}

          {deleteState === 'error' && (
            <div style={{ border: '1px solid rgba(201,76,76,0.4)', background: 'rgba(201,76,76,0.05)', padding: 16, maxWidth: 560 }}>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#C94C4C', marginBottom: 12 }}>
                {deleteError || 'Failed to delete account. Please try again.'}
              </div>
              <button
                onClick={() => { setDeleteState('idle'); setDeleteError(''); }}
                style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#F0EBE0', background: 'none', border: '1px solid rgba(255,255,255,0.15)', padding: '10px 16px', cursor: 'pointer' }}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}
