import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * National Property Intelligence Network (NPIN) — landing page.
 * Rolls up: index coverage, market heat map, dossiers, pedigree index.
 *
 * This is the conceptual "Intelligence Platform" surface — explicitly NOT
 * branded as an exchange and explicitly NOT a securities marketplace.
 *
 * Naming note: replaces the working name "National Housing Stock Exchange (NHSE)"
 * which used securities-exchange language. Dropped for compliance reasons.
 */
export default function Network() {
  const [stats, setStats] = useState<{ total: number; states: number } | null>(null);

  useEffect(() => {
    document.title = 'National Property Intelligence Network — PropertyDNA';
    const setMeta = (n: string, c: string, p = false) => {
      const a = p ? 'property' : 'name';
      let m = document.querySelector(`meta[${a}="${n}"]`);
      if (!m) { m = document.createElement('meta'); m.setAttribute(a, n); document.head.appendChild(m); }
      m.setAttribute('content', c);
    };
    setMeta('description', 'The National Property Intelligence Network — 10M+ indexed properties, owner-verified data, market dashboards, and AI-powered intelligence. Track homes like assets.');

    // Pull live total from our public stats function (best-effort)
    fetch('/.netlify/functions/index-stats').then(r => r.json()).then(d => {
      if (d?.total) setStats({ total: d.total, states: d.states_count || 20 });
    }).catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>National Property Intelligence Network</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 56, lineHeight: 1.05, margin: 0, fontWeight: 400, color: '#fafafa', maxWidth: 920 }}>
            Every home is an asset.<br />Every asset deserves transparency.
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: 18, lineHeight: 1.6, marginTop: 22, maxWidth: 760 }}>
            PropertyDNA's NPIN is the intelligence layer for American housing — an indexed, queryable, owner-verifiable national network of
            residential properties with documented valuations, transparent methodology, and full audit trails.
          </p>
        </div>

        {/* Live stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 48 }}>
          <Stat label="Indexed properties" value={stats ? stats.total.toLocaleString() : '10M+'} />
          <Stat label="States covered" value={stats ? String(stats.states) : '20+'} />
          <Stat label="Valuation methodology" value="Documented" to="/data-integrity/methodology" />
          <Stat label="Owner rights" value="Codified" to="/data-integrity/owner-rights" />
        </div>

        {/* Primary entry points */}
        <Section title="What's in the network">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <Card
              to="/market-heatmaps"
              tag="Live"
              title="Market Heat Map"
              desc="Visual rollup of indexed markets — appreciation zones, demand intensity, risk overlays."
            />
            <Card
              to="/dossiers"
              tag="Live"
              title="Verified Provenance Dossiers"
              desc="$5M+ luxury estates with verified architect attribution and notable ownership history."
            />
            <Card
              to="/pedigree-index"
              tag="Live"
              title="National Pedigree Index"
              desc="Architecturally significant properties classified by pedigree tier (A-D)."
            />
            <Card
              to="/owner-portal"
              tag="New"
              title="Owner Portal"
              desc="Claim your home, document improvements, request corrections. Pending verification model — your facts are reviewed before they influence valuations."
            />
            <Card
              to="/intellagraph"
              tag="Live"
              title="IntellaGraph AI"
              desc="Conversational + predictive intelligence over the network. Ask anything, query portfolios, forecast 90-day sell likelihood."
            />
            <Card
              to="/data-integrity"
              tag="New"
              title="Data Integrity Office"
              desc="Methodology, data standards, owner rights, audit trail, and dispute resolution. The transparency layer."
            />
          </div>
        </Section>

        <Section title="Track a specific property">
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 28 }}>
            <p style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.6, margin: '0 0 18px' }}>
              Every property in the network has a ticker-style page with valuation history, comparables, provenance, and risk profile.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Link to="/analyze" style={primaryBtnAsLink}>Search by address →</Link>
              <Link to="/dossiers" style={secondaryBtnAsLink}>Browse luxury dossiers</Link>
              <Link to="/owner-portal" style={secondaryBtnAsLink}>Claim a property</Link>
            </div>
          </div>
        </Section>

        <Section title="Principles">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            <Principle title="Transparent valuations" body="Every DNA score's input families and confidence are documented in the Data Integrity Office." />
            <Principle title="Owner-first data" body="Owners can claim, correct, and dispute. Owner-submitted facts never silently feed valuations — they're reviewed first." />
            <Principle title="Sourced everything" body="Every fact has a source. Conflicts are surfaced, not silently resolved. Gaps are marked, never inferred." />
            <Principle title="AI you can audit" body="Every IntellaGraph AI decision is logged with model version, input hash, and confidence." />
          </div>
        </Section>

        <div style={{ marginTop: 56, padding: 24, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, color: '#94a3b8', fontSize: 13, lineHeight: 1.7 }}>
          <strong style={{ color: '#cbd5e1' }}>What NPIN is not.</strong> NPIN is an intelligence platform — not a regulated securities exchange,
          not a brokerage, not an investment adviser. Valuations are estimates. Owner-submitted data is reviewed before it influences any
          displayed valuation. Nothing on this site constitutes investment advice, a recommendation to buy or sell, or an offer to trade real
          property or any interest in it. Investment products would require legal and regulatory approval that we have not sought and are not
          claiming.
        </div>
      </div>
    </div>
  );
}

// ── pieces ──────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 48 }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 30, color: '#fafafa', margin: '0 0 18px', fontWeight: 400 }}>{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value, to }: { label: string; value: string; to?: string }) {
  const inner = (
    <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 22 }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#fafafa', fontWeight: 400, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, letterSpacing: 2, color: '#94a3b8', textTransform: 'uppercase', marginTop: 6, fontWeight: 600 }}>{label}</div>
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}

function Card({ to, tag, title, desc }: { to: string; tag: string; title: string; desc: string }) {
  const tagBg = tag === 'New' ? '#fbbf24' : tag === 'Live' ? '#34d399' : '#94a3b8';
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#fafafa', margin: 0, fontWeight: 400 }}>{title}</h3>
          <span style={{ fontSize: 10, letterSpacing: 1.5, color: '#0a0a0a', background: tagBg, padding: '2px 8px', borderRadius: 3, fontWeight: 700, textTransform: 'uppercase' }}>{tag}</span>
        </div>
        <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, margin: 0, flexGrow: 1 }}>{desc}</p>
        <div style={{ marginTop: 14, color: '#fbbf24', fontSize: 13, fontWeight: 600 }}>Open →</div>
      </div>
    </Link>
  );
}

function Principle({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, padding: 20 }}>
      <div style={{ color: '#fbbf24', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}

const primaryBtnAsLink: React.CSSProperties = {
  padding: '12px 24px', background: '#fbbf24', color: '#0a0a0a', border: 'none',
  borderRadius: 4, fontSize: 14, fontWeight: 700, textDecoration: 'none', display: 'inline-block',
};
const secondaryBtnAsLink: React.CSSProperties = {
  padding: '12px 24px', background: 'transparent', color: '#cbd5e1', border: '1px solid #374151',
  borderRadius: 4, fontSize: 14, textDecoration: 'none', display: 'inline-block',
};
