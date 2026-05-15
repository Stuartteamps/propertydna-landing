import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const SLUG_MAP: Record<string, string> = {
  'albert-frey':         'Albert Frey',
  'john-lautner':        'John Lautner',
  'richard-neutra':      'Richard Neutra',
  'william-krisel':      'William Krisel',
  'donald-wexler':       'Donald Wexler',
  'e-stewart-williams':  'E. Stewart Williams',
  'hugh-kaptur':         'Hugh Kaptur',
  'william-f-cody':      'William F. Cody',
  'howard-lapham':       'Howard Lapham',
  'walter-s-white':      'Walter S. White',
  'charles-dubois':      'Charles DuBois',
};

export default function ArchitectProfile() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const name = slug ? SLUG_MAP[slug] : null;
  const [architect, setArchitect] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);

  useEffect(() => {
    if (!name) { navigate('/pedigree-index'); return; }
    (async () => {
      const { data: arch } = await supabase.from('architects').select('*').eq('name', name).maybeSingle();
      if (!arch) { navigate('/pedigree-index'); return; }
      setArchitect(arch);
      const { data: comms } = await supabase
        .from('architect_commissions')
        .select('apn, commission_year, attribution_strength, notes, property_master(address, city, provenance_score)')
        .eq('architect_id', arch.id);
      setCommissions(comms || []);

      // SEO
      document.title = `${arch.name} — Palm Springs MCM Architect | PropertyDNA`;
      const setMeta = (n: string, c: string, p = false) => {
        const a = p ? 'property' : 'name';
        let m = document.querySelector(`meta[${a}="${n}"]`);
        if (!m) { m = document.createElement('meta'); m.setAttribute(a, n); document.head.appendChild(m); }
        m.setAttribute('content', c);
      };
      const desc = `${arch.name} (${arch.birth_year}${arch.death_year ? `–${arch.death_year}` : '–present'}) — ${arch.verified_commissions || 'numerous'} documented commissions in Palm Springs. ${arch.primary_style}.`;
      setMeta('description', desc);
      setMeta('og:title', `${arch.name} — Palm Springs Architect`, true);
      setMeta('og:description', desc, true);
      setMeta('og:type', 'profile', true);
    })();
  }, [slug, name, navigate]);

  if (!architect) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": architect.name,
    "jobTitle": "Architect",
    "birthDate": architect.birth_year ? `${architect.birth_year}` : undefined,
    "deathDate": architect.death_year ? `${architect.death_year}` : undefined,
    "description": architect.bio,
    "knowsAbout": architect.primary_style,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '60px 24px' }}>

        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>
            Palm Springs Architect Profile
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 48, lineHeight: 1.1, margin: 0, fontWeight: 400, color: '#fafafa' }}>{architect.name}</h1>
          <div style={{ color: '#94a3b8', fontSize: 15, marginTop: 12 }}>
            {architect.birth_year}{architect.death_year ? `–${architect.death_year}` : '–present'} · {architect.primary_style} · <span style={{ color: '#fbbf24', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.5 }}>{architect.reputation_tier}</span>
          </div>
        </div>

        {architect.bio && (
          <div style={{ marginBottom: 40, background: '#111827', padding: 28, borderRadius: 6, borderLeft: '3px solid #fbbf24' }}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.65, color: '#cbd5e1', margin: 0 }}>{architect.bio}</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 40 }}>
          {architect.verified_commissions != null && <Stat label="Documented Works" value={architect.verified_commissions} />}
          {architect.trade_frequency_years != null && <Stat label="Trade Frequency" value={`~${architect.trade_frequency_years} yr`} />}
          {architect.primary_market && <Stat label="Primary Market" value={architect.primary_market} />}
        </div>

        {architect.archive_sources && architect.archive_sources.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 16, fontWeight: 600 }}>Verified Sources</h2>
            <div style={{ background: '#111827', padding: 20, borderRadius: 6, fontSize: 14, color: '#cbd5e1', lineHeight: 1.7 }}>
              {architect.archive_sources.join(' · ')}
            </div>
          </div>
        )}

        {commissions.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 16, fontWeight: 600 }}>Documented Commissions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {commissions.map((c, i) => (
                <Link key={i} to={`/dossier/${c.apn}`} style={{
                  background: '#111827', padding: 18, borderRadius: 6, textDecoration: 'none', color: '#e5e7eb',
                  borderLeft: '3px solid #fbbf24',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: '#fafafa' }}>{c.property_master?.address}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{c.property_master?.city}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#fbbf24' }}>
                      {c.commission_year} · {c.attribution_strength}
                    </div>
                  </div>
                  {c.notes && <div style={{ marginTop: 8, fontSize: 13, color: '#cbd5e1', fontStyle: 'italic' }}>{c.notes}</div>}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <Link to="/pedigree-index" style={{ padding: '14px 28px', background: '#fbbf24', color: '#0a0a0a', textDecoration: 'none', borderRadius: 4, fontWeight: 600, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
            Full Pedigree Index
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ background: '#111827', padding: 18, borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: '#fbbf24', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 17, color: '#fafafa' }}>{value}</div>
    </div>
  );
}
