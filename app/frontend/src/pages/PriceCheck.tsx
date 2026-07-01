import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import FadeUp from '@/components/FadeUp';

// The front door: paste a listing, get the truth. Runs PropertyDNA's own
// RentCast-free valuation engine (/.netlify/functions/valuation) and shows the
// buyer-defense verdict — is this listing overpriced, and by how much.
const GOLD = '#B89355', CREAM = '#F4F0E8', INK = '#0F0E0D';
const usd = (n: number | null) => (n == null ? '—' : '$' + Math.round(n).toLocaleString());

type Result = {
  ok: boolean; avmValue: number | null; valueLow: number | null; valueHigh: number | null;
  expectedSale: number | null; confidence: number | null; compCount: number;
  overpricedPct: number | null; verdict: string | null; basis?: string[]; reason?: string;
  compsAvailable?: number; subject?: { matchedAddress?: string | null; sqft?: number | null; beds?: number | null; baths?: number | null; yearBuilt?: number | null };
};

const label: React.CSSProperties = { fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '3px', textTransform: 'uppercase', color: GOLD, marginBottom: 8, display: 'block' };
const input: React.CSSProperties = { width: '100%', padding: '14px 16px', background: '#1A1815', border: '1px solid #33302A', color: CREAM, fontSize: 16, fontFamily: 'Jost, sans-serif', borderRadius: 2, boxSizing: 'border-box' };

