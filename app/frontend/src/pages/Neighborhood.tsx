import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

// slug → canonical display name
const SLUG_MAP: Record<string, string> = {
  'movie-colony':           'Movie Colony',
  'old-las-palmas':         'Old Las Palmas',
  'las-palmas':             'Las Palmas',
  'vista-las-palmas':       'Vista Las Palmas',
  'the-mesa':               'The Mesa',
  'indian-canyons':         'Indian Canyons',
  'smoke-tree-ranch':       'Smoke Tree Ranch',
  'tahquitz-river-estates': 'Tahquitz River Estates',
  'racquet-club-estates':   'Racquet Club Estates',
  'twin-palms':             'Twin Palms',
  'thunderbird-heights':    'Thunderbird Heights',
  'tamarisk-country-club':  'Tamarisk Country Club',
  'mission-hills':          'Mission Hills',
};

const HOOD_STORIES: Record<string, string> = {
  'movie-colony': 'The historic Movie Colony neighborhood in Palm Springs has hosted Frank Sinatra, Elvis Presley, Marilyn Monroe, Liberace, and Cary Grant. Its winding streets — Alejo, Tamarisk, Hermosa, Patencio — contain some of the most photographed mid-century modern estates in California.',
  'old-las-palmas': 'Old Las Palmas, between Tahquitz Canyon and Alejo, was the original celebrity refuge of mid-century Palm Springs. Streets like Belardo, Via Lola, and Via Miraleste host estates owned by Kirk Douglas, Cary Grant, Liberace, and Dinah Shore.',
  'vista-las-palmas': 'Vista Las Palmas, developed by Alexander Construction Company with William Krisel as architect, contains some of the most iconic butterfly-roof homes in America. Elvis Presley honeymooned here in 1967 at the famous "House of Tomorrow" on Ladera Circle.',
  'the-mesa': 'The Mesa, perched in the foothills of the San Jacinto Mountains, has hosted Hollywood elite for decades. Its winding canyon roads and dramatic boulder-integrated architecture (including Albert Frey\'s own residence Frey House II) define modernist Palm Springs.',
  'indian-canyons': 'Indian Canyons in south Palm Springs is home to dramatic hillside modernist commissions including the Elrod House by John Lautner — featured in the James Bond film "Diamonds Are Forever" — and Bob Hope\'s Lautner-designed estate.',
  'smoke-tree-ranch': 'Smoke Tree Ranch was Walt Disney\'s winter retreat from 1948 to 1966. The gated equestrian-rancho community remains one of the most exclusive enclaves in the Coachella Valley.',
  'thunderbird-heights': 'Thunderbird Heights in Rancho Mirage is anchored by the Frank Sinatra Compound at 70588 Frank Sinatra Drive, where Sinatra entertained JFK in 1962 and hosted three decades of Hollywood and political elite.',
  'racquet-club-estates': 'Racquet Club Estates, developed by Charlie Farrell and Ralph Bellamy in the 1930s, was the original celebrity playground of Palm Springs. It evolved into a William Krisel-designed mid-century enclave.',
  'twin-palms': 'Twin Palms, named after Frank Sinatra\'s 1947 E. Stewart Williams-designed residence at 1148 East Alejo Road, contains many of the earliest mid-century modern commissions in Palm Springs.',
  'tahquitz-river-estates': 'Tahquitz River Estates contains many original mid-century commissions by E. Stewart Williams, Walter S. White, and Donald Wexler — including the famous Wexler Steel Houses on Sunny View Drive, National Register listed.',
  'tamarisk-country-club': 'Tamarisk Country Club in Rancho Mirage has been the desert home of Dean Martin, Howard Hughes, and many Rat Pack-era celebrities. The community surrounds the historic 1952 Tamarisk Country Club.',
  'mission-hills': 'Mission Hills in Rancho Mirage hosted Gene Autry, who lived here from 1956 until his passing in 1998. The community features expansive desert estates, championship golf, and curated mid-century homes.',
  'las-palmas': 'Las Palmas, the original celebrity district north of downtown Palm Springs, contains some of the area\'s most architecturally significant estates. Many original Tom Eyre-developed homes remain.',
};

