import { useEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * Data Integrity Office (DIO) — overview page.
 * Static content. Sister pages: methodology, data-standards, owner-rights,
 * audit-trail, report-error.
 *
 * Naming note: DIO replaces the working name "Home Exchange Commission (HEC)"
 * which deliberately mimicked the SEC. Dropped for compliance reasons.
 */
export default function DataIntegrity() {
  useEffect(() => {
    document.title = 'Data Integrity Office — PropertyDNA';
    const setMeta = (n: string, c: string, p = false) => {
      const a = p ? 'property' : 'name';
      let m = document.querySelector(`meta[${a}="${n}"]`);
      if (!m) { m = document.createElement('meta'); m.setAttribute(a, n); document.head.appendChild(m); }
      m.setAttribute('content', c);
    };
    setMeta('description', 'PropertyDNA Data Integrity Office — methodology, data standards, owner rights, audit trail, and dispute resolution for the National Property Intelligence Network.');
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>PropertyDNA — Data Integrity Office</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 52, lineHeight: 1.1, margin: 0, fontWeight: 400, color: '#fafafa' }}>
            Transparent data. Documented methods. Owner rights first.
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: 17, lineHeight: 1.6, marginTop: 18, maxWidth: 740 }}>
            The Data Integrity Office is PropertyDNA's transparency layer. Every valuation method we use is documented.
            Every data source is named. Every owner has the right to correct what we show. Every AI decision is logged.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 32 }}>
          <Card to="/data-integrity/methodology" title="Valuation Methodology" desc="What 847 attributes go into a DNA score, how we weight them, and how confidence is computed." />
          <Card to="/data-integrity/data-standards" title="Data Standards" desc="Where our data comes from, how often it refreshes, and how we handle gaps." />
          <Card to="/data-integrity/owner-rights" title="Owner Rights" desc="What an owner can claim, correct, dispute, or remove from their property's record." />
          <Card to="/data-integrity/audit-trail" title="AI Audit Trail" desc="Every IntellaGraph AI decision is logged with input hash, model version, and confidence." />
          <Card to="/data-integrity/report-error" title="Report a Data Error" desc="Found something wrong? Submit a correction. Reviewed by a human." />
          <Card to="/owner-portal" title="Claim a Property" desc="Owner Portal — start the verification process for a home you own." />
        </div>

        <div style={{ marginTop: 56, padding: 24, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, color: '#cbd5e1', fontSize: 14, lineHeight: 1.7 }}>
          <strong style={{ color: '#fbbf24' }}>What the DIO is not.</strong> It is not a regulatory agency. It is not affiliated with the SEC,
          state real estate commissions, or any government body. It is PropertyDNA's internal standards and transparency function — a
          published, auditable framework so consumers can verify how the platform works.
        </div>

        <div style={{ marginTop: 24, padding: 24, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, color: '#94a3b8', fontSize: 12, lineHeight: 1.7 }}>
          <strong style={{ color: '#cbd5e1' }}>Disclaimer.</strong> PropertyDNA is an intelligence platform, not a regulated securities exchange,
          brokerage, or investment adviser. Valuations are estimates. Nothing on this site constitutes investment advice or an offer to buy, sell,
          or trade real property.
        </div>
      </div>
    </div>
  );
}

function Card({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 24, height: '100%', transition: 'border-color 0.15s' }}>
        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#fafafa', margin: '0 0 10px', fontWeight: 400 }}>{title}</h3>
        <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{desc}</p>
        <div style={{ marginTop: 14, color: '#fbbf24', fontSize: 13, fontWeight: 600 }}>Read →</div>
      </div>
    </Link>
  );
}
