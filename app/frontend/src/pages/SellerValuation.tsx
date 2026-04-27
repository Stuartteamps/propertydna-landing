import { useState } from 'react';
import { Link } from 'react-router-dom';
import { submitLead } from '@/lib/submitLead';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import SignInModal from '@/components/SignInModal';

const inp: React.CSSProperties = { fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300, color: '#F0EBE0', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.12)', padding: '10px 0 12px', outline: 'none', width: '100%' };
const lbl: React.CSSProperties = { fontFamily: 'Jost, sans-serif', fontSize: 9, fontWeight: 400, letterSpacing: '3px', textTransform: 'uppercase', color: '#6B6252', marginBottom: 6, display: 'block' };
const fld: React.CSSProperties = { display: 'flex', flexDirection: 'column', marginBottom: 24 };

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function SellerValuation() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', homeAddress: '', sellerTimeline: '', message: '' });
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [modalTab, setModalTab] = useState<'signin'|'signup'|'sales'>('signin');

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.includes('@')) { setError('Valid email required.'); setStatus('error'); return; }
    if (!form.homeAddress.trim()) { setError('Property address required.'); setStatus('error'); return; }
    setStatus('loading'); setError('');
    const result = await submitLead('SELLER_VALUATION', { ...form, leadSource: 'seller_valuation_form' });
    if (result.success) setStatus('success');
    else { setError(result.error); setStatus('error'); }
  };

  return (
    <div style={{ background: '#0A0908', minHeight: '100vh', color: '#F0EBE0' }}>
      <Nav onSignInClick={() => { setModalTab('signin'); setModal(true); }} onRequestAccessClick={() => { setModalTab('signup'); setModal(true); }} />
      <SignInModal isOpen={modal} initialTab={modalTab} onClose={() => setModal(false)} />

      {/* Hero */}
      <section style={{ padding: 'clamp(100px,12vw,160px) clamp(24px,6vw,80px) clamp(48px,6vw,80px)', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 'clamp(40px,6vw,100px)', alignItems: 'start' }}>

          <div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '4px', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 16 }}>Free Home Valuation</div>
            <h1 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(36px,5vw,64px)', fontWeight: 300, lineHeight: 1.05, color: '#F0EBE0', marginBottom: 20 }}>
              What is your<br /><em style={{ color: '#C9A84C' }}>home worth?</em>
            </h1>
            <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 15, fontWeight: 300, color: 'rgba(240,235,224,0.65)', lineHeight: 1.85, marginBottom: 36 }}>
              Get a professional market analysis of your Palm Springs or Coachella Valley property. No obligation. No automated estimate — a real broker reviewing real comps.
            </p>
            {[
              ['01', 'Live comparable sales analysis within 0.5 miles'],
              ['02', 'Current market absorption rate and days on market'],
              ['03', 'Recommended list price range with confidence bands'],
              ['04', 'Suggested timing based on seasonal market trends'],
            ].map(([n, t]) => (
              <div key={n} style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 11, color: '#C9A84C', minWidth: 20, marginTop: 2 }}>{n}</span>
                <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: 'rgba(240,235,224,0.55)', lineHeight: 1.65 }}>{t}</span>
              </div>
            ))}
          </div>

          {status === 'success' ? (
            <div style={{ background: '#111', border: '1px solid rgba(201,168,76,0.15)', padding: 'clamp(28px,4vw,48px)', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, border: '1px solid #C9A84C', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, color: '#F0EBE0', marginBottom: 12 }}>Request Received</h2>
              <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.8 }}>I'll review your property and reach out within one business day with a full analysis.</p>
            </div>
          ) : (
            <div style={{ background: '#111', border: '1px solid rgba(201,168,76,0.15)', padding: 'clamp(28px,4vw,48px)' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 300, color: '#F0EBE0', marginBottom: 6 }}>Request Your Valuation</div>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', marginBottom: 28, lineHeight: 1.6 }}>Delivered within one business day.</div>
              <form onSubmit={handleSubmit} noValidate>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                  <div style={fld}><label style={lbl}>First Name</label><input style={inp} value={form.firstName} onChange={set('firstName')} placeholder="Jordan" /></div>
                  <div style={fld}><label style={lbl}>Last Name</label><input style={inp} value={form.lastName} onChange={set('lastName')} placeholder="Hayes" /></div>
                </div>
                <div style={fld}><label style={lbl}>Email *</label><input style={inp} type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required /></div>
                <div style={fld}><label style={lbl}>Phone</label><input style={inp} type="tel" value={form.phone} onChange={set('phone')} placeholder="+1 (760) 555-0100" /></div>
                <div style={fld}><label style={lbl}>Property Address *</label><input style={inp} value={form.homeAddress} onChange={set('homeAddress')} placeholder="100 W Andreas Rd, Palm Springs, CA" required /></div>
                <div style={fld}>
                  <label style={lbl}>When are you thinking of selling?</label>
                  <select style={{ ...inp, backgroundImage: 'none' }} value={form.sellerTimeline} onChange={set('sellerTimeline')}>
                    <option value="">Select…</option>
                    <option value="asap">ASAP</option>
                    <option value="1-3mo">1–3 months</option>
                    <option value="3-6mo">3–6 months</option>
                    <option value="6-12mo">6–12 months</option>
                    <option value="just_curious">Just curious about value</option>
                  </select>
                </div>
                <div style={fld}><label style={lbl}>Anything I should know?</label><textarea style={{ ...inp, resize: 'none', height: 60 }} value={form.message} onChange={set('message')} placeholder="Renovations, condition, special circumstances…" /></div>
                {status === 'error' && <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#C94C4C', border: '1px solid rgba(201,76,76,0.3)', background: 'rgba(201,76,76,0.06)', padding: '10px 14px', marginBottom: 16 }}>{error}</div>}
                <button type="submit" disabled={status === 'loading'} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: status === 'loading' ? 'rgba(201,168,76,0.5)' : '#C9A84C', border: 'none', padding: 18, width: '100%', cursor: status === 'loading' ? 'not-allowed' : 'pointer' }}>
                  {status === 'loading' ? 'Sending…' : 'Get My Valuation →'}
                </button>
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', textAlign: 'center', marginTop: 12 }}>Free · No obligation · Responds within 24 hours</div>
              </form>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}
