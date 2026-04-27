import { useState } from 'react';
import { submitLead } from '@/lib/submitLead';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import SignInModal from '@/components/SignInModal';

const inp: React.CSSProperties = { fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300, color: '#F0EBE0', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.12)', padding: '10px 0 12px', outline: 'none', width: '100%' };
const lbl: React.CSSProperties = { fontFamily: 'Jost, sans-serif', fontSize: 9, fontWeight: 400, letterSpacing: '3px', textTransform: 'uppercase', color: '#6B6252', marginBottom: 6, display: 'block' };
const fld: React.CSSProperties = { display: 'flex', flexDirection: 'column', marginBottom: 24 };

const perks = [
  ['MLS Access', 'Full search with price history and off-market flags'],
  ['Curated Lists', 'Homes matching your exact criteria, not an algorithm\'s guess'],
  ['Off-Market', 'Pre-market and pocket listings before they go public'],
  ['Property DNA', "Free intelligence report on any home you're serious about"],
];

export default function BuyerAccess() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', priceRange: '', bedrooms: '', buyerTimeline: '', message: '' });
  const [status, setStatus] = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [modalTab, setModalTab] = useState<'signin'|'signup'|'sales'>('signin');

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.includes('@')) { setError('Valid email required.'); setStatus('error'); return; }
    setStatus('loading'); setError('');
    const result = await submitLead('BUYER_KEYS', { ...form, interest: 'buyer_access', leadSource: 'buyer_keys_form' });
    if (result.success) setStatus('success');
    else { setError(result.error); setStatus('error'); }
  };

  return (
    <div style={{ background: '#0A0908', minHeight: '100vh', color: '#F0EBE0' }}>
      <Nav onSignInClick={() => { setModalTab('signin'); setModal(true); }} onRequestAccessClick={() => { setModalTab('signup'); setModal(true); }} />
      <SignInModal isOpen={modal} initialTab={modalTab} onClose={() => setModal(false)} />

      <section style={{ padding: 'clamp(100px,12vw,160px) clamp(24px,6vw,80px) clamp(48px,6vw,80px)', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 'clamp(40px,6vw,100px)', alignItems: 'start' }}>

          <div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '4px', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 16 }}>DM Keys · Buyer Access</div>
            <h1 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(36px,5vw,64px)', fontWeight: 300, lineHeight: 1.05, color: '#F0EBE0', marginBottom: 20 }}>
              Find your home<br /><em style={{ color: '#C9A84C' }}>before anyone else.</em>
            </h1>
            <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 15, fontWeight: 300, color: 'rgba(240,235,224,0.65)', lineHeight: 1.85, marginBottom: 40 }}>
              Get access to curated listings, off-market homes, and a dedicated buyer strategy — before the competition even knows they exist.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {perks.map(([title, desc]) => (
                <div key={title} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ width: 4, height: 4, background: '#C9A84C', flexShrink: 0, marginTop: 8 }} />
                  <div>
                    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, fontWeight: 500, color: '#F0EBE0', marginBottom: 2 }}>{title}</div>
                    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.65 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {status === 'success' ? (
            <div style={{ background: '#111', border: '1px solid rgba(201,168,76,0.15)', padding: 'clamp(28px,4vw,48px)', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, border: '1px solid #C9A84C', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, color: '#F0EBE0', marginBottom: 12 }}>Access Granted.</h2>
              <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.8 }}>Check your inbox. I'll send your curated list within the hour and reach out directly to get your search started.</p>
            </div>
          ) : (
            <div style={{ background: '#111', border: '1px solid rgba(201,168,76,0.15)', padding: 'clamp(28px,4vw,48px)' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 300, color: '#F0EBE0', marginBottom: 6 }}>Request Buyer Access</div>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', marginBottom: 28, lineHeight: 1.6 }}>Tell me what you're looking for — I'll send a curated list within the hour.</div>
              <form onSubmit={handleSubmit} noValidate>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                  <div style={fld}><label style={lbl}>First Name</label><input style={inp} value={form.firstName} onChange={set('firstName')} placeholder="Jordan" /></div>
                  <div style={fld}><label style={lbl}>Last Name</label><input style={inp} value={form.lastName} onChange={set('lastName')} placeholder="Hayes" /></div>
                </div>
                <div style={fld}><label style={lbl}>Email *</label><input style={inp} type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required /></div>
                <div style={fld}><label style={lbl}>Phone</label><input style={inp} type="tel" value={form.phone} onChange={set('phone')} placeholder="+1 (760) 555-0100" /></div>
                <div style={fld}>
                  <label style={lbl}>Price Range</label>
                  <select style={{ ...inp, backgroundImage: 'none' }} value={form.priceRange} onChange={set('priceRange')}>
                    <option value="">Select…</option>
                    <option value="under_400k">Under $400K</option>
                    <option value="400-600k">$400K – $600K</option>
                    <option value="600-900k">$600K – $900K</option>
                    <option value="900k-1.5m">$900K – $1.5M</option>
                    <option value="over_1.5m">Over $1.5M</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                  <div style={fld}>
                    <label style={lbl}>Bedrooms</label>
                    <select style={{ ...inp, backgroundImage: 'none' }} value={form.bedrooms} onChange={set('bedrooms')}>
                      <option value="">Any</option>
                      {['1','2','3','4','5+'].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div style={fld}>
                    <label style={lbl}>Timeline</label>
                    <select style={{ ...inp, backgroundImage: 'none' }} value={form.buyerTimeline} onChange={set('buyerTimeline')}>
                      <option value="">Select…</option>
                      <option value="asap">Ready now</option>
                      <option value="1-3mo">1–3 months</option>
                      <option value="3-6mo">3–6 months</option>
                      <option value="exploring">Just exploring</option>
                    </select>
                  </div>
                </div>
                <div style={fld}><label style={lbl}>Anything specific you're looking for?</label><textarea style={{ ...inp, resize: 'none', height: 60 }} value={form.message} onChange={set('message')} placeholder="Pool, golf course, guest house, specific community…" /></div>
                {status === 'error' && <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#C94C4C', border: '1px solid rgba(201,76,76,0.3)', background: 'rgba(201,76,76,0.06)', padding: '10px 14px', marginBottom: 16 }}>{error}</div>}
                <button type="submit" disabled={status === 'loading'} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: status === 'loading' ? 'rgba(201,168,76,0.5)' : '#C9A84C', border: 'none', padding: 18, width: '100%', cursor: status === 'loading' ? 'not-allowed' : 'pointer' }}>
                  {status === 'loading' ? 'Sending…' : 'Get Buyer Access →'}
                </button>
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', textAlign: 'center', marginTop: 12 }}>Respond within the hour · No pressure</div>
              </form>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}
