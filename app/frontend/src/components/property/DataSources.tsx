// ─────────────────────────────────────────────────────────────────────────────
// DataSources — provenance transparency section. Renders p.dataSources grouped
// by category (Public record / Licensed data / User-provided / PropertyDNA
// analysis). This is what makes the page trustworthy to humans AND crawlers.
// ─────────────────────────────────────────────────────────────────────────────
import type { DataSourceGroup } from '@/lib/property-dna/publicProperty';
import { T, labelStyle } from './_shared';

export default function DataSources({ groups }: { groups: DataSourceGroup[] }) {
  if (!groups || groups.length === 0) {
    return <div style={{ fontFamily: T.sans, fontSize: 13, color: T.muted }}>Data unavailable.</div>;
  }

  return (
    <div>
      <p style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 300, color: 'rgba(240,235,224,0.6)', lineHeight: 1.7, margin: '0 0 20px', maxWidth: 640 }}>
        Every figure on this page is traceable. Below are the categories of data that fed this analysis — public
        records, licensed feeds, and PropertyDNA's own modeling — so you can judge the estimate on its evidence.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 1, background: T.border }}>
        {groups.map((g) => (
          <div key={g.category} style={{ background: T.bg, padding: '20px 22px' }}>
            <div style={{ ...labelStyle, color: T.gold, marginBottom: 12 }}>{g.category}</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {g.sources.map((src, i) => (
                <li key={i} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 300, color: T.cream, lineHeight: 1.7, display: 'flex', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: T.muted, flexShrink: 0 }}>—</span>
                  <span>{src}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
