import { useState } from 'react';
import { submitLead } from '@/lib/submitLead';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import SignInModal from '@/components/SignInModal';

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [interest, setInterest] = useState('');
  const [status, setStatus] = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [modalTab, setModalTab] = useState<'signin'|'signup'|'sales'>('signin');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) { setError('Valid email required.'); setStatus('error'); return; }
    setStatus('loading'); setError('');
    const result = await submitLead('NEWSLETTER', { firstName, email, interest, leadSource: 'newsletter_form' });
    if (result.success) setStatus('success');
    else { setError(result.error); setStatus('error'); }
  };

  const inp: React.CSSProperties = { fontFamily: 'Jost, sans-serif', fontSize: 15, fontWeight: 300, color: '#F0EBE0', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', padding: '12px 0 14px', outline: 'none', width: '100%' };

  return (
    <div style={{ background: '#0A0908', minHeight: '100vh', color: '#F0EBE0' }}>
      <Nav onSignInClick={() => { setModalTab('signin'); setModal(true); }} onRequestAccessClick={() => { setModalTab('signup'); setModal(true); }} />
      <SignInModal isOpen={modal} initialTab={modalTab} onClose={() => setModal(false)} />

      <section style={{ padding: 'clamp(100px,14vw,180px) clamp(24px,6vw,80px)', maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '4px', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 20 }}>
          Stuart Team Weekly
        </div>
        <h1 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(40px,6vw,72px)', fontWeight: 300, lineHeight: 1.05, color: '#F0EBE0', marginBottom: 20 }}>
          The market, decoded<br /><em style={{ color: '#C9A84C' }}>every week.</em>
        </h1>
        <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 15, fontWeight: 300, color: 'rgba(240,235,224,0.6)', lineHeight: 1.9, marginBottom: 56 }}>
          Palm Springs market trends. New listings worth watching. Off-market alerts. Local intelligence for buyers, sellers, and investors in the Coachella Valley — in your inbox every Sunday.
        </p>

        {status === 'success' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, border: '1px solid #C9A84C', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 300, color: '#F0EBE0', marginBottom: 12 }}>You're in.</h2>
            <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: '#6B6252' }}>First issue lands this Sunday. Check your inbox.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate style={{ maxWidth: 440, margin: '0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              <input style={inp} type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 32 }}>
              <select style={{ ...inp, backgroundImage: 'none' }} value={interest} onChange={e => setInterest(e.target.value)}>
                <option value="">I'm interested in… (optional)</option>
                <option value="buying">Buying in the Coachella Valley</option>
                <option value="selling">Selling my home</option>
                <option value="investing">Real estate investing</option>
                <option value="market_watch">Just watching the market</option>
              </select>
            </div>
            {status === 'error' && <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#C94C4C', marginBottom: 16 }}>{error}</div>}
            <button type="submit" disabled={status === 'loading'} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: status === 'loading' ? 'rgba(201,168,76,0.5)' : '#C9A84C', border: 'none', padding: '18px 40px', cursor: status === 'loading' ? 'not-allowed' : 'pointer', width: '100%' }}>
              {status === 'loading' ? 'Subscribing…' : 'Subscribe Free →'}
            </button>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', marginTop: 16 }}>One email per week. Unsubscribe anytime.</div>
          </form>
        )}

        <div style={{ marginTop: 80, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 48 }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: '#6B6252', marginBottom: 24 }}>Recent topics</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              'Palm Springs Q1 2026 — What Sold, What Didn\'t',
              'Mission Lakes vs Indian Wells: Which Community Wins for Buyers?',
              'Off-Market Season Is Starting — Here\'s How to Get In',
              'Desert Hot Springs: The Undervalued Market Nobody Is Talking About',
            ].map(title => (
              <div key={title} style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: 'rgba(240,235,224,0.45)', lineHeight: 1.6, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 16 }}>{title}</div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
