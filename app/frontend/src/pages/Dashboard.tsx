import { useState } from 'react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { setPremiumStatus } from '@/lib/isPremiumUser';

interface Report {
  id: string;
  address: string;
  createdAt: string;
  reportUrl: string | null;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

const inp: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300, color: '#F0EBE0',
  background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.12)',
  padding: '10px 0 12px', outline: 'none', width: '100%',
};
const lbl: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif', fontSize: 9, fontWeight: 400, letterSpacing: '3px',
  textTransform: 'uppercase', color: '#6B6252', marginBottom: 6, display: 'block',
};

export default function Dashboard() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [reports, setReports] = useState<Report[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) { setError('Please enter a valid email address.'); return; }
    setStatus('loading');
    setError('');

    try {
      const res = await fetch('/.netlify/functions/get-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setStatus('error'); return; }
      setReports(data.reports || []);
      setIsSubscribed(data.isSubscribed || false);
      setPlan(data.plan || null);
      setStatus('done');
      // Store email and subscription tier for premium gating across pages
      try {
        sessionStorage.setItem('pdna_email', email.toLowerCase().trim());
        setPremiumStatus(data.isSubscribed || false, data.plan || null);
      } catch {}
    } catch {
      setError('Network error. Please try again.');
      setStatus('error');
    }
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return iso; }
  };

  return (
    <div style={{ background: '#0A0908', minHeight: '100vh', color: '#F0EBE0' }}>
      <Nav />
      <section style={{ padding: 'clamp(100px,12vw,140px) clamp(24px,6vw,80px) 80px', maxWidth: 860, margin: '0 auto' }}>

        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '4px', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 16 }}>
            Report Dashboard
          </div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(32px,5vw,56px)', fontWeight: 300, lineHeight: 1.05, color: '#F0EBE0', marginBottom: 16 }}>
            Your property<br /><em style={{ color: '#C9A84C' }}>intelligence history.</em>
          </h1>
          <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300, color: 'rgba(240,235,224,0.6)', lineHeight: 1.8, maxWidth: 480 }}>
            Enter your email to view all reports you've run and re-open any past analysis.
          </p>
        </div>

        {/* Email lookup form */}
        {status !== 'done' && (
          <div style={{ background: '#111', border: '1px solid rgba(201,168,76,0.15)', padding: 'clamp(28px,4vw,44px)', maxWidth: 480, marginBottom: 40 }}>
            <form onSubmit={handleLookup} noValidate>
              <div style={{ marginBottom: 24 }}>
                <label style={lbl}>Your Email Address</label>
                <input
                  style={inp} type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required
                />
              </div>
              {error && (
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#C94C4C', border: '1px solid rgba(201,76,76,0.3)', background: 'rgba(201,76,76,0.06)', padding: '10px 14px', marginBottom: 16 }}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={status === 'loading'} style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px',
                textTransform: 'uppercase', color: '#000',
                background: status === 'loading' ? 'rgba(201,168,76,0.5)' : '#C9A84C',
                border: 'none', padding: 16, width: '100%',
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
              }}>
                {status === 'loading' ? 'Looking up…' : 'View My Reports →'}
              </button>
            </form>
          </div>
        )}

        {/* Results */}
        {status === 'done' && (
          <>
            {/* Subscription status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 32, padding: '16px 20px', border: `1px solid ${isSubscribed ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.08)'}`, background: isSubscribed ? 'rgba(201,168,76,0.05)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSubscribed ? '#C9A84C' : '#6B6252' }} />
                <div>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: isSubscribed ? '#C9A84C' : '#6B6252', letterSpacing: '2px', textTransform: 'uppercase' }}>
                    {isSubscribed
                    ? `${plan === 'enterprise' ? 'Enterprise' : plan === 'monthly' ? 'Pro' : 'Unlimited'} Plan — Active`
                    : 'No Active Subscription'}
                  </div>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: 'rgba(240,235,224,0.5)', marginTop: 2 }}>
                    {email}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {!isSubscribed && (
                  <a href="/#pricing" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '10px 20px', textDecoration: 'none', display: 'inline-block' }}>
                    Upgrade Pro → $49/mo
                  </a>
                )}
                {isSubscribed && plan === 'monthly' && (
                  <a href="/#pricing" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: '#F0EBE0', border: '1px solid rgba(255,255,255,0.15)', padding: '10px 20px', textDecoration: 'none', display: 'inline-block' }}>
                    Enterprise →
                  </a>
                )}
                <button
                  onClick={() => { setStatus('idle'); setReports([]); setEmail(''); }}
                  style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: '#6B6252', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '1px' }}
                >
                  Switch email
                </button>
              </div>
            </div>

            {/* Reports list */}
            {reports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, color: '#F0EBE0', marginBottom: 12 }}>No reports yet.</div>
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.8, marginBottom: 28 }}>Run your first PropertyDNA report — it's free.</div>
                <a href="/#form" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }}>
                  Sequence a Property →
                </a>
              </div>
            ) : (
              <div>
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: '#6B6252', marginBottom: 16 }}>
                  {reports.length} report{reports.length !== 1 ? 's' : ''} found
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {reports.map((report) => {
                    const canOpen = isSubscribed && report.reportUrl;
                    return (
                      <div key={report.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, fontWeight: 400, color: '#F0EBE0', marginBottom: 4 }}>
                            {report.address}
                          </div>
                          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252' }}>
                            {formatDate(report.createdAt)}
                          </div>
                        </div>
                        <div>
                          {canOpen ? (
                            <a
                              href={report.reportUrl!}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.4)', padding: '8px 16px', textDecoration: 'none', display: 'inline-block' }}
                            >
                              Open Report →
                            </a>
                          ) : !isSubscribed ? (
                            <a
                              href="/#pricing"
                              style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: '#6B6252', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 16px', textDecoration: 'none', display: 'inline-block' }}
                            >
                              Subscribe to Open
                            </a>
                          ) : (
                            <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: 'rgba(107,98,82,0.5)' }}>
                              Delivered by email
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 28, marginTop: 8, display: 'flex', gap: 16 }}>
                    <a href="/#form" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '14px 24px', textDecoration: 'none', display: 'inline-block' }}>
                      New Report →
                    </a>
                    {!isSubscribed && (
                      <a href="/#pricing" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#F0EBE0', border: '1px solid rgba(255,255,255,0.15)', padding: '14px 24px', textDecoration: 'none', display: 'inline-block' }}>
                        Unlimited $49/mo
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
      <Footer />
    </div>
  );
}
