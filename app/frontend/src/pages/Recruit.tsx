/**
 * /recruit — recruitment funnel for agents AND filming assistants.
 *
 * Two tracks via the role selector:
 *   - "Real Estate Agent / Realtor" — referral network + Pro tools
 *   - "Content Assistant / Filming" — hire for the YouTube + social engine
 */
import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

const C = {
  bg: '#0A0908', card: '#12100D', border: 'rgba(255,255,255,0.08)',
  gold: '#C9A84C', text: '#F4F0E8', muted: 'rgba(244,240,232,0.55)',
  green: '#00cc77',
};
const FONT_SERIF = "'Cormorant Garamond', Georgia, serif";
const FONT_SANS  = "'Jost', -apple-system, BlinkMacSystemFont, sans-serif";

type Role = 'agent' | 'assistant';

const inp: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)',
  color: C.text, fontFamily: FONT_SANS, fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  display: 'block', fontFamily: FONT_SANS, fontSize: 9,
  letterSpacing: 3, textTransform: 'uppercase', color: C.muted, marginBottom: 8,
};

export default function Recruit() {
  const [params] = useSearchParams();
  const [role, setRole] = useState<Role>((params.get('role') as Role) || 'agent');
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    city: '', state: '', license_state: '', license_number: '',
    brokerage: '', years_in_business: '',
    specialty: '', avg_listing_price: '',
    why_interested: '',
    portfolio_url: '',
    can_film: false, can_edit: false, has_studio_space: false,
    available_hours: '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm(p => ({ ...p, [k]: v }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting'); setError('');
    try {
      const res = await fetch('/.netlify/functions/recruit-intake', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, ...form }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Submission failed'); setStatus('error'); return; }
      setStatus('success');
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch { setError('Network error'); setStatus('error'); }
  };

  if (status === 'success') {
    return (
      <div style={{ background: C.bg, color: C.text, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 520 }}>
          <div style={{ width: 56, height: 56, border: `1px solid ${C.green}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="1.5"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 36, fontWeight: 300, marginBottom: 14 }}>Application received.</h1>
          <p style={{ fontFamily: FONT_SANS, fontSize: 14, color: C.muted, lineHeight: 1.75, marginBottom: 28 }}>
            I read every one personally. You'll hear from me within 3 business days. {role === 'agent' ? 'If we move forward, I onboard you to the network with a free Pro account, your first co-listing prospect, and the referral-fee structure laid out plainly.' : 'If we move forward, I send you a paid trial shoot to see how we work together — no commitment either side.'}
          </p>
          <Link to="/" style={{ display: 'inline-block', padding: '14px 28px', background: C.gold, color: '#0F0E0D', textDecoration: 'none', fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' }}>← Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh' }}>
      <header style={{ padding: '24px 32px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
        <Link to="/" style={{ fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: C.text, textDecoration: 'none' }}>← PropertyDNA</Link>
        <div style={{ fontFamily: FONT_SANS, fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: C.gold }}>Join the team</div>
      </header>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(40px,6vw,80px) clamp(20px,4vw,48px)' }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: C.gold, marginBottom: 18 }}>
          Recruitment · 2 tracks
        </div>
        <h1 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(34px,5vw,60px)', fontWeight: 300, lineHeight: 1.05, letterSpacing: '-0.8px', marginBottom: 20 }}>
          Build the movement with us.
        </h1>
        <p style={{ fontFamily: FONT_SANS, fontSize: 15, lineHeight: 1.75, color: C.muted, marginBottom: 40, maxWidth: 600 }}>
          PropertyDNA is hiring two tracks right now: <strong style={{ color: C.text }}>real estate agents</strong> for the referral + Pro network across the Coachella Valley and out-of-area markets, and <strong style={{ color: C.text }}>content assistants</strong> to help film, edit, and ship the YouTube + social engine.
        </p>

        {/* Role selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 36 }}>
          <button onClick={() => setRole('agent')} style={{ padding: '20px 16px', background: role === 'agent' ? C.card : 'transparent', border: `1px solid ${role === 'agent' ? C.gold : C.border}`, color: role === 'agent' ? C.gold : C.muted, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: 20, marginBottom: 4 }}>Real Estate Agent</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: role === 'agent' ? C.text : C.muted }}>Referral network + Pro tools + co-listing prospects</div>
          </button>
          <button onClick={() => setRole('assistant')} style={{ padding: '20px 16px', background: role === 'assistant' ? C.card : 'transparent', border: `1px solid ${role === 'assistant' ? C.gold : C.border}`, color: role === 'assistant' ? C.gold : C.muted, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: 20, marginBottom: 4 }}>Content Assistant</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: role === 'assistant' ? C.text : C.muted }}>Help film + edit + ship the YouTube engine</div>
          </button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Common fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div><label style={lbl}>Name</label><input required type="text" value={form.name} onChange={set('name')} style={inp} /></div>
            <div><label style={lbl}>Email</label><input required type="email" value={form.email} onChange={set('email')} style={inp} /></div>
            <div><label style={lbl}>Phone</label><input type="tel" value={form.phone} onChange={set('phone')} style={inp} /></div>
            <div><label style={lbl}>City, State</label><input type="text" value={form.city} onChange={set('city')} placeholder="Palm Springs, CA" style={inp} /></div>
          </div>

          {/* Agent-specific */}
          {role === 'agent' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                <div><label style={lbl}>License state</label><input type="text" maxLength={2} value={form.license_state} onChange={set('license_state')} placeholder="CA" style={inp} /></div>
                <div><label style={lbl}>License #</label><input type="text" value={form.license_number} onChange={set('license_number')} placeholder="DRE# 12345" style={inp} /></div>
                <div><label style={lbl}>Brokerage</label><input type="text" value={form.brokerage} onChange={set('brokerage')} placeholder="Compass / Sotheby's / etc." style={inp} /></div>
                <div><label style={lbl}>Years in business</label><input type="text" inputMode="numeric" value={form.years_in_business} onChange={set('years_in_business')} style={inp} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <div><label style={lbl}>Specialty</label>
                  <select value={form.specialty} onChange={set('specialty')} style={{ ...inp, cursor: 'pointer' }}>
                    <option value="">Select…</option>
                    <option value="luxury">Luxury ($2M+)</option>
                    <option value="mid">Mid-market ($500K-$2M)</option>
                    <option value="entry">Entry / first-time</option>
                    <option value="commercial">Commercial / mixed</option>
                    <option value="investor">Investor / multifamily</option>
                  </select>
                </div>
                <div><label style={lbl}>Avg listing price</label><input type="text" value={form.avg_listing_price} onChange={set('avg_listing_price')} placeholder="$1.2M" style={inp} /></div>
              </div>
              <div>
                <label style={lbl}>Why interested in partnering with PropertyDNA?</label>
                <textarea rows={4} value={form.why_interested} onChange={set('why_interested')}
                  placeholder="What you're hoping to get out of the relationship + what you'd bring to it."
                  style={{ ...inp, resize: 'vertical' }}
                />
              </div>
            </>
          )}

          {/* Assistant-specific */}
          {role === 'assistant' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div><label style={lbl}>Available hours / week</label><input type="text" value={form.available_hours} onChange={set('available_hours')} placeholder="10-20" style={inp} /></div>
                <div><label style={lbl}>Portfolio / reel URL</label><input type="url" value={form.portfolio_url} onChange={set('portfolio_url')} placeholder="https://…" style={inp} /></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { k: 'can_film',         label: 'Can shoot video on a phone or mirrorless camera' },
                  { k: 'can_edit',         label: 'Can edit short-form (Capcut / Descript / Premiere)' },
                  { k: 'has_studio_space', label: 'Have access to a quiet recording space + lav mic' },
                ].map(({ k, label }) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={(form as any)[k]} onChange={set(k as any)} style={{ width: 18, height: 18, accentColor: C.gold, cursor: 'pointer' }} />
                    <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.text }}>{label}</span>
                  </label>
                ))}
              </div>
              <div>
                <label style={lbl}>Why interested?</label>
                <textarea rows={4} value={form.why_interested} onChange={set('why_interested')}
                  placeholder="What pulled you in. What you're excited about. Anything else."
                  style={{ ...inp, resize: 'vertical' }}
                />
              </div>
            </>
          )}

          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(255,68,68,0.1)', border: '1px solid #ff4444', color: '#ff4444', fontFamily: FONT_SANS, fontSize: 13 }}>{error}</div>
          )}

          <button type="submit" disabled={status === 'submitting'} style={{
            padding: '18px 32px', background: status === 'submitting' ? 'rgba(201,168,76,0.5)' : C.gold,
            color: '#0F0E0D', border: 'none', cursor: status === 'submitting' ? 'wait' : 'pointer',
            fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 500,
            alignSelf: 'flex-start',
          }}>
            {status === 'submitting' ? 'Sending…' : 'Submit application →'}
          </button>
        </form>
      </div>
    </div>
  );
}
