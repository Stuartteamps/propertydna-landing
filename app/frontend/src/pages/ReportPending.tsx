import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

type Status = 'verifying' | 'generating' | 'done' | 'error';

export default function ReportPending() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [status, setStatus] = useState<Status>('verifying');
  const [errorMsg, setErrorMsg] = useState('');
  const [requestId, setRequestId] = useState('');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setErrorMsg('No payment session found. Please try again.');
      return;
    }

    (async () => {
      try {
        // 1. Verify payment with Stripe
        const verifyRes = await fetch('/.netlify/functions/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const verifyData = await verifyRes.json();

        if (!verifyData.paid) {
          setStatus('error');
          setErrorMsg('Payment not confirmed. Please contact support.');
          return;
        }

        setStatus('generating');
        const { metadata, customer_email } = verifyData;

        // 2. Fire n8n report workflow
        const n8nRes = await fetch(
          import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://dillabean.app.n8n.cloud/webhook/homefax/report',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: metadata.fullName,
              email: customer_email || metadata.email,
              phone: metadata.phone,
              role: metadata.role,
              address: metadata.address,
              city: metadata.city,
              state: metadata.state,
              zip: metadata.zip,
              notes: metadata.notes,
              stripeSessionId: sessionId,
              paid: true,
              leadSource: 'property_dna_paid',
              pageUrl: 'https://thepropertydna.com',
              timestamp: new Date().toISOString(),
            }),
          }
        );

        const n8nData = await n8nRes.json().catch(() => ({}));
        setRequestId(n8nData.requestId || sessionId.slice(-8).toUpperCase());
        setStatus('done');
      } catch (err) {
        setStatus('error');
        setErrorMsg('Something went wrong. Please email hello@thepropertydna.com with your session ID.');
      }
    })();
  }, [sessionId]);

  return (
    <div style={{ background: '#0A0908', minHeight: '100vh', color: '#F0EBE0' }}>
      <Nav />
      <section style={{ padding: 'clamp(120px,14vw,180px) clamp(24px,6vw,80px) 80px', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>

        {status === 'verifying' && (
          <>
            <div style={{ width: 52, height: 52, border: '1px solid rgba(201,168,76,0.4)', borderRadius: '50%', margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1.2s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(24px,4vw,36px)', fontWeight: 300, marginBottom: 12 }}>Confirming payment…</div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.8 }}>Verifying your Stripe session. This takes a moment.</div>
          </>
        )}

        {status === 'generating' && (
          <>
            <div style={{ width: 52, height: 52, border: '1px solid rgba(201,168,76,0.4)', borderRadius: '50%', margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1.2s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(24px,4vw,36px)', fontWeight: 300, marginBottom: 12 }}>Sequencing your report…</div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.8 }}>Payment confirmed. Your PropertyDNA report is being assembled across 23 data sources.</div>
          </>
        )}

        {status === 'done' && (
          <>
            <div style={{ width: 64, height: 64, border: '1px solid #C9A84C', borderRadius: '50%', margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, color: '#F0EBE0', marginBottom: 12 }}>Report Initiated.</div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: 'rgba(240,235,224,0.7)', lineHeight: 1.85, marginBottom: 32 }}>
              Your PropertyDNA report is being sequenced across flood, crime, valuation, and permit data. Check your inbox — typical delivery is <strong style={{ color: '#F0EBE0' }}>2–4 minutes</strong>.
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: 'rgba(107,98,82,0.5)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 40 }}>
              Report ID: {requestId}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <a href="/" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '14px 32px', textDecoration: 'none', display: 'inline-block' }}>
                Run Another Report →
              </a>
              <a href="/off-market" style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', textDecoration: 'underline' }}>
                See off-market listings while you wait
              </a>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ width: 52, height: 52, border: '1px solid #C94C4C', borderRadius: '50%', margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C94C4C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(24px,4vw,36px)', fontWeight: 300, marginBottom: 12 }}>Something went wrong.</div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.8, marginBottom: 28 }}>{errorMsg}</div>
            {sessionId && (
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: 'rgba(107,98,82,0.5)', letterSpacing: '1px', marginBottom: 28 }}>
                Session: {sessionId}
              </div>
            )}
            <a href="/#form" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '14px 32px', textDecoration: 'none', display: 'inline-block' }}>
              Try Again →
            </a>
          </>
        )}
      </section>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <Footer />
    </div>
  );
}
