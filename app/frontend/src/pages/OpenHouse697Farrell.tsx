/**
 * Open house landing — 697 N Farrell Drive, Palm Springs
 * Open Sun 6/7 11 AM – 1 PM. QR-friendly, mobile-first layout.
 */
const FACTS = [
  { label: 'Beds',      value: '4' },
  { label: 'Baths',     value: '3 full' },
  { label: 'Sq Ft',     value: '1,360 + casita' },
  { label: 'Lot',       value: '18,077 sqft  ·  0.415 ac' },
  { label: 'Built',     value: '1960 — Jack Meiselman' },
  { label: 'Pool',      value: 'Yes — Gunite, private' },
  { label: 'Furnished', value: 'Yes — turnkey' },
  { label: 'STR',       value: 'Permitted' },
  { label: 'HOA',       value: 'None' },
  { label: 'APN',       value: '507372001' },
];

const HIGHLIGHTS = [
  'Fully remodeled mid-century — Jack Meiselman architecture, Sunrise Park',
  'Sprawling corner lot with sweeping desert + mountain views',
  'Detached casita with private bath — guest suite or rental income',
  'Quartz kitchen, custom 48-in tile floors, floor-to-ceiling glass',
  'Gunite pool, fire pit, bocce, cornhole — full backyard resort',
  'Short-term rental permitted, vacant, ready for immediate close',
];

const COMPS = [
  {
    address: '1890 E Amado Rd',
    city:    'Palm Springs',
    price:   '$1,285,000',
    specs:   '3 bed · 2 bath · pool',
    angle:   'Open this weekend — similar buyer profile, move-in ready.',
  },
  {
    address: '3450 E Chia Rd',
    city:    'Palm Springs',
    price:   '$1,075,000',
    specs:   '3 bed · 2 bath',
    angle:   'Value play vs Farrell — Palm Springs without crossing into luxury.',
  },
  {
    address: '2109 E Paseo Gracia',
    city:    'Palm Springs',
    price:   '$1,200,000',
    specs:   '3 bed · 2 bath',
    angle:   'Easy comparison if buyers like Farrell’s size + lifestyle.',
  },
];

const BASE = '/listings/697-farrell';

