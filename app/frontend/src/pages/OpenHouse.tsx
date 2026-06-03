import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { submitLead } from '@/lib/submitLead';
import { getProperty, PropertyConfig } from '@/config/properties';

// ── Styles (shared) ──────────────────────────────────────────────────────────
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
const kicker: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '4px',
  textTransform: 'uppercase', color: '#C9A84C', marginBottom: 16,
};

type Status = 'idle' | 'loading' | 'success' | 'error';

interface OffMarketMatch {
  address?: string;
  city?: string; state?: string; zip?: string;
  beds?: number | string; baths?: number | string; sqft?: number | string;
  yearBuilt?: number;
  lastSaleDate?: string; lastSalePrice?: number;
  estimatedValue?: number;
  distanceMi?: number | null;
  dossierUrl?: string;
}

// ── Welcome page (post-sign-in) ──────────────────────────────────────────────
function WelcomePage({ property, matches, firstName }: {
  property: PropertyConfig;
  matches: OffMarketMatch[];
  firstName: string;
}) {
  const heroImage = property.images?.[0];
  const galleryImages = (property.images || []).slice(1, 5);

  return (
    <div style={{ minHeight: '100vh', background: '#0A0908', color: '#F0EBE0' }}>
      {/* Header */}
      <header style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, background: 'rgba(10,9,8,0.95)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
        <Link to="/" style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#F0EBE0', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, border: '1px solid #C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" stroke="#C9A84C" strokeWidth="1" /><line x1="7" y1="1" x2="7" y2="13" stroke="#C9A84C" strokeWidth="0.75" /><line x1="1" y1="7" x2="13" y2="7" stroke="#C9A84C" strokeWidth="0.75" /></svg>
          </div>
          PropertyDNA
        </Link>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: '#C9A84C' }}>Private Welcome</div>
      </header>

      {/* Hero */}
      <section style={{ position: 'relative', minHeight: 'min(72vh, 720px)', background: heroImage ? `linear-gradient(180deg, rgba(10,9,8,0.35) 0%, rgba(10,9,8,0.85) 100%), url(${heroImage}) center/cover no-repeat` : '#1a1614', display: 'flex', alignItems: 'flex-end', padding: 'clamp(40px,8vw,80px) clamp(24px,5vw,80px)' }}>
        <div style={{ maxWidth: 920 }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '4px', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 14 }}>
            Welcome{firstName ? `, ${firstName}` : ''} · You're checked in
          </div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(32px,5.5vw,68px)', fontWeight: 300, lineHeight: 1.05, color: '#F0EBE0', marginBottom: 12 }}>
            {property.address}
          </h1>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: '#9C9082', marginBottom: 18, letterSpacing: '1px' }}>
            {property.community} · {property.city}, {property.state} {property.zip}
            {property.mlsNumber ? ` · MLS# ${property.mlsNumber}` : ''}
          </div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px,3.5vw,44px)', fontWeight: 300, color: '#C9A84C', marginBottom: 8 }}>
            {property.price}
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 12 }}>
            {[
              ['Beds', property.beds],
              ['Baths', property.baths],
              ...(property.sqft ? [['Sq Ft', property.sqft]] : []),
              ...(property.lotSize ? [['Lot', property.lotSize]] : []),
              ...(property.yearBuilt ? [['Built', property.yearBuilt]] : []),
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: '#9C9082', marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: '#F0EBE0' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Marketing remarks + features */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(48px,7vw,96px) clamp(24px,5vw,48px)', display: 'grid', gridTemplateColumns: 'minmax(0,2.2fr) minmax(0,1fr)', gap: 'clamp(32px,5vw,72px)' }}>
        <div>
          <div style={kicker}>About this home</div>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(18px,2vw,22px)', fontWeight: 300, lineHeight: 1.65, color: 'rgba(240,235,224,0.85)', marginBottom: 28 }}>
            {property.marketingRemarks || property.description}
          </p>
        </div>
        {property.features && property.features.length > 0 && (
          <div>
            <div style={kicker}>Highlights</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {property.features.map(f => (
                <div key={f} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 4, height: 4, background: '#C9A84C', flexShrink: 0, marginTop: 9 }} />
                  <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: 'rgba(240,235,224,0.78)', lineHeight: 1.6 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Gallery — only renders if images provided */}
      {galleryImages.length > 0 && (
        <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 clamp(24px,5vw,48px) clamp(48px,7vw,80px)' }}>
          <div style={kicker}>Gallery</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {galleryImages.map((src, i) => (
              <div key={src} style={{ aspectRatio: '4/3', background: `#1a1614 url(${src}) center/cover no-repeat`, border: '1px solid rgba(201,168,76,0.08)' }} role="img" aria-label={`${property.address} photo ${i + 2}`} />
            ))}
          </div>
        </section>
      )}

      {/* Off-market matches */}
      <section style={{ background: 'linear-gradient(180deg, #0A0908 0%, #12100D 100%)', borderTop: '1px solid rgba(201,168,76,0.12)', borderBottom: '1px solid rgba(201,168,76,0.12)', padding: 'clamp(48px,7vw,96px) 0' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 clamp(24px,5vw,48px)' }}>
          <div style={kicker}>Off-Market Opportunities Nearby</div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(26px,3vw,40px)', fontWeight: 300, color: '#F0EBE0', marginBottom: 12, lineHeight: 1.15 }}>
            {matches && matches.length > 0
              ? `${matches.length} long-tenured ${matches.length === 1 ? 'owner' : 'owners'} in the same enclave that match your profile.`
              : 'No off-market matches surfaced today — Thunderbird is a tightly-held enclave.'}
          </h2>
          <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: 'rgba(240,235,224,0.6)', marginBottom: 36, maxWidth: 720, lineHeight: 1.75 }}>
            These aren't publicly listed. The PropertyDNA index pulls them by similar specs, neighborhood proximity, and long ownership tenure — the homes most likely to come available next.
          </p>
          {matches && matches.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {matches.map((m) => (
                <a key={m.address} href={m.dossierUrl || '#'} style={{ display: 'block', padding: 24, background: '#191613', border: '1px solid rgba(201,168,76,0.12)', textDecoration: 'none', color: 'inherit', transition: 'border-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.12)'}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: '#F0EBE0', marginBottom: 4, lineHeight: 1.2 }}>
                    {m.address}
                  </div>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#9C9082', letterSpacing: '1px', marginBottom: 14 }}>
                    {[m.city && `${m.city}, ${m.state || ''}`.trim(), m.distanceMi != null ? `${m.distanceMi} mi away` : null].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: 'rgba(240,235,224,0.7)', marginBottom: 10 }}>
                    {[m.beds && `${m.beds} bed`, m.baths && `${m.baths} bath`, m.sqft && `${Number(m.sqft).toLocaleString()} sqft`, m.yearBuilt && `built ${m.yearBuilt}`].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252' }}>
                    {m.lastSaleDate ? `Last sold ${m.lastSaleDate}${m.lastSalePrice ? ` · $${Number(m.lastSalePrice).toLocaleString()}` : ''}` : 'Long-tenured owner'}
                  </div>
                  <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: '#C9A84C', marginTop: 18 }}>
                    View dossier →
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div style={{ padding: 32, border: '1px dashed rgba(201,168,76,0.18)', textAlign: 'center', maxWidth: 600 }}>
              <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: 'rgba(240,235,224,0.65)', lineHeight: 1.7, margin: 0 }}>
                I'll keep watching and email you the moment something matching opens up.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Personal CTA — no auth-gated redirects */}
      <section style={{ maxWidth: 720, margin: '0 auto', padding: 'clamp(48px,7vw,96px) clamp(24px,5vw,48px)', textAlign: 'center' }}>
        <div style={kicker}>What's next</div>
        <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(24px,3vw,36px)', fontWeight: 300, color: '#F0EBE0', marginBottom: 16, lineHeight: 1.2 }}>
          I'll be in touch shortly — full details + matches on their way to your inbox.
        </h2>
        <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: 'rgba(240,235,224,0.7)', lineHeight: 1.8, marginBottom: 36 }}>
          {property.agent?.name || 'Dan Stuart'} · PropertyDNA<br />
          Direct line:{' '}
          <a href={`tel:${property.agent?.phone || '+12132054933'}`} style={{ color: '#C9A84C', textDecoration: 'none' }}>
            {property.agent?.phone || '+1 (213) 205-4933'}
          </a>
          {' '}·{' '}
          <a href={`mailto:${property.agent?.email || 'stuartteamps@gmail.com'}`} style={{ color: '#C9A84C', textDecoration: 'none' }}>
            email
          </a>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360, margin: '0 auto' }}>
          <a href={`sms:${property.agent?.phone || '+12132054933'}`} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '16px 24px', textDecoration: 'none', textAlign: 'center' }}>
            Text {property.agent?.name?.split(' ')[0] || 'Dan'} now
          </a>
          <a href={`tel:${property.agent?.phone || '+12132054933'}`} style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#F0EBE0', border: '1px solid rgba(201,168,76,0.3)', padding: '16px 24px', textDecoration: 'none', textAlign: 'center' }}>
            Call {property.agent?.name?.split(' ')[0] || 'Dan'}
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '24px 32px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: '#6B6252', margin: 0 }}>
          PropertyDNA · {property.community}
        </p>
      </footer>
    </div>
  );
}

