import type { HeatFilterWeights } from '@/types/heatmap';

interface Props {
  weights: HeatFilterWeights;
  onChange: (w: HeatFilterWeights) => void;
}

const SLIDERS: { key: keyof HeatFilterWeights; label: string; desc: string }[] = [
  { key: 'comps',        label: 'Comparable Sales', desc: 'Similarity to recent closed sales' },
  { key: 'priceDelta',   label: 'Price Delta',       desc: 'Distance from market median' },
  { key: 'dom',          label: 'Days on Market',    desc: 'Velocity vs. neighborhood avg' },
  { key: 'permits',      label: 'Permit Activity',   desc: 'Recent renovation momentum' },
  { key: 'livability',   label: 'Livability',        desc: 'Location quality score' },
  { key: 'rentalDemand', label: 'Rental Demand',     desc: 'STR + LTR occupancy signals' },
];

const RESET: HeatFilterWeights = { comps: 0.2, priceDelta: 0.2, dom: 0.15, permits: 0.15, livability: 0.15, rentalDemand: 0.15 };

export default function FilterPanel({ weights, onChange }: Props) {
  return (
    <div style={{
      background: 'rgba(10,9,8,0.94)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(184,147,85,0.25)', borderRadius: 12,
      padding: '18px 20px', width: 270, fontFamily: 'Jost, sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B89355', fontWeight: 500 }}>
          Score Weights
        </span>
        <span style={{ flex: 1, height: 1, background: 'rgba(184,147,85,0.2)' }} />
        <button onClick={() => onChange(RESET)}
          style={{ fontSize: 9, color: '#6B6252', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
          reset
        </button>
      </div>

      {SLIDERS.map(({ key, label, desc }) => (
        <div key={key} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 11, color: '#F4F0E8', fontWeight: 500 }}>{label}</span>
            <span style={{ fontSize: 10, color: '#B89355', fontWeight: 600 }}>{Math.round(weights[key] * 100)}%</span>
          </div>
          <p style={{ fontSize: 9, color: '#6B6252', margin: '0 0 4px', lineHeight: 1.4 }}>{desc}</p>
          <input type="range" min={0} max={40} step={1}
            value={Math.round(weights[key] * 100)}
            onChange={e => onChange({ ...weights, [key]: Number(e.target.value) / 100 })}
            style={{ width: '100%', accentColor: '#B89355', cursor: 'pointer' }}
          />
        </div>
      ))}

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(107,98,82,0.3)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, color: '#6B6252' }}>Total weight</span>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: Math.abs(Object.values(weights).reduce((a, b) => a + b, 0) - 1) < 0.05 ? '#22c55e' : '#f97316',
        }}>
          {Math.round(Object.values(weights).reduce((a, b) => a + b, 0) * 100)}%
        </span>
      </div>
    </div>
  );
}
