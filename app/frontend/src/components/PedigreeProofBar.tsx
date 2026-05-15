import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function PedigreeProofBar() {
  const [stats, setStats] = useState({ classified: 0, dossiers: 0, architects: 0, neighborhoods: 0 });

  useEffect(() => {
    (async () => {
      const [c, d, a] = await Promise.all([
        supabase.from('property_master').select('apn', { count: 'exact', head: true }).not('pedigree_tier', 'is', null),
        supabase.from('property_master').select('apn', { count: 'exact', head: true }).eq('pedigree_tier', 'A'),
        supabase.from('architects').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        classified: c.count || 16787,
        dossiers: d.count || 53,
        architects: a.count || 11,
        neighborhoods: 13,
      });
    })();
  }, []);

  return (
    <div style={{
      background: 'rgba(10,10,10,0.92)',
      borderTop: '1px solid rgba(251,191,36,0.25)',
      borderBottom: '1px solid rgba(251,191,36,0.25)',
      padding: '14px 24px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 16, alignItems: 'center', fontFamily: '-apple-system, sans-serif' }}>
        <Stat n={stats.classified.toLocaleString()} label="properties pedigree-classified" />
        <Divider />
        <Stat n={stats.dossiers.toLocaleString()} label="verified dossiers" />
        <Divider />
        <Stat n={stats.architects} label="documented architects" />
        <Divider />
        <Stat n={stats.neighborhoods} label="named neighborhoods" />
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: string | number; label: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 120 }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#fbbf24', lineHeight: 1.1, fontWeight: 400 }}>{n}</div>
      <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>{label}</div>
    </div>
  );
}
function Divider() { return <div style={{ width: 1, height: 30, background: 'rgba(251,191,36,0.2)' }} aria-hidden="true" />; }
