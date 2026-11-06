import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { track } from '@/lib/track';

type Status = 'verifying' | 'generating' | 'done' | 'error';

async function fireReport(data: Record<string, string>, sessionId?: string) {
  return fetch('/.netlify/functions/queue-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName:        data.fullName || '',
      email:           data.email || '',
      phone:           data.phone || '',
      role:            data.role || 'Buyer',
      address:         data.address || '',
      city:            data.city || '',
      state:           data.state || '',
      zip:             data.zip || '',
      notes:           data.notes || '',
      propertyType:    data.propertyType || '',
      stripeSessionId: sessionId || 'bypass',
      ref:             (() => { try { return localStorage.getItem('pdna_ref') || ''; } catch { return ''; } })(),
    }),
  }).then(r => r.json()).then(j => { try { localStorage.removeItem('pdna_ref'); } catch { /* noop */ } return j; }).catch(() => ({}));
}

function DoneAndRedirect({ requestId, isSub, navigate }: { requestId: string; isSub: boolean; navigate: (path: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => navigate('/dashboard'), 2000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <>
      <div style={{ width: 56, height: 56, border: '1px solid rgba(201,168,76,0.4)', borderRadius: '50%', margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(24px,4vw,36px)', fontWeight: 300, marginBottom: 12 }}>
        {isSub ? 'Subscription active.' : 'Report queued.'}
      </div>
      <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.8, marginBottom: 28 }}>
        {isSub
          ? 'Your subscription is now active. Redirecting to your dashboard…'
          : 'Your report is being generated. Redirecting to your dashboard…'}
      </div>
      {requestId && (
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: 'rgba(107,98,82,0.4)', letterSpacing: '1px' }}>
          Ref: {requestId}
        </div>
      )}
    </>
  );
}

export default function ReportPending() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const bypass = params.get('bypass') === '1';
  const isSub = params.get('sub') === '1';

  const [status, setStatus] = useState<Status>('verifying');
  const [errorMsg, setErrorMsg] = useState('');
  const [requestId, setRequestId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        if (bypass) {
          // ── No payment gate: fire report immediately ──────────────────
          setStatus('generating');
          const meta: Record<string, string> = {};
          params.forEach((v, k) => { meta[k] = v; });
          const result = await fireReport(meta);
          setRequestId(result.requestId || Math.random().toString(36).slice(-6).toUpperCase());
          setStatus('done');
          return;
        }

        if (!sessionId) {
          setStatus('error');
          setErrorMsg('No payment session found. Please try again.');
          return;
        }

        // ── Verify Stripe payment ─────────────────────────────────────
        setStatus('verifying');
        const verifyRes = await fetch('/.netlify/functions/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const verifyData = await verifyRes.json();

        if (!verifyData.paid) {
          setStatus('error');
          setErrorMsg('Payment not confirmed. Please contact hello@thepropertydna.com.');
          return;
        }

        // ── Conversion event: the only client-side point where revenue is
        // confirmed. Previously untracked, so GA4 could not see a single
        // dollar. Coarse, non-PII params only. ──
        track('purchase', {
          kind: verifyData.isSubscription || isSub ? 'subscription' : 'report',
          plan: verifyData.plan ?? null,
        });

        // For subscriptions, show confirmation without re-running report
        if (verifyData.isSubscription || isSub) {
          setRequestId(sessionId.slice(-8).toUpperCase());
          setStatus('done');
          return;
        }

        setStatus('generating');
        const result = await fireReport(verifyData.metadata, sessionId);
        setRequestId(result.requestId || sessionId.slice(-8).toUpperCase());
        setStatus('done');
      } catch {
        setStatus('error');
        setErrorMsg('Something went wrong sequencing your report. Email hello@thepropertydna.com with your session ID.');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ background: '#0A0908', minHeight: '100vh', color: '#F0EBE0' }}>
      <Nav />
      <section style={{ padding: 'clamp(120px,14vw,180px) clamp(24px,6vw,80px) 80px', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>

        {(status === 'verifying' || status === 'generating') && (
          <>
            <div style={{ width: 56, height: 56, border: '1px solid rgba(201,168,76,0.4)', borderRadius: '50%', margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1.2s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            </div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(24px,4vw,36px)', fontWeight: 300, marginBottom: 12 }}>
              {status === 'verifying' ? 'Confirming payment…' : 'Sequencing your report…'}
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.8 }}>
              {status === 'verifying'
                ? 'Verifying your payment. Just a moment.'
                : 'Cross-referencing 23 data sources — flood zone, valuation, crime, permits, and more.'}
            </div>
          </>
        )}

        {status === 'done' && (
          <DoneAndRedirect requestId={requestId} isSub={isSub} navigate={navigate} />
        )}

        {status === 'error' && (
          <>
            <div style={{ width: 52, height: 52, border: '1px solid #C94C4C', borderRadius: '50%', margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C94C4C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(24px,4vw,36px)', fontWeight: 300, marginBottom: 12 }}>
              Something went wrong.
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.8, marginBottom: 28 }}>
              {errorMsg}
            </div>
            {sessionId && (
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: 'rgba(107,98,82,0.4)', letterSpacing: '1px', marginBottom: 28 }}>
                Session: {sessionId}
              </div>
            )}
            <a href="/analyze" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '14px 32px', textDecoration: 'none', display: 'inline-block' }}>
              Try Again →
            </a>
          </>
        )}
      </section>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <Footer />
    </div>
  );
}
