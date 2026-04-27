import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { submitLead } from '@/lib/submitLead';
import { getProperty } from '@/config/properties';

const inp: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300,
  color: '#F0EBE0', background: 'transparent', border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.12)',
  padding: '10px 0 12px', outline: 'none', width: '100%',
};
const lbl: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif', fontSize: 9, fontWeight: 400,
  letterSpacing: '3px', textTransform: 'uppercase', color: '#6B6252',
  marginBottom: 6, display: 'block',
};
const fld: React.CSSProperties = { display: 'flex', flexDirection: 'column', marginBottom: 24 };

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function OpenHouse() {
  const [params] = useSearchParams();
  const propertySlug = params.get('property') || '';
  const agentParam   = params.get('agent') || 'daniel';
  const property = getProperty(propertySlug);

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    workingWithAgent: '', buyerTimeline: '', interest: '', message: '',
  });
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError]   = useState('');

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.includes('@')) { setError('Valid email required.'); setStatus('error'); return; }
    setStatus('loading'); setError('');

    const result = await submitLead('OPEN_HOUSE', {
      ...form,
      propertyAddress: property ? `${property.address}, ${property.city}, ${property.state} ${property.zip}` : '',
      propertySlug,
      community: property?.community,
      agent: agentParam,
      campaign: property?.campaign || 'open_house',
      leadSource: params.get('source') === 'qr' ? 'qr_open_house' : 'web_open_house',
    });

    if (result.success) setStatus('success');
    else { setError(result.error); setStatus('error'); }
  };

  const fullAddress = property
    ? `${property.address}, ${property.community}, ${property.city}, ${property.state}`
    : 'Open House';

  if (status === 'success') return (
    <div style={{ minHeight: '100vh', background: '#0A0908', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ width: 56, height: 56, border: '1px solid #C9A84C', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 32, fontWeight: 300, color: '#F0EBE0', marginBottom: 12 }}>You're checked in.</h2>
        <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: '#6B6252', lineHeight: 1.8, marginBottom: 32 }}>
          I'll send you the property details and similar homes shortly. Welcome to {property?.community || 'the home'}.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link to="/property-dna" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '14px 24px', textDecoration: 'none', textAlign: 'center' }}>
            Get a Property DNA Report →
          </Link>
          <Link to="/off-market" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '3px', textTransform: 'uppercase', color: '#F0EBE0', border: '1px solid rgba(255,255,255,0.15)', padding: '14px 24px', textDecoration: 'none', textAlign: 'center' }}>
            See Off-Market Homes
          </Link>
          <Link to="/contact" style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '3px', textTransform: 'uppercase', color: '#6B6252', padding: '14px 24px', textDecoration: 'none', textAlign: 'center' }}>
            Request a Private Showing
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0A0908', color: '#F0EBE0' }}>
      {/* Header */}
      <header style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Link to="/" style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#F0EBE0', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, border: '1px solid #C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" stroke="#C9A84C" strokeWidth="1"/><line x1="7" y1="1" x2="7" y2="13" stroke="#C9A84C" strokeWidth="0.75"/><line x1="1" y1="7" x2="13" y2="7" stroke="#C9A84C" strokeWidth="0.75"/></svg>
          </div>
          Stuart Team · PropertyDNA
        </Link>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: '#C9A84C' }}>Open House Check-In</div>
      </header>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'clamp(32px,6vw,80px) 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', gap: 'clamp(32px,6vw,80px)', alignItems: 'start' }}>

          {/* Left — property info */}
          <div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '4px', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 16 }}>
              Welcome
            </div>
            <h1 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(28px,4vw,52px)', fontWeight: 300, lineHeight: 1.1, color: '#F0EBE0', marginBottom: 8 }}>
              {property ? property.address : 'Open House'}
            </h1>
            {property && (
              <>
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#6B6252', marginBottom: 24 }}>
                  {property.community} · {property.city}, {property.state}
                </div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 36, fontWeight: 300, color: '#C9A84C', marginBottom: 24 }}>
                  {property.price}
                </div>
                <div style={{ display: 'flex', gap: 24, marginBottom: 28 }}>
                  {[
                    ['Beds', property.beds],
                    ['Baths', property.baths],
                    ...(property.sqft ? [['Sq Ft', property.sqft]] : []),
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: '#6B6252', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: '#F0EBE0' }}>{value}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300, color: 'rgba(240,235,224,0.7)', lineHeight: 1.85, marginBottom: 32 }}>
                  {property.description}
                </p>
                {property.features && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {property.features.map(f => (
                      <div key={f} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ width: 4, height: 4, background: '#C9A84C', flexShrink: 0 }} />
                        <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: 'rgba(240,235,224,0.6)' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {!property && (
              <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: '#6B6252', lineHeight: 1.8 }}>
                Sign in to receive property details and curated listings.
              </p>
            )}
          </div>

          {/* Right — sign-in form */}
          <div style={{ background: '#111', border: '1px solid rgba(201,168,76,0.15)', padding: 'clamp(24px,4vw,48px)' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, fontWeight: 300, color: '#F0EBE0', marginBottom: 6 }}>Sign In</div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', marginBottom: 32, lineHeight: 1.6 }}>
              {property ? `Check in to ${property.address}` : "Welcome — let's get you checked in."}
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                <div style={fld}><label style={lbl}>First Name</label><input style={inp} type="text" value={form.firstName} onChange={set('firstName')} placeholder="Jordan" required /></div>
                <div style={fld}><label style={lbl}>Last Name</label><input style={inp} type="text" value={form.lastName} onChange={set('lastName')} placeholder="Hayes" required /></div>
              </div>
              <div style={fld}><label style={lbl}>Email *</label><input style={inp} type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required /></div>
              <div style={fld}><label style={lbl}>Phone</label><input style={inp} type="tel" value={form.phone} onChange={set('phone')} placeholder="+1 (760) 555-0100" /></div>
              <div style={fld}>
                <label style={lbl}>Are you working with an agent?</label>
                <select style={{ ...inp, backgroundImage: 'none' }} value={form.workingWithAgent} onChange={set('workingWithAgent')}>
                  <option value="">Select…</option>
                  <option value="no">No, not yet</option>
                  <option value="yes">Yes</option>
                  <option value="looking">Looking for one</option>
                </select>
              </div>
              <div style={fld}>
                <label style={lbl}>Buying Timeline</label>
                <select style={{ ...inp, backgroundImage: 'none' }} value={form.buyerTimeline} onChange={set('buyerTimeline')}>
                  <option value="">Select…</option>
                  <option value="asap">Ready now</option>
                  <option value="1-3mo">1–3 months</option>
                  <option value="3-6mo">3–6 months</option>
                  <option value="6-12mo">6–12 months</option>
                  <option value="exploring">Just exploring</option>
                </select>
              </div>
              <div style={fld}>
                <label style={lbl}>I'm interested in…</label>
                <select style={{ ...inp, backgroundImage: 'none' }} value={form.interest} onChange={set('interest')}>
                  <option value="">Select…</option>
                  <option value="this_home">This home specifically</option>
                  <option value="similar_homes">Similar homes in this area</option>
                  <option value="off_market">Off-market homes</option>
                  <option value="all">All of the above</option>
                </select>
              </div>
              <div style={fld}><label style={lbl}>Any questions or notes? (optional)</label><textarea style={{ ...inp, resize: 'none', height: 64 }} value={form.message} onChange={set('message')} placeholder="Tell me what you're looking for…" /></div>

              {status === 'error' && (
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#C94C4C', border: '1px solid rgba(201,76,76,0.3)', background: 'rgba(201,76,76,0.06)', padding: '10px 14px', marginBottom: 16 }}>{error}</div>
              )}

              <button type="submit" disabled={status === 'loading'} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: status === 'loading' ? 'rgba(201,168,76,0.5)' : '#C9A84C', border: 'none', padding: 18, width: '100%', cursor: status === 'loading' ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
                {status === 'loading' ? 'Checking In…' : 'Check In →'}
              </button>
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252', textAlign: 'center', marginTop: 12 }}>Your information stays private. No spam.</div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