export default function OpenHouse697Farrell() {
  return (
    <div style={{ background: '#0a0a0a', color: '#e5e7eb', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>

        {/* Header band */}
        <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1f2937', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#fbbf24', fontWeight: 600 }}>
          <span>The Stuart Team · Coldwell Banker</span>
          <span style={{ color: '#94a3b8', letterSpacing: 1 }}>MLS# 219147697</span>
        </div>

        {/* Open house banner */}
        <div style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', color: '#0a0a0a', padding: '16px 24px', fontWeight: 700, letterSpacing: 1, fontSize: 14, textTransform: 'uppercase', textAlign: 'center' }}>
          OPEN SUNDAY · JUNE 7 · 11 AM – 1 PM · BY APPOINTMENT ALSO
        </div>

        {/* Hero */}
        <div style={{ position: 'relative' }}>
          <img src={`${BASE}/front.jpg`} alt="697 N Farrell Drive — front exterior" style={{ width: '100%', display: 'block', maxHeight: 520, objectFit: 'cover' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '24px 28px 26px', background: 'linear-gradient(to top, rgba(0,0,0,0.92), rgba(0,0,0,0))' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 36, color: '#fafafa', lineHeight: 1.15 }}>697 N Farrell Drive</div>
            <div style={{ fontSize: 14, color: '#cbd5e1', marginTop: 4 }}>Palm Springs · Sunrise Park · 92262</div>
            <div style={{ marginTop: 12, fontSize: 26, color: '#fbbf24', fontWeight: 600 }}>$1,100,000</div>
          </div>
        </div>

        {/* Highlights */}
        <section style={{ padding: '36px 24px 4px' }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', fontWeight: 600 }}>The Story</div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, margin: '10px 0 18px', color: '#fafafa', fontWeight: 400, lineHeight: 1.3 }}>
            Mid-century legacy. Modern luxury. Sunrise Park.
          </h2>
          <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 1.75, color: '#cbd5e1' }}>
            {HIGHLIGHTS.map(h => <li key={h} style={{ marginBottom: 6 }}>{h}</li>)}
          </ul>
        </section>

        {/* Facts grid */}
        <section style={{ padding: '24px 24px' }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', fontWeight: 600, marginBottom: 14 }}>The Facts</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {FACTS.map(f => (
              <div key={f.label} style={{ background: '#111827', padding: '14px 16px', borderRadius: 6, borderLeft: '3px solid #fbbf24' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontSize: 15, color: '#fafafa', fontWeight: 500 }}>{f.value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Gallery — clean property shot only */}
        <section style={{ padding: '24px' }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', fontWeight: 600, marginBottom: 14 }}>The Backyard</div>
          <img
            src={`${BASE}/back.jpg`}
            alt="Backyard with pool, fire pit, patio, and detached casita"
            style={{ width: '100%', display: 'block', borderRadius: 6, objectFit: 'cover', maxHeight: 520 }}
          />
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10, textAlign: 'center', fontStyle: 'italic' }}>
            Gunite pool, fire pit, patio dining, and detached casita beyond — full backyard resort.
          </div>
        </section>

        {/* Marketing narrative */}
        <section style={{ padding: '24px 24px 36px', color: '#cbd5e1', fontSize: 15, lineHeight: 1.75 }}>
          In the heart of Palm Springs, where mid-century design meets modern luxury, lies an extraordinary opportunity — a property that evokes the spirit of Palm Springs&rsquo; architectural legacy and offers a solid investment in one of the most coveted neighborhoods in the city.
          <br /><br />
          Welcome to 697 N Farrell Drive: a fully remodeled, sprawling 4-bedroom, 3-bath home in the iconic Sunrise Park neighborhood, designed by renowned architect <em>Jack Meiselman</em>. Set on an expansive lot with sweeping desert and mountain views, the property pairs crisp mid-century lines with quartz counters, custom 48&Prime; tile, and floor-to-ceiling glass that pours natural light across the open floor plan.
          <br /><br />
          The backyard is a private resort — gunite pool, fire pit, bocce court, cornhole, and a detached casita with its own bathroom. Vacant, furnished, short-term-rental permitted, and ready for immediate close.
        </section>

        {/* Backup options — 3 comps */}
        <section style={{ padding: '8px 24px 36px' }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Also Worth Seeing This Weekend</div>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 18px' }}>Three more Palm Springs homes I can show you the same day — different price points, same lifestyle.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {COMPS.map(c => (
              <div key={c.address} style={{ background: '#111827', padding: 20, borderRadius: 6, borderLeft: '3px solid #a78bfa' }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#fafafa' }}>{c.address}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{c.city}</div>
                <div style={{ fontSize: 18, color: '#fbbf24', marginTop: 12, fontWeight: 600 }}>{c.price}</div>
                <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 6 }}>{c.specs}</div>
                <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 12, lineHeight: 1.5 }}>{c.angle}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA — co-listing agents */}
        <section style={{ padding: '32px 24px 36px', background: 'linear-gradient(135deg, #1f2937 0%, #0f172a 100%)', borderTop: '1px solid #1f2937', borderBottom: '1px solid #1f2937' }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', fontWeight: 600, textAlign: 'center', marginBottom: 6 }}>Co-Listed By</div>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 22, margin: '0 0 24px', color: '#fafafa', fontWeight: 400, textAlign: 'center' }}>
            Schedule a private showing
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {/* Dan */}
            <div style={{ background: '#0a0a0a', borderRadius: 8, padding: 22, border: '1px solid #1f2937', textAlign: 'center' }}>
              <img
                src={`${BASE}/agent-dan.jpg`}
                alt="Dan Stuart"
                style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top', border: '2px solid #fbbf24', display: 'block', margin: '0 auto 14px' }}
              />
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 19, color: '#fafafa' }}>Dan Stuart</div>
              <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>Coldwell Banker</div>
              <div style={{ marginTop: 16, fontSize: 14, color: '#cbd5e1', lineHeight: 1.8 }}>
                <a href="tel:6196770900" style={{ color: '#fbbf24', textDecoration: 'none', display: 'block' }}>C&nbsp;&nbsp;619.677.0900</a>
                <a href="mailto:stuartteamps@gmail.com?subject=697%20N%20Farrell%20%E2%80%94%20showing%20request" style={{ color: '#cbd5e1', textDecoration: 'none', display: 'block', fontSize: 13 }}>stuartteamps@gmail.com</a>
                <div style={{ color: '#64748b', fontSize: 11, marginTop: 6 }}>DRE# 02043742</div>
              </div>
            </div>
            {/* Christopher */}
            <div style={{ background: '#0a0a0a', borderRadius: 8, padding: 22, border: '1px solid #1f2937', textAlign: 'center' }}>
              <img
                src={`${BASE}/agent-christopher.png`}
                alt="Christopher Kreiling"
                style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top', border: '2px solid #fbbf24', display: 'block', margin: '0 auto 14px' }}
              />
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 19, color: '#fafafa' }}>Christopher Kreiling</div>
              <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>Compass</div>
              <div style={{ marginTop: 16, fontSize: 14, color: '#cbd5e1', lineHeight: 1.8 }}>
                <a href="tel:3236521891" style={{ color: '#fbbf24', textDecoration: 'none', display: 'block' }}>C&nbsp;&nbsp;323.652.1891</a>
                <a href="tel:7603235000" style={{ color: '#94a3b8', textDecoration: 'none', display: 'block', fontSize: 13 }}>O&nbsp;&nbsp;760.323.5000</a>
                <a href="mailto:christopher.kreiling@gmail.com?subject=697%20N%20Farrell%20%E2%80%94%20showing%20request" style={{ color: '#cbd5e1', textDecoration: 'none', display: 'block', fontSize: 13 }}>christopher.kreiling@gmail.com</a>
                <div style={{ color: '#64748b', fontSize: 11, marginTop: 6 }}>DRE# 02223591</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 26, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
            Want the full DNA report on 697 Farrell or any home? Free at <a href="https://thepropertydna.com/?utm_source=open_house&utm_campaign=697_farrell" style={{ color: '#fbbf24' }}>thepropertydna.com</a>.
          </div>
        </section>

        {/* Footer */}
        <div style={{ padding: '18px 24px 36px', textAlign: 'center', color: '#64748b', fontSize: 11, lineHeight: 1.7 }}>
          Dan Stuart · Coldwell Banker · DRE #02043742<br />
          Christopher Kreiling · Compass · DRE #02223591<br />
          Information deemed reliable but not guaranteed. © 2026 MLS & FBS.
        </div>
      </div>
    </div>
  );
}