export default function Neighborhood() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const name = slug ? SLUG_MAP[slug] : null;
  const story = slug ? HOOD_STORIES[slug] : null;
  const [stats, setStats] = useState<{ total: number; tiers: Record<string, number>; topDossiers: any[]; architects: string[] } | null>(null);

  useEffect(() => {
    if (!name) { navigate('/luxury-inventory'); return; }
    (async () => {
      const enc = encodeURIComponent(name);
      const [props, dossiers, architects] = await Promise.all([
        supabase.from('property_master').select('apn,pedigree_tier').eq('pedigree_neighborhood', name).limit(2000),
        supabase.from('property_master').select('apn,address,city,architect_attribution,provenance_score,pedigree_tier').eq('pedigree_neighborhood', name).eq('has_provenance_dossier', true).order('provenance_score', { ascending: false }).limit(6),
        supabase.from('property_master').select('architect_attribution').eq('pedigree_neighborhood', name).eq('architect_verified', true).limit(50),
      ]);
      const tiers: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
      (props.data || []).forEach((p: any) => { if (p.pedigree_tier && tiers[p.pedigree_tier] != null) tiers[p.pedigree_tier]++; });
      const archSet = Array.from(new Set((architects.data || []).map((a: any) => a.architect_attribution).filter(Boolean)));
      setStats({ total: props.data?.length || 0, tiers, topDossiers: dossiers.data || [], architects: archSet });

      // SEO meta
      document.title = `${name} — Palm Springs Pedigree Index | PropertyDNA`;
      const setMeta = (n: string, c: string, p = false) => {
        const a = p ? 'property' : 'name';
        let m = document.querySelector(`meta[${a}="${n}"]`);
        if (!m) { m = document.createElement('meta'); m.setAttribute(a, n); document.head.appendChild(m); }
        m.setAttribute('content', c);
      };
      setMeta('description', `Pedigree-classified properties in ${name}, Palm Springs — verified celebrity provenance and architect attribution.`);
      setMeta('og:title', `${name} — Palm Springs Pedigree Index`, true);
      setMeta('og:description', `${props.data?.length || 0} pedigree-classified properties in ${name}.`, true);
      setMeta('og:type', 'website', true);
    })();
  }, [slug, name, navigate]);

  if (!name) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 24px' }}>

        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>
            Palm Springs Pedigree Index — Neighborhood Profile
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 48, lineHeight: 1.1, margin: 0, fontWeight: 400, color: '#fafafa' }}>{name}</h1>
          {stats && (
            <div style={{ color: '#94a3b8', fontSize: 15, marginTop: 16 }}>
              {stats.total.toLocaleString()} pedigree-classified properties
              {stats.architects.length > 0 ? ` · architects: ${stats.architects.join(', ')}` : ''}
            </div>
          )}
        </div>

        {story && (
          <div style={{ marginBottom: 44, background: '#111827', padding: 28, borderRadius: 6, borderLeft: '3px solid #fbbf24' }}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.65, color: '#cbd5e1', margin: 0 }}>{story}</p>
          </div>
        )}

        {stats && (
          <section style={{ marginBottom: 44 }}>
            <h2 style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 18, fontWeight: 600 }}>Tier Breakdown</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {(['A', 'B', 'C', 'D'] as const).map(t => (
                <div key={t} style={{ background: '#111827', padding: 18, borderRadius: 6, borderTop: `3px solid ${({ A: '#fbbf24', B: '#a78bfa', C: '#60a5fa', D: '#34d399' })[t]}` }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: '#fafafa' }}>{stats.tiers[t].toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, letterSpacing: 1 }}>TIER {t}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {stats?.topDossiers && stats.topDossiers.length > 0 && (
          <section style={{ marginBottom: 44 }}>
            <h2 style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 18, fontWeight: 600 }}>Verified Dossiers in {name}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              {stats.topDossiers.map((d: any) => (
                <Link key={d.apn} to={`/dossier/${d.apn}`} style={{
                  background: '#111827', padding: 20, borderRadius: 6,
                  borderLeft: `3px solid ${({ A: '#fbbf24', B: '#a78bfa' } as Record<string, string>)[d.pedigree_tier] || '#475569'}`,
                  textDecoration: 'none', color: '#e5e7eb',
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 6 }}>
                    {d.pedigree_tier} · {d.provenance_score}/100
                  </div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: '#fafafa', lineHeight: 1.3 }}>{d.address}</div>
                  {d.architect_attribution && <div style={{ fontSize: 12, color: '#fbbf24', fontStyle: 'italic', marginTop: 6 }}>{d.architect_attribution}</div>}
                </Link>
              ))}
            </div>
          </section>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 32 }}>
          <Link to={`/luxury-inventory?neighborhood=${encodeURIComponent(name)}`} style={{ padding: '14px 28px', background: '#fbbf24', color: '#0a0a0a', textDecoration: 'none', borderRadius: 4, fontWeight: 600, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
            Browse all {name} properties →
          </Link>
          <Link to="/pedigree-index" style={{ padding: '14px 28px', background: 'transparent', color: '#fbbf24', border: '1px solid #fbbf24', textDecoration: 'none', borderRadius: 4, fontWeight: 600, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
            Full Pedigree Index
          </Link>
        </div>
      </div>
    </div>
  );
}
