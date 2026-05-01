import { useState } from 'react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

const TESTS = [
  { label: 'Visa (succeeds)', card: '4242 4242 4242 4242' },
  { label: 'Visa (declines)', card: '4000 0000 0000 0002' },
  { label: '3D Secure required', card: '4000 0025 0000 3155' },
];

export default function StripeTest() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<{ label: string; status: string; sessionId?: string }[]>([]);

  async function runTest(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) { setError('Enter a valid email.'); return; }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName: 'Test User', mode: 'test' }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }

      setResults(prev => [{ label: `Session created — ${email}`, status: 'opened', sessionId: data.sessionId }, ...prev]);
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }

  return (
    <div style={{ background: '#0A0908', minHeight: '100vh', color: '#F0EBE0' }}>
      <Nav />
      <section style={{ padding: 'clamp(120px,14vw,180px) clamp(24px,6vw,80px) 80px', maxWidth: 680, margin: '0 auto' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, marginBottom: 8 }}>
          Stripe $1 Test
        </div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', marginBottom: 48, letterSpacing: '1px' }}>
          INTERNAL — NOT VISIBLE TO CUSTOMERS
        </div>

        {/* Test cards reference */}
        <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', padding: '20px 24px', marginBottom: 40 }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: '2px', color: '#C9A84C', marginBottom: 16 }}>
            STRIPE TEST CARDS — USE ANY FUTURE DATE + ANY CVC
          </div>
          {TESTS.map(t => (
            <div key={t.card} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Jost, sans-serif', fontSize: 13, padding: '8px 0', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
              <span style={{ color: '#F0EBE0' }}>{t.label}</span>
              <code style={{ color: '#C9A84C', letterSpacing: '2px' }}>{t.card}</code>
            </div>
          ))}
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', marginTop: 12 }}>
            Expiry: any future date &nbsp;|&nbsp; CVC: any 3 digits &nbsp;|&nbsp; ZIP: any 5 digits
          </div>
        </div>

        {/* Env check notice */}
        <div style={{ background: 'rgba(201,76,76,0.08)', border: '1px solid rgba(201,76,76,0.2)', padding: '14px 20px', marginBottom: 40, fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#C94C4C', lineHeight: 1.7 }}>
          <strong>Before running:</strong> confirm your Netlify <code>STRIPE_SECRET_KEY</code> starts with <code>sk_test_</code> — test cards only work in test mode.
          Check: Netlify dashboard → Site → Environment Variables.
        </div>

        <form onSubmit={runTest}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: '2px', color: '#6B6252', display: 'block', marginBottom: 8 }}>
              YOUR EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.2)', color: '#F0EBE0', padding: '14px 16px', fontFamily: 'Jost, sans-serif', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {error && (
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#C94C4C', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: loading ? 'rgba(201,168,76,0.5)' : '#C9A84C', border: 'none', padding: '16px 40px', cursor: loading ? 'wait' : 'pointer', width: '100%' }}
          >
            {loading ? 'Opening Stripe…' : 'Run $1 Test Charge →'}
          </button>
        </form>

        {results.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: '2px', color: '#6B6252', marginBottom: 16 }}>
              TEST RESULTS
            </div>
            {results.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Jost, sans-serif', fontSize: 12, padding: '10px 0', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
                <span>{r.label}</span>
                <span style={{ color: r.status === 'opened' ? '#C9A84C' : '#4CAF50' }}>{r.status}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 60, fontFamily: 'Jost, sans-serif', fontSize: 11, color: 'rgba(107,98,82,0.4)', lineHeight: 2 }}>
          After completing checkout: you'll land on /report-pending → auto-redirect to /dashboard.<br />
          Verify in Stripe dashboard: Events → checkout.session.completed
        </div>
      </section>
      <Footer />
    </div>
  );
}
