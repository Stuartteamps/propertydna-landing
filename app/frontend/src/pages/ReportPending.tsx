import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

type Status = 'verifying' | 'generating' | 'done' | 'error';

const N8N_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://dillabean.app.n8n.cloud/webhook/homefax/report';

async function fireReport(data: Record<string, string>, sessionId?: string) {
  return fetch(N8N_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: data.fullName || '',
      email: data.email || '',
      phone: data.phone || '',
      role: data.role || 'Buyer',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      zip: data.zip || '',
      notes: data.notes || '',
      stripeSessionId: sessionId || 'bypass',
      paid: true,
      leadSource: 'property_dna_paid',
      pageUrl: 'https://thepropertydna.com',
      timestamp: new Date().toISOString(),
    }),
  }).then(r => r.json()).catch(() => ({}));
}

export default function ReportPending() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const bypass = params.get('bypass') === '1';
  const isSub = params.get('sub') === '1';

  const [status, setStatus] = useState<Status>('verifying');
  const [errorMsg, setErrorMsg] = useState('');
  const [requestId, setRequestId] = useState('');

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
          <>
            <div style={{ width: 64, height: 64, border: '1px solid #C9A84C', borderRadius: '50%', margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, color: '#F0EBE0', marginBottom: 16 }}>
              {isSub ? 'Subscription Active.' : 'Report Initiated.'}
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: 'rgba(240,235,224,0.7)', lineHeight: 1.85, maxWidth: 480, margin: '0 auto 32px' }}>
              {isSub
                ? 'Your unlimited plan is now active. Run reports anytime — no limits, no waiting. Your dashboard is ready.'
                : <>Your PropertyDNA report is being sequenced across flood, valuation, crime, and permit data. Check your inbox — typical delivery is <strong style={{ color: '#F0EBE0' }}>2–4 minutes</strong>.</>
              }
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: 'rgba(107,98,82,0.5)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 40 }}>
              Report ID: {requestId}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <a href={isSub ? '/dashboard' : '/'} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '16px 36px', textDecoration: 'none', display: 'inline-block' }}>
                {isSub ? 'Go to Dashboard →' : 'Run Another Report →'}
              </a>
              <a href="/off-market" style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', textDecoration: 'underline' }}>
                Browse off-market listings while you wait
              </a>
            </div>
          </>
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
            <a href="/#form" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '14px 32px', textDecoration: 'none', display: 'inline-block' }}>
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
