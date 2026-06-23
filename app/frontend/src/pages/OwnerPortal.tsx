import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function OwnerPortal() {
  const [address, setAddress] = useState('');
  const [apn, setApn] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    document.title = 'Owner Portal — Claim Your Home — PropertyDNA';
    const setMeta = (n: string, c: string, p = false) => {
      const a = p ? 'property' : 'name';
      let m = document.querySelector(`meta[${a}="${n}"]`);
      if (!m) { m = document.createElement('meta'); m.setAttribute(a, n); document.head.appendChild(m); }
      m.setAttribute('content', c);
    };
    setMeta('description', 'Claim your property. Add improvements, permits, and verified facts. Every claim is reviewed before "Owner-verified" status is granted.');
    setMeta('og:title', 'PropertyDNA Owner Portal', true);
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedApn = apn.trim();
    if (trimmedApn) { nav(`/owner-portal/${encodeURIComponent(trimmedApn)}`); return; }
    if (!address.trim()) { setError('Enter an address or APN'); return; }
    setSearching(true);
    try {
      const r = await fetch(`/.netlify/functions/ticker-lookup?address=${encodeURIComponent(address.trim())}`);
      const d = await r.json();
      if (d.apn) { nav(`/owner-portal/${encodeURIComponent(d.apn)}`); return; }
      setError("We don't have this property indexed yet. Email stuartteamps@gmail.com to request coverage.");
    } catch {
      setError('Lookup failed. Try the APN directly, or contact us.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>PropertyDNA — Owner Portal</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 52, lineHeight: 1.1, margin: 0, fontWeight: 400, color: '#fafafa' }}>
            Claim Your Home
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: 17, lineHeight: 1.6, marginTop: 18, maxWidth: 700 }}>
            Every home in PropertyDNA's index can be claimed by its owner. Add improvements, permits, and verified facts.
            Your claim enters a verification queue before "Owner-verified" status is granted — we do not let owners
            silently inflate their own valuations.
          </p>
        </div>

        <form onSubmit={search} style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 28, marginBottom: 28 }}>
          <label style={{ fontSize: 12, letterSpacing: 2, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Property address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St, City, State"
            style={{ width: '100%', padding: '14px 16px', background: '#0a0a0a', border: '1px solid #374151', borderRadius: 4, color: '#fafafa', fontSize: 16, marginBottom: 18 }}
          />
          <label style={{ fontSize: 12, letterSpacing: 2, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            …or enter the parcel APN (faster)
          </label>
          <input
            value={apn}
            onChange={(e) => setApn(e.target.value)}
            placeholder="e.g. 504292010"
            style={{ width: '100%', padding: '14px 16px', background: '#0a0a0a', border: '1px solid #374151', borderRadius: 4, color: '#fafafa', fontSize: 16, marginBottom: 18 }}
          />
          {error && <div style={{ color: '#f87171', fontSize: 14, marginBottom: 16 }}>{error}</div>}
          <button
            type="submit"
            disabled={searching}
            style={{ padding: '14px 28px', background: '#fbbf24', color: '#0a0a0a', border: 'none', borderRadius: 4, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: searching ? 0.5 : 1 }}
          >
            {searching ? 'Searching…' : 'Continue →'}
          </button>
        </form>

        <Section title="What you can add">
          <ul style={{ paddingLeft: 18, lineHeight: 1.8, fontSize: 15 }}>
            <li><strong style={{ color: '#fbbf24' }}>Improvements</strong> — remodels, additions, ADU, solar, pool, roof, systems</li>
            <li><strong style={{ color: '#fbbf24' }}>Permits</strong> — open or closed permits not yet in our index</li>
            <li><strong style={{ color: '#fbbf24' }}>Carrying costs</strong> — current insurance premium, property tax</li>
            <li><strong style={{ color: '#fbbf24' }}>Provenance</strong> — architect attribution, notable prior owners, prior listings</li>
            <li><strong style={{ color: '#fbbf24' }}>Private notes</strong> — visible only to you; never publicly displayed</li>
          </ul>
        </Section>

        <Section title="How verification works">
          <ol style={{ paddingLeft: 18, lineHeight: 1.8, fontSize: 15, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li>You submit a claim with your name, email, and relationship to the property</li>
            <li>The claim enters the Data Integrity Office queue with status <strong style={{ color: '#94a3b8' }}>Pending verification</strong></li>
            <li>You may submit facts, documents, or photos at any time — these are tagged "pending review" until reviewed</li>
            <li>When identity verification ships (Phase 2), claims become eligible for the <strong style={{ color: '#34d399' }}>Owner-verified</strong> badge</li>
            <li>Verified facts feed into the valuation model only after a reviewer accepts the evidence</li>
          </ol>
          <p style={{ marginTop: 18, color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
            We do not let owners silently move their own valuations. This is by design — the integrity of the index depends on it.
          </p>
        </Section>

        <Section title="Owner rights">
          <p style={{ marginBottom: 12 }}>
            See the <a href="/data-integrity/owner-rights" style={{ color: '#fbbf24' }}>Data Integrity Office owner rights page</a> for the
            complete list. Highlights:
          </p>
          <ul style={{ paddingLeft: 18, lineHeight: 1.8, fontSize: 15 }}>
            <li>Request correction of any data shown publicly on your property</li>
            <li>Request removal of personal identifying information from public dossiers</li>
            <li>See every change made to your property's record (audit trail)</li>
            <li>Withdraw your claim at any time</li>
          </ul>
        </Section>

        <div style={{ marginTop: 48, padding: 20, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
          <strong style={{ color: '#cbd5e1' }}>Disclaimer.</strong> PropertyDNA is an intelligence platform, not a regulated securities exchange, brokerage, or
          investment adviser. Valuations are estimates. Owner-submitted data is reviewed before it influences any displayed valuation. Nothing on this site
          constitutes investment advice or an offer to buy, sell, or trade real property.
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 36 }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: '#fafafa', margin: '0 0 14px', fontWeight: 400 }}>{title}</h2>
      <div style={{ color: '#cbd5e1' }}>{children}</div>
    </div>
  );
}