// ── Main page (sign-in form) ─────────────────────────────────────────────────
export default function OpenHouse() {
  const [params] = useSearchParams();
  const propertySlug = params.get('property') || '';
  const agentParam = params.get('agent') || 'daniel';
  const property = getProperty(propertySlug);

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    workingWithAgent: '', buyerTimeline: '', interest: '', message: '',
  });
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [matches, setMatches] = useState<OffMarketMatch[]>([]);

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

    if (result.success) {
      if (result.data?.matches && Array.isArray(result.data.matches)) {
        setMatches(result.data.matches);
      }
      setStatus('success');
      // Scroll to top so the welcome page is seen from the hero down
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      setError(result.error); setStatus('error');
    }
  };

  // ── Welcome page (post-sign-in) ────────────────────────────────────────────
  if (status === 'success' && property) {
    return <WelcomePage property={property} matches={matches} firstName={form.firstName} />;
  }

  // Fallback success page when no property config (legacy /open-house with no slug)
  if (status === 'success') {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0908', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ width: 56, height: 56, border: '1px solid #C9A84C', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 32, fontWeight: 300, color: '#F0EBE0', marginBottom: 12 }}>You're checked in.</h2>
          <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: '#6B6252', lineHeight: 1.8, marginBottom: 24 }}>
            I'll send the property details and similar homes shortly.
          </p>
        </div>
      </div>
    );
  }

  const heroImage = property?.images?.[0];

  return (
    <div style={{ minHeight: '100vh', background: '#0A0908', color: '#F0EBE0' }}>
      {/* Header */}
      <header style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Link to="/" style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#F0EBE0', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, border: '1px solid #C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" stroke="#C9A84C" strokeWidth="1" /><line x1="7" y1="1" x2="7" y2="13" stroke="#C9A84C" strokeWidth="0.75" /><line x1="1" y1="7" x2="13" y2="7" stroke="#C9A84C" strokeWidth="0.75" /></svg>
          </div>
          PropertyDNA
        </Link>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: '#C9A84C' }}>Open House Check-In</div>
      </header>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'clamp(32px,6vw,80px) 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', gap: 'clamp(32px,6vw,80px)', alignItems: 'start' }}>

          {/* Left — property info */}
          <div>
            {heroImage && (
              <div style={{ aspectRatio: '4/3', background: `#1a1614 url(${heroImage}) center/cover no-repeat`, marginBottom: 24, border: '1px solid rgba(201,168,76,0.08)' }} />
            )}
            <div style={kicker}>Welcome</div>
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
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 28 }}>
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
                    {property.features.slice(0, 5).map(f => (
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
