import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import RequestDossierModal from '@/components/RequestDossierModal';

export default function DossierRequest() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.title = 'Request a Luxury Provenance Dossier — PropertyDNA';
    const setMeta = (n: string, c: string, p = false) => {
      const a = p ? 'property' : 'name';
      let m = document.querySelector(`meta[${a}="${n}"]`);
      if (!m) { m = document.createElement('meta'); m.setAttribute(a, n); document.head.appendChild(m); }
      m.setAttribute('content', c);
    };
    setMeta('description', 'Request a verified provenance dossier for any $5M+ luxury estate. Architect attribution, celebrity ownership verification, scarcity benchmarking, and primary source documentation.');
    setMeta('og:title', 'Request a Luxury Provenance Dossier', true);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '60px 24px' }}>

        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>PropertyDNA — Luxury Service</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 52, lineHeight: 1.1, margin: 0, fontWeight: 400, color: '#fafafa' }}>
            Request a Verified Provenance Dossier
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: 17, lineHeight: 1.6, marginTop: 18, maxWidth: 700 }}>
            The documentation layer that auction houses charge 15% for, generated as a service. Verified celebrity ownership against deed records.
            Architect attribution against archive drawings. Scarcity indexing against comparable trade frequency. Primary source citations on every claim.
          </p>
        </div>

        <Section title="What's In a PropertyDNA Dossier">
          <ul style={{ paddingLeft: 18, lineHeight: 1.8, fontSize: 15 }}>
            <li><strong style={{ color: '#fbbf24' }}>Architect attribution</strong> — verified against original drawings, building permits, and period press features</li>
            <li><strong style={{ color: '#fbbf24' }}>Verified celebrity provenance</strong> — deed history cross-referenced against minimum two independent press sources</li>
            <li><strong style={{ color: '#fbbf24' }}>Provenance events</strong> — films shot at the property, press features, historic visits</li>
            <li><strong style={{ color: '#fbbf24' }}>Modification chronology</strong> — every owner's renovations with permit records</li>
            <li><strong style={{ color: '#fbbf24' }}>Scarcity benchmarking</strong> — how often comparable architect-attributed homes trade</li>
            <li><strong style={{ color: '#fbbf24' }}>Insurance replacement vs. market value</strong> — often inverted on irreplaceable estates</li>
            <li><strong style={{ color: '#fbbf24' }}>Cross-asset luxury benchmarking</strong> — performance vs. Patek Philippe, Domaine Romanée-Conti, classic Ferraris</li>
          </ul>
        </Section>

        <Section title="How It Works">
          <ol style={{ paddingLeft: 18, lineHeight: 1.8, fontSize: 15, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li>You submit the property address and ownership context</li>
            <li>Our research team verifies architect attribution via Palm Springs Modernism Committee, UCLA / UCSB / Getty archives, and architect commission lists</li>
            <li>We pull deed records, period press, and biographical sources to verify ownership claims</li>
            <li>The completed dossier is delivered as both a publicly-accessible URL (for sharing with buyers) and a private PDF (for inclusion in listing materials)</li>
            <li>The dossier is hosted permanently as a verifiable provenance record</li>
          </ol>
        </Section>

        <Section title="Sample Dossiers">
          <p style={{ marginBottom: 12 }}>Browse live examples — these are the public dossiers we've compiled for documented Palm Springs estates:</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <Sample to="/dossier/504292010" label="Kaufmann House (Neutra)" />
            <Sample to="/dossier/689100043" label="Sinatra Compound" />
            <Sample to="/dossier/510260033" label="Bob Hope House (Lautner)" />
            <Sample to="/dossier/510250031" label="Elrod House (Lautner)" />
            <Sample to="/dossier/508038001" label="Sinatra Twin Palms" />
            <Sample to="/dossier/513110020" label="Frey House II" />
          </div>
        </Section>

        <Section title="Who This Is For">
          <ul style={{ paddingLeft: 18, lineHeight: 1.8, fontSize: 15 }}>
            <li><strong>Owners</strong> of $5M+ luxury estates planning to sell — dossier becomes a marketing asset</li>
            <li><strong>Listing agents</strong> who want differentiated marketing material at the listing appointment</li>
            <li><strong>Estate planners</strong> documenting irreplaceable assets for trust beneficiaries</li>
            <li><strong>Buyers</strong> conducting due diligence on architecturally-significant acquisitions</li>
            <li><strong>Press / publications</strong> writing about Palm Springs MCM architecture</li>
          </ul>
        </Section>

        <div style={{ marginTop: 48, padding: 36, background: 'linear-gradient(135deg, #1f2937 0%, #0f172a 100%)', borderRadius: 6, border: '1px solid #334155', textAlign: 'center' }}>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#fafafa', margin: '0 0 14px', fontWeight: 400 }}>Request a Dossier</h3>
          <p style={{ color: '#cbd5e1', fontSize: 14, marginBottom: 22, maxWidth: 520, margin: '0 auto 22px' }}>
            Dan will personally review your property and confirm scope + pricing within 24 hours.
            Standard turnaround for a luxury dossier is 7–14 days depending on archive availability.
          </p>
          <button onClick={() => setOpen(true)} style={{
            padding: '14px 32px', background: '#fbbf24', color: '#0a0a0a', borderRadius: 4,
            fontWeight: 600, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase',
            border: 'none', cursor: 'pointer',
          }}>Begin Your Dossier Request</button>
        </div>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link to="/pedigree-index" style={{ color: '#94a3b8', fontSize: 13 }}>← Back to Pedigree Index</Link>
        </div>

        <RequestDossierModal open={open} onClose={() => setOpen(false)} sourcePage="dossier-request" />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 16, fontWeight: 600 }}>{title}</h2>
      <div style={{ background: '#111827', padding: 24, borderRadius: 6, fontSize: 15, color: '#cbd5e1' }}>{children}</div>
    </section>
  );
}
function Sample({ to, label }: { to: string; label: string }) {
  return <Link to={to} style={{ padding: '10px 14px', background: '#1e293b', color: '#fbbf24', borderRadius: 4, fontSize: 13, textDecoration: 'none', textAlign: 'center' }}>{label} →</Link>;
}
