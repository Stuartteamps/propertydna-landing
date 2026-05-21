import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function PressRelease() {
  const [stats, setStats] = useState({ classified: 16787, dossiers: 53, neighborhoods: 13, architects: 11 });

  useEffect(() => {
    document.title = 'For Immediate Release — PropertyDNA Launches Coachella Valley Pedigree Index';
    (async () => {
      const [c, d, a] = await Promise.all([
        supabase.from('property_master').select('apn', { count: 'exact', head: true }).not('pedigree_tier', 'is', null),
        supabase.from('property_master').select('apn', { count: 'exact', head: true }).eq('pedigree_tier', 'A'),
        supabase.from('architects').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        classified: c.count || 16787,
        dossiers: d.count || 53,
        neighborhoods: 13,
        architects: a.count || 11,
      });
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '60px 24px' }}>

        <div style={{ marginBottom: 28 }}>
          <Link to="/press" style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none' }}>← Press Kit</Link>
        </div>

        <div style={{ background: '#111827', padding: '40px 36px', borderRadius: 6, border: '1px solid #1f2937' }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 14, fontWeight: 600 }}>For Immediate Release</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 30, color: '#fafafa', margin: '0 0 22px', fontWeight: 400, lineHeight: 1.2 }}>
            PropertyDNA Launches Coachella Valley Pedigree Index — Verified Provenance Dossiers for {stats.dossiers}+ Luxury Estates
          </h1>

          <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 28 }}>
            PALM SPRINGS, CA — PropertyDNA today announced the launch of the Coachella Valley Pedigree Index, a systematic A/B/C/D classification of {stats.classified.toLocaleString()} properties spanning Palm Springs, Rancho Mirage, Palm Desert, Indian Wells, La Quinta, and surrounding communities.
          </div>

          <div style={{ fontSize: 15, color: '#cbd5e1', lineHeight: 1.7, marginBottom: 18 }}>
            The platform applies Barrett-Jackson-grade documentation methodology to architecturally and culturally significant residential real estate, generating verified provenance dossiers for {stats.dossiers} A-tier estates including the Kaufmann Desert House (Richard Neutra, 1946), the Frank Sinatra Compound at 70588 Frank Sinatra Drive, Elvis Presley's Honeymoon Hideaway, Bob Hope's John Lautner-designed residence, and the Elrod House — featured in the 1971 James Bond film <em>Diamonds Are Forever</em>.
          </div>

          <div style={{ fontSize: 15, color: '#cbd5e1', lineHeight: 1.7, marginBottom: 18 }}>
            "A $50,000 Patek Philippe ships with verified provenance papers," said Dan Stuart, founder of PropertyDNA. "A $50 million architectural estate typically doesn't. We built the documentation layer the auction houses charge 15% for — verified celebrity ownership against deed records, architect attribution against archive drawings, and primary source citations on every claim."
          </div>

          <div style={{ fontSize: 15, color: '#cbd5e1', lineHeight: 1.7, marginBottom: 18 }}>
            The Pedigree Index documents {stats.architects} Palm Springs mid-century modern architects — Albert Frey, John Lautner, Richard Neutra, William Krisel, Donald Wexler, E. Stewart Williams, Hugh Kaptur, William F. Cody, Howard Lapham, Walter S. White, and Charles DuBois — with verified commission counts and primary source archives from the Palm Springs Modernism Committee, Palm Springs Preservation Foundation, UCLA Special Collections, UC Santa Barbara Architecture Library, and the John Lautner Foundation.
          </div>

          <div style={{ fontSize: 15, color: '#cbd5e1', lineHeight: 1.7, marginBottom: 18 }}>
            {stats.neighborhoods} named luxury neighborhoods have been systematically indexed, including Movie Colony (1,449 properties), Old Las Palmas (903), Vista Las Palmas (477), Indian Canyons (278), Thunderbird Heights (133), and Smoke Tree Ranch (82 — formerly Walt Disney's winter retreat).
          </div>

          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#fafafa', margin: '32px 0 14px', fontWeight: 400 }}>About PropertyDNA</h2>
          <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.7 }}>
            PropertyDNA is the luxury home provenance intelligence platform serving the Coachella Valley. It combines county assessor data, MLS records, permit history, and primary source archives to generate institutional-grade dossiers for $5M+ architecturally significant residential real estate. The platform is publicly browsable at <a href="https://www.thepropertydna.com" style={{ color: '#fbbf24' }}>thepropertydna.com</a>.
          </div>

          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#fafafa', margin: '32px 0 14px', fontWeight: 400 }}>Media Contact</h2>
          <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.7 }}>
            Dan Stuart, Founder<br />
            stuartteamps@gmail.com<br />
            <a href="https://www.thepropertydna.com/press" style={{ color: '#fbbf24' }}>thepropertydna.com/press</a>
          </div>

          <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid #1f2937', fontSize: 12, color: '#64748b' }}>
            ###
          </div>
        </div>

        <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => {
            const text = document.querySelector('[data-press-text]')?.textContent || '';
            navigator.clipboard?.writeText(window.location.href);
            alert('Press release URL copied to clipboard');
          }} style={{ padding: '12px 22px', background: '#fbbf24', color: '#0a0a0a', border: 'none', borderRadius: 4, fontWeight: 600, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}>
            Copy URL
          </button>
          <Link to="/press" style={{ padding: '12px 22px', background: 'transparent', color: '#fbbf24', border: '1px solid #fbbf24', borderRadius: 4, fontWeight: 600, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', textDecoration: 'none' }}>
            Full Press Kit
          </Link>
        </div>
      </div>
    </div>
  );
}