export default function PriceCheck() {
  const [sp, setSp] = useSearchParams();
  const [f, setF] = useState({
    address: sp.get('address') || '', city: sp.get('city') || '', state: sp.get('state') || 'CA',
    listPrice: sp.get('listPrice') || '', sqft: sp.get('sqft') || '', beds: sp.get('beds') || '',
    baths: sp.get('baths') || '', yearBuilt: sp.get('yearBuilt') || '', lotSqft: sp.get('lotSqft') || '',
  });
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function run() {
    setErr(''); setRes(null);
    if (!f.address && !f.city) { setErr('Enter an address (or at least a city).'); return; }
    setLoading(true);
    try {
      // AVM looks the property up in our index — sqft/beds are optional overrides.
      const p = new URLSearchParams();
      p.set('address', f.address); p.set('city', f.city); p.set('state', f.state);
      if (f.listPrice) p.set('listPrice', String(Number(f.listPrice) || ''));
      for (const k of ['sqft', 'beds', 'baths', 'yearBuilt', 'lotSqft'] as const) if (f[k]) p.set(k, String(Number(f[k]) || ''));
      const r = await fetch(`/.netlify/functions/avm?${p.toString()}`);
      const data = await r.json();
      setRes(data);
      // keep inputs in the URL so the result is shareable
      const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
      setSp(q, { replace: true });
    } catch { setErr('Could not reach the valuation engine. Try again.'); }
    setLoading(false);
  }

  function share() {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const over = res?.overpricedPct ?? null;
  const tone = over == null ? GOLD : over > 6 ? '#E0625E' : over < -6 ? '#6FBF8E' : GOLD;
  const headline = res?.verdict
    ? (over! > 6 ? `Overpriced by ${over}%` : over! < -6 ? `Priced ${Math.abs(over!)}% below value` : 'Fairly priced')
    : (res?.avmValue ? 'PropertyDNA AVM value' : '');

  return (
    <div style={{ background: INK, color: CREAM, minHeight: '100vh' }}>
      <Nav />
      <section style={{ padding: 'clamp(100px,12vw,140px) clamp(24px,6vw,80px) clamp(60px,8vw,100px)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <FadeUp>
            <span style={label}>Free · No login · Powered by real sold comps</span>
            <h1 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(38px,5.5vw,68px)', fontWeight: 300, lineHeight: 1.04, letterSpacing: '-1px', margin: '0 0 16px' }}>
              Is this listing <em style={{ fontStyle: 'italic', color: GOLD }}>overpriced?</em>
            </h1>
            <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 17, lineHeight: 1.6, color: '#C9C3B6', maxWidth: 560, margin: '0 0 40px' }}>
              Enter a home and its asking price. PropertyDNA values it against real recorded sales — the same data the agent has, finally on your side — and tells you, in one line, if you're being overpriced.
            </p>
          </FadeUp>

          <FadeUp>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 16, marginBottom: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}><label style={label}>Property address *</label><input style={input} value={f.address} onChange={set('address')} placeholder="440 Tan Oak Rd" /></div>
              <div><label style={label}>City *</label><input style={input} value={f.city} onChange={set('city')} placeholder="Palm Springs" /></div>
              <div><label style={label}>State</label><input style={input} value={f.state} onChange={set('state')} /></div>
              <div><label style={label}>Asking / list price</label><input style={input} value={f.listPrice} onChange={set('listPrice')} placeholder="1,450,000" inputMode="numeric" /></div>
              <div style={{ gridColumn: '1 / -1', fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#7C766B', marginTop: 4 }}>Optional — only if we don't have the home on file (we usually do):</div>
              <div><label style={label}>Sq ft</label><input style={input} value={f.sqft} onChange={set('sqft')} placeholder="1955" inputMode="numeric" /></div>
              <div><label style={label}>Lot sq ft</label><input style={input} value={f.lotSqft} onChange={set('lotSqft')} placeholder="8000" inputMode="numeric" /></div>
              <div><label style={label}>Beds</label><input style={input} value={f.beds} onChange={set('beds')} inputMode="numeric" /></div>
              <div><label style={label}>Baths</label><input style={input} value={f.baths} onChange={set('baths')} inputMode="numeric" /></div>
              <div><label style={label}>Year built</label><input style={input} value={f.yearBuilt} onChange={set('yearBuilt')} inputMode="numeric" /></div>
            </div>
            {err && <div style={{ color: '#E0625E', fontFamily: 'Jost, sans-serif', fontSize: 14, marginBottom: 12 }}>{err}</div>}
            <button onClick={run} disabled={loading} style={{ width: '100%', padding: '17px', background: GOLD, color: INK, border: 'none', borderRadius: 2, fontFamily: 'Jost, sans-serif', fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600, cursor: loading ? 'wait' : 'pointer' }}>
              {loading ? 'Valuing against real sales…' : 'Check this listing'}
            </button>
          </FadeUp>

          {res && res.ok && (
            <FadeUp>
              <div style={{ marginTop: 40, border: `1px solid ${tone}55`, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ background: `${tone}14`, padding: 'clamp(28px,5vw,44px)', textAlign: 'center', borderBottom: '1px solid #26241F' }}>
                  {res.subject?.matchedAddress && <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#8A8478', marginBottom: 10 }}>Found in our index: {res.subject.matchedAddress}{res.subject.sqft ? ` · ${res.subject.sqft.toLocaleString()} sqft` : ''}{res.subject.beds ? ` · ${res.subject.beds}bd` : ''}{res.subject.baths ? `/${res.subject.baths}ba` : ''}</div>}
                  <div style={label}>{headline}</div>
                  {over != null
                    ? <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(48px,9vw,88px)', fontWeight: 300, color: tone, lineHeight: 1 }}>{over > 0 ? '+' : ''}{over}%</div>
                    : <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(40px,7vw,72px)', fontWeight: 300, color: CREAM, lineHeight: 1 }}>{usd(res.avmValue)}</div>}
                  {over != null && <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: '#C9C3B6', marginTop: 10 }}>vs. our AVM value of {usd(res.avmValue)}</div>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
                  {[
                    ['AVM value', usd(res.avmValue)],
                    ['Value range', `${usd(res.valueLow)} – ${usd(res.valueHigh)}`],
                    ['Expected sale price', usd(res.expectedSale)],
                    ['Confidence', res.confidence != null ? `${Math.round(res.confidence * 100)}%` : '—'],
                    ['Comparable sales used', String(res.compCount)],
                    ['Basis', (res.basis || []).join(' + ').replace(/_/g, ' ') || 'comps'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ padding: '20px 24px', borderTop: '1px solid #26241F', borderRight: '1px solid #26241F' }}>
                      <div style={label}>{k}</div>
                      <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 22, color: CREAM }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '22px 24px', display: 'flex', gap: 12, flexWrap: 'wrap', borderTop: '1px solid #26241F' }}>
                  <button onClick={share} style={{ flex: 1, minWidth: 140, padding: '14px', background: 'transparent', color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 2, fontFamily: 'Jost, sans-serif', fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>{copied ? 'Link copied ✓' : 'Share this result'}</button>
                  <a href={`/analyze?address=${encodeURIComponent(f.address || f.city)}`} style={{ flex: 1, minWidth: 140, padding: '14px', background: GOLD, color: INK, borderRadius: 2, fontFamily: 'Jost, sans-serif', fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center', textDecoration: 'none', fontWeight: 600 }}>Full PropertyDNA report →</a>
                </div>
              </div>
              <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#7C766B', marginTop: 16, lineHeight: 1.6 }}>
                The AVM value is computed independently from comparable recorded sales in our own index (no asking-price anchor). Expected sale price reflects how homes in this tier typically close relative to list. Not an appraisal.
              </p>
            </FadeUp>
          )}
          {res && !res.ok && (
            <div style={{ marginTop: 32, padding: 24, border: '1px solid #33302A', borderRadius: 3, fontFamily: 'Jost, sans-serif', color: '#C9C3B6' }}>
              We don't have enough comparable sales in {f.city} yet to value this confidently{res.compsAvailable != null ? ` (${res.compsAvailable} nearby)` : ''}. We're adding markets fast — try a Coachella Valley city, or <a href="/analyze" style={{ color: GOLD }}>request a full report</a>.
            </div>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}
