import { Link } from 'react-router-dom';
import { useEffect } from 'react';

export default function PressKit() {
  useEffect(() => {
    document.title = 'Press Kit — PropertyDNA';
    const setMeta = (n: string, c: string, p = false) => {
      const a = p ? 'property' : 'name';
      let m = document.querySelector(`meta[${a}="${n}"]`);
      if (!m) { m = document.createElement('meta'); m.setAttribute(a, n); document.head.appendChild(m); }
      m.setAttribute('content', c);
    };
    setMeta('description', 'PropertyDNA press kit — luxury home provenance intelligence for the Coachella Valley. Verified celebrity ownership, architect attribution, and pedigree classification across 16,787 properties.');
    setMeta('og:title', 'PropertyDNA Press Kit', true);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '60px 24px' }}>

        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>PropertyDNA — Press Kit</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 48, lineHeight: 1.1, margin: 0, fontWeight: 400, color: '#fafafa' }}>Press & Media</h1>
        </div>

        <Section title="One-Liner">
          <p>PropertyDNA is the luxury home provenance intelligence platform — a Barrett-Jackson-grade dossier methodology applied to $5M+ architecturally significant residential real estate.</p>
        </Section>

        <Section title="The Story">
          <p>Built in Palm Springs by a real estate team running into a documentation gap: while a $50,000 Patek Philippe ships with verified provenance papers, a $50 million architectural estate often doesn't.</p>
          <p>Sotheby's and Christie's charge 15% commissions because they generate the dossier. PropertyDNA builds it as a SaaS — verified celebrity ownership against deed records, architect attribution against archive drawings, scarcity indexing against comparable trade frequency.</p>
          <p>Launch market: the Coachella Valley. Architecturally significant due to mid-century modern pedigree (Albert Frey, John Lautner, Richard Neutra, William Krisel, Donald Wexler), and culturally significant due to celebrity ownership history (Sinatra, Elvis, Disney, Hope, Kaufmann, Ball, McQueen).</p>
        </Section>

        <Section title="By the Numbers">
          <Stats items={[
            { n: '16,787', label: 'pedigree-classified Coachella Valley properties' },
            { n: '27',     label: 'verified A-tier dossiers (architect + celebrity primary sources)' },
            { n: '1,282',  label: 'B-tier (top neighborhood + mid-century era)' },
            { n: '11',     label: 'documented Palm Springs MCM architects' },
            { n: '13',     label: 'named luxury neighborhoods indexed' },
          ]} />
        </Section>

        <Section title="Sample Dossiers (live)">
          <DossierLink to="/dossier/504292010" name="Kaufmann Desert House" architect="Richard Neutra · 1946" note="Slim Aarons 'Poolside Gossip' was shot here" />
          <DossierLink to="/dossier/689100043" name="Sinatra Compound (Rancho Mirage)" architect="Frank Sinatra residence 1957–1995" note="JFK 1962 pre-presidential visit documented" />
          <DossierLink to="/dossier/510260033" name="Bob Hope House" architect="John Lautner · 1973" note="Hope commission, rebuilt after 1973 fire" />
          <DossierLink to="/dossier/508038001" name="Sinatra Twin Palms" architect="E. Stewart Williams · 1947" note="Piano-shaped pool; Sinatra residence 1947–1957" />
          <DossierLink to="/dossier/510250031" name="Elrod House" architect="John Lautner · 1968" note="Featured in James Bond's 'Diamonds Are Forever' (1971)" />
        </Section>

        <Section title="Methodology">
          <p>Every A-tier dossier requires <strong>primary source verification</strong>:</p>
          <ul style={{ paddingLeft: 18, lineHeight: 1.7 }}>
            <li><strong>Architect attribution:</strong> original drawings, building permits, period press features cross-referenced against architect commission lists</li>
            <li><strong>Celebrity ownership:</strong> verified deed history plus minimum two independent press references</li>
            <li><strong>Provenance events:</strong> film/press features cited to publication and year</li>
          </ul>
          <p>Sources include the Palm Springs Modernism Committee, Palm Springs Preservation Foundation, Palm Springs Art Museum Architecture and Design Center, UCLA Special Collections, UC Santa Barbara Architecture Library, Getty Research Institute, the John Lautner Foundation, and the National Register of Historic Places.</p>
        </Section>

        <Section title="Press Contact">
          <p>Dan Stuart · Founder<br />
            stuartteamps@gmail.com<br />
            Stuart Team Real Estate · Palm Springs, CA</p>
        </Section>

        <div style={{ marginTop: 40, padding: 28, background: 'linear-gradient(135deg, #1f2937 0%, #0f172a 100%)', borderRadius: 6, textAlign: 'center', border: '1px solid #334155' }}>
          <Link to="/pedigree-index" style={{ display: 'inline-block', padding: '14px 28px', background: '#fbbf24', color: '#0a0a0a', textDecoration: 'none', borderRadius: 4, fontWeight: 600, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
            Explore the Pedigree Index
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <section style={{ marginBottom: 44 }}>
      <h2 style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 16, fontWeight: 600 }}>{title}</h2>
      <div style={{ background: '#111827', padding: 26, borderRadius: 6, fontSize: 15, color: '#cbd5e1', lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </section>
  );
}

function Stats({ items }: { items: { n: string; label: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, padding: 0, margin: 0 }}>
      {items.map((s, i) => (
        <div key={i} style={{ borderLeft: '3px solid #fbbf24', paddingLeft: 14 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, color: '#fafafa', fontWeight: 400 }}>{s.n}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function DossierLink({ to, name, architect, note }: { to: string; name: string; architect: string; note: string }) {
  return (
    <Link to={to} style={{ display: 'block', padding: '12px 0', textDecoration: 'none', color: '#e5e7eb', borderBottom: '1px solid #1f2937' }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: '#fafafa' }}>{name}</div>
      <div style={{ fontSize: 13, color: '#fbbf24', marginTop: 4 }}>{architect}</div>
      <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>{note}</div>
    </Link>
  );
}
