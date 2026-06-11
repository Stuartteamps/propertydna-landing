/**
 * /share-your-story — Submit-your-story funnel
 *
 * "Tell us your real estate horror story. We'll share the ones that pattern-match —
 * anonymized if you want — so the next buyer doesn't fall for the same trick."
 *
 * Captures structured submissions to submitted_stories table. Emails Dan
 * instantly + confirms submitter via Resend.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';

const C = {
  bg: '#0A0908',
  card: '#12100D',
  border: 'rgba(255,255,255,0.08)',
  gold: '#C9A84C',
  text: '#F4F0E8',
  muted: 'rgba(244,240,232,0.55)',
  green: '#00cc77',
};

const FONT_SERIF = "'Cormorant Garamond', Georgia, serif";
const FONT_SANS  = "'Jost', -apple-system, BlinkMacSystemFont, sans-serif";

const CATEGORIES = [
  { value: 'agent_steered',     label: 'An agent steered me wrong' },
  { value: 'hidden_issue',      label: 'A hidden issue surfaced after closing' },
  { value: 'insurance_shock',   label: 'Insurance cost surprised me' },
  { value: 'flood_zone',        label: 'Flood zone / climate risk surprise' },
  { value: 'permit_problem',    label: 'Unfinaled permit / inspection issue' },
  { value: 'overpaid',          label: 'I overpaid (and didn\'t know it)' },
  { value: 'comp_manipulation', label: 'Comps were cherry-picked' },
  { value: 'pdna_saved_me',     label: 'PropertyDNA saved me from a bad deal' },
  { value: 'other',             label: 'Something else' },
];

const inp: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: C.text, fontFamily: FONT_SANS, fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  display: 'block', fontFamily: FONT_SANS, fontSize: 9,
  letterSpacing: 3, textTransform: 'uppercase', color: C.muted, marginBottom: 8,
};

export default function ShareStory() {
  const [form, setForm] = useState({
    email: '', name: '', role: '',
    property_address: '', property_city: '', property_state: '',
    story_category: '', story_title: '', story_body: '',
    financial_impact_usd: '',
    what_pdna_caught: '',
    allow_public: true, anonymize: false, contact_for_followup: true,
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
      const res = await fetch('/.netlify/functions/submit-story', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          financial_impact_usd: form.financial_impact_usd ? Number(form.financial_impact_usd.replace(/[^\d.]/g, '')) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Submission failed'); setStatus('error'); return; }
      setStatus('success');
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError('Network error — please try again.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div style={{ background: C.bg, color: C.text, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
        <div style={{ maxWidth: 560, textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, border: `1px solid ${C.green}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, marginBottom: 14, lineHeight: 1.15 }}>
            Your story is in.
          </h1>
          <p style={{ fontFamily: FONT_SANS, fontSize: 14, color: C.muted, lineHeight: 1.85, marginBottom: 28 }}>
            I'll read it personally and follow up within 5 business days. If your story pattern-matches what other buyers are facing, we'll feature it (anonymized if you asked us to) to help the next person spot the same trap.
          </p>
          <p style={{ fontFamily: FONT_SERIF, fontSize: 16, color: C.text, fontStyle: 'italic', marginBottom: 32, lineHeight: 1.6 }}>
            "Private hurt → public warning. That's how we change the industry."
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/" style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#0F0E0D', background: C.gold, padding: '14px 26px', textDecoration: 'none' }}>
              Home
            </Link>
            <Link to="/property-dna" style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: C.text, border: `1px solid ${C.border}`, padding: '14px 26px', textDecoration: 'none' }}>
              Run a free DNA report
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh' }}>
      <header style={{ padding: '24px 32px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ fontFamily: FONT_SANS, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: C.text, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, border: `1px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="12" stroke={C.gold} />
              <line x1="7" y1="1" x2="7" y2="13" stroke={C.gold} strokeWidth="0.75" />
              <line x1="1" y1="7" x2="13" y2="7" stroke={C.gold} strokeWidth="0.75" />
            </svg>
          </div>
          PropertyDNA
        </Link>
        <div style={{ fontFamily: FONT_SANS, fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: C.gold }}>Save the humans · Share your story</div>
      </header>

      <div style={{ maxWidth: 840, margin: '0 auto', padding: 'clamp(40px,6vw,80px) clamp(20px,4vw,48px)' }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: C.gold, marginBottom: 16 }}>
            Tell us what happened
          </div>
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(36px,5.5vw,68px)', fontWeight: 300, lineHeight: 1.05, letterSpacing: '-1px', marginBottom: 20 }}>
            Real estate{' '}
            <em style={{ color: C.gold, fontStyle: 'italic' }}>doesn't have to keep doing this</em>{' '}
            to people.
          </h1>
          <p style={{ fontFamily: FONT_SANS, fontSize: 16, fontWeight: 300, lineHeight: 1.8, color: C.muted, maxWidth: 640 }}>
            If you got steered wrong, overpaid because of cherry-picked comps, walked into a hidden flood zone, or found a defect the agent buried — tell us. We feature the stories that pattern-match (anonymized if you ask) so the next person spots the trap before it springs.
          </p>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Section 1 — your story */}
          <section style={{ background: C.card, border: `1px solid ${C.border}`, padding: 'clamp(24px,3vw,36px)' }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: C.gold, marginBottom: 22 }}>
              The story
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={lbl}>What kind of story is this?</label>
              <select required value={form.story_category} onChange={set('story_category')} style={{ ...inp, cursor: 'pointer' }}>
                <option value="">Select a category…</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={lbl}>Headline · one sentence</label>
              <input
                required type="text" maxLength={240}
                value={form.story_title} onChange={set('story_title')}
                placeholder="The agent buried the flood zone disclosure until escrow"
                style={inp}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={lbl}>What happened? — share as much detail as you want</label>
              <textarea
                required minLength={40} maxLength={8000} rows={8}
                value={form.story_body} onChange={set('story_body')}
                placeholder="Tell it your way. What did you expect? What actually happened? What did it cost you — money, time, peace of mind?"
                style={{ ...inp, resize: 'vertical', fontFamily: FONT_SERIF, fontSize: 15, lineHeight: 1.7 }}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={lbl}>If money was involved, how much? — optional</label>
              <input
                type="text" inputMode="numeric"
                value={form.financial_impact_usd} onChange={set('financial_impact_usd')}
                placeholder="e.g. 18000"
                style={inp}
              />
            </div>

            {form.story_category === 'pdna_saved_me' && (
              <div>
                <label style={lbl}>What did PropertyDNA catch? — optional, helps us match patterns</label>
                <textarea
                  rows={3}
                  value={form.what_pdna_caught} onChange={set('what_pdna_caught')}
                  placeholder="e.g. The DNA score was 62 and the comp spread was 14% — I walked away."
                  style={{ ...inp, resize: 'vertical' }}
                />
              </div>
            )}
          </section>

          {/* Section 2 — about you */}
          <section style={{ background: C.card, border: `1px solid ${C.border}`, padding: 'clamp(24px,3vw,36px)' }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: C.gold, marginBottom: 22 }}>
              About you
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 22 }}>
              <div>
                <label style={lbl}>Name — first name is fine</label>
                <input type="text" value={form.name} onChange={set('name')} placeholder="Jordan" style={inp} />
              </div>
              <div>
                <label style={lbl}>Email · required</label>
                <input required type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" style={inp} />
              </div>
              <div>
                <label style={lbl}>What were you doing? — optional</label>
                <select value={form.role} onChange={set('role')} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="">Select…</option>
                  <option value="first_time_buyer">First-time buyer</option>
                  <option value="seasoned_buyer">Seasoned buyer</option>
                  <option value="seller">Seller</option>
                  <option value="investor">Investor</option>
                  <option value="renter_displaced">Renter / displaced</option>
                  <option value="agent">Real estate agent</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 6 }}>
              <div>
                <label style={lbl}>Property address — optional</label>
                <input type="text" value={form.property_address} onChange={set('property_address')} placeholder="optional" style={inp} />
              </div>
              <div>
                <label style={lbl}>City</label>
                <input type="text" value={form.property_city} onChange={set('property_city')} placeholder="optional" style={inp} />
              </div>
              <div>
                <label style={lbl}>State</label>
                <input type="text" maxLength={2} value={form.property_state} onChange={set('property_state')} placeholder="CA" style={inp} />
              </div>
            </div>
          </section>

          {/* Section 3 — permissions */}
          <section style={{ background: C.card, border: `1px solid ${C.border}`, padding: 'clamp(24px,3vw,36px)' }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: C.gold, marginBottom: 22 }}>
              How we can use it
            </div>

            {[
              { k: 'allow_public', label: 'OK to feature this publicly', desc: 'Newsletter, blog, YouTube, social. We choose the best fit.' },
              { k: 'anonymize',    label: 'Keep my name private',         desc: 'We\'ll change names + identifying details. Pattern matters, not the person.' },
              { k: 'contact_for_followup', label: 'OK to contact me for follow-up', desc: 'We may want to verify details or ask a clarifying question.' },
            ].map(({ k, label, desc }) => (
              <label key={k} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 12, padding: '10px 0', cursor: 'pointer', borderTop: k !== 'allow_public' ? `1px solid ${C.border}` : 'none' }}>
                <input
                  type="checkbox" checked={(form as any)[k]} onChange={set(k as any)}
                  style={{ width: 18, height: 18, marginTop: 2, accentColor: C.gold, cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontFamily: FONT_SANS, fontSize: 14, color: C.text, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{desc}</div>
                </div>
              </label>
            ))}
          </section>

          {error && (
            <div style={{ padding: '14px 18px', background: 'rgba(255,68,68,0.1)', border: '1px solid #ff4444', color: '#ff4444', fontFamily: FONT_SANS, fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={status === 'submitting'}
            style={{
              padding: '18px 32px', fontFamily: FONT_SANS, fontSize: 11, fontWeight: 500,
              letterSpacing: 3, textTransform: 'uppercase', color: '#0F0E0D',
              background: status === 'submitting' ? 'rgba(201,168,76,0.5)' : C.gold,
              border: 'none', cursor: status === 'submitting' ? 'wait' : 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            {status === 'submitting' ? 'Sending…' : 'Submit your story →'}
          </button>

          <p style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.muted, lineHeight: 1.7, marginTop: 0 }}>
            Dan reads every submission personally. We respond within 5 business days. If you'd rather just email it, write to <a href="mailto:stories@thepropertydna.com" style={{ color: C.gold, textDecoration: 'none' }}>stories@thepropertydna.com</a>.
          </p>
        </form>
      </div>
    </div>
  );
}
