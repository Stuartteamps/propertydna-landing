import React from 'react';

interface Props {
  dna: any;
  comps?: any[];
}

// Priority: 1=Manual override, 2=MLS/IDX, 3=Property API, 4=AI extraction, 5=Fallback
const SOURCE_PRIORITY_LABEL: Record<string, string> = {
  manual: 'Manual Override',
  mls: 'MLS/IDX',
  api: 'Property API',
  ai: 'AI Extracted',
  fallback: 'Assumption',
};

function AdjRow({ label, value, adjustment, source, confidence }: {
  label: string;
  value: string;
  adjustment?: string;
  source?: string;
  confidence?: string;
}) {
  const isPositive = adjustment?.startsWith('+');
  const isNegative = adjustment?.startsWith('-');
  const adjColor = isPositive ? '#2D6A4F' : isNegative ? '#A07850' : '#6B6252';

  return (
    <tr>
      <td style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#F0EBE0', padding: '10px 16px 10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{label}</td>
      <td style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 15, color: '#F0EBE0', padding: '10px 16px 10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{value}</td>
      <td style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: adjColor, padding: '10px 16px 10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{adjustment || '—'}</td>
      <td style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: '#6B6252', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', letterSpacing: '0.5px' }}>
        {source ? (SOURCE_PRIORITY_LABEL[source] || source) : '—'}
        {confidence && <span style={{ marginLeft: 8, color: 'rgba(107,98,82,0.5)' }}>{confidence}</span>}
      </td>
    </tr>
  );
}

const th: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
  color: '#6B6252', textAlign: 'left', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)',
};

function fmt(v: any) { return v && v !== '—' ? String(v) : '—'; }

export const AdjustmentFactorPanel: React.FC<Props> = ({ dna, comps = [] }) => {
  const n = dna?.normalized ?? {};
  const prop = n.property ?? {};
  const val = n.valuation ?? {};
  const sale = n.sale ?? {};
  const sub = n.subject ?? {};
  const mlsData = dna?.mlsData ?? {};

  // Build the adjustment rows from available data
  // MLS data takes priority over AI/existing data
  const rows = [
    {
      label: 'Property Type',
      value: fmt(mlsData.property_type || prop.propertyType),
      source: mlsData.property_type ? 'mls' : 'ai',
    },
    {
      label: 'Year Built',
      value: fmt(mlsData.year_built || prop.yearBuilt),
      source: mlsData.year_built ? 'mls' : 'ai',
    },
    {
      label: 'Beds / Baths',
      value: `${fmt(mlsData.beds || prop.beds)} / ${fmt(mlsData.baths || prop.baths)}`,
      source: mlsData.beds ? 'mls' : 'ai',
    },
    {
      label: 'GLA (sqft)',
      value: prop.sqft && prop.sqft !== '—' ? `${Number(mlsData.sqft || prop.sqft).toLocaleString()} sqft` : '—',
      source: mlsData.sqft ? 'mls' : 'ai',
    },
    {
      label: 'Lot Size',
      value: prop.lotSize && prop.lotSize !== '—' ? `${Number(mlsData.lot_sqft || prop.lotSize).toLocaleString()} sqft` : '—',
      source: mlsData.lot_sqft ? 'mls' : 'ai',
    },
    {
      label: 'Pool',
      value: mlsData.pool != null ? (mlsData.pool ? 'Yes' : 'No') : fmt(n.pool),
      source: mlsData.pool != null ? 'mls' : 'ai',
    },
    {
      label: 'Views',
      value: fmt(mlsData.views || n.views),
      source: mlsData.views ? 'mls' : 'ai',
    },
    {
      label: 'Golf Frontage',
      value: mlsData.golf_course != null ? (mlsData.golf_course ? 'Yes' : 'No') : '—',
      source: mlsData.golf_course != null ? 'mls' : 'fallback',
    },
    {
      label: 'Waterfront',
      value: mlsData.waterfront != null ? (mlsData.waterfront ? 'Yes' : 'No') : '—',
      source: mlsData.waterfront != null ? 'mls' : 'fallback',
    },
    {
      label: 'Remodeled',
      value: mlsData.remodeled != null ? (mlsData.remodeled ? 'Yes' : 'No') : '—',
      source: mlsData.remodeled != null ? 'mls' : 'fallback',
    },
    {
      label: 'Last Sale',
      value: `${fmt(sale.lastSaleDate?.slice?.(0, 10))} · ${fmt(sale.lastSalePrice)}`,
      source: 'api',
    },
    {
      label: 'Valuation Method',
      value: fmt(val.method || 'Hybrid AVM + CMA'),
      source: 'api',
    },
    {
      label: 'Confidence',
      value: fmt(val.confidence || dna.confidence),
      source: 'api',
    },
  ];

  const hasComps = comps.length > 0;

  return (
    <div>
      {/* Adjustment table */}
      <div style={{ marginBottom: 32, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Factor</th>
              <th style={th}>Value</th>
              <th style={th}>Adjustment</th>
              <th style={th}>Data Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.filter(r => r.value !== '—').map(r => (
              <AdjRow key={r.label} label={r.label} value={r.value} source={r.source} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Data source priority legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', alignSelf: 'center' }}>
          Source Priority:
        </div>
        {[
          ['Manual Override', '1', '#C9A84C'],
          ['MLS/IDX', '2', '#74C69D'],
          ['Property API', '3', '#95D5B2'],
          ['AI Extracted', '4', '#6B6252'],
          ['Assumption', '5', '#4A3F33'],
        ].map(([label, num, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 16, background: color as string, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Jost, sans-serif', fontSize: 8, color: '#fff', fontWeight: 600 }}>
              {num}
            </div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: '#6B6252' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Comp grid summary */}
      {hasComps && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 12 }}>
            Comparable Analysis ({comps.length} comps used)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: '0 40px' }}>
            {[
              ['Avg Comp Price', comps.length ? `$${Math.round(comps.reduce((s, c) => s + (c.rawPrice || 0), 0) / comps.length).toLocaleString()}` : '—'],
              ['Price Range', comps.length ? `$${Math.min(...comps.map(c => c.rawPrice || 0)).toLocaleString()} – $${Math.max(...comps.map(c => c.rawPrice || 0)).toLocaleString()}` : '—'],
              ['Avg Distance', comps.length ? comps[0].distance || '—' : '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 300, color: '#F0EBE0' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
