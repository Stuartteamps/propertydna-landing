import React from 'react';
import type { FilterWeights } from '../types';

interface Props {
  weights: FilterWeights;
  onChange: (w: FilterWeights) => void;
}

const LABELS: { key: keyof FilterWeights; label: string; desc: string }[] = [
  { key: 'comps',        label: 'Comparable Sales', desc: 'Similarity to recent closed sales' },
  { key: 'priceDelta',   label: 'Price Delta',       desc: 'Distance from market median' },
  { key: 'dom',          label: 'Days on Market',    desc: 'Velocity vs. neighborhood avg' },
  { key: 'permits',      label: 'Permit Activity',   desc: 'Recent renovation momentum' },
  { key: 'livability',   label: 'Livability',        desc: 'Walkability, schools, amenities' },
  { key: 'rentalDemand', label: 'Rental Demand',     desc: 'STR + LTR occupancy signals' },
];

export default function FilterPanel({ weights, onChange }: Props) {
  function set(key: keyof FilterWeights, raw: number) {
    onChange({ ...weights, [key]: raw / 100 });
  }

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, zIndex: 20,
      background: 'rgba(10,9,8,0.94)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(184,147,85,0.25)',
      borderRadius: 12, padding: '20px 22px', width: 290,
      fontFamily: 'Jost, sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B89355', fontWeight: 500 }}>
          Score Weights
        </span>
        <span style={{ flex: 1, height: 1, background: 'rgba(184,147,85,0.2)' }} />
        <button
          onClick={() => onChange({ comps: 0.2, priceDelta: 0.2, dom: 0.15, permits: 0.15, livability: 0.15, rentalDemand: 0.15 })}
          style={{ fontSize: 10, color: '#6B6252', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
        >reset</button>
      </div>

      {LABELS.map(({ key, label, desc }) => (
        <div key={key} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#F4F0E8', fontWeight: 500 }}>{label}</span>
            <span style={{ fontSize: 11, color: '#B89355', fontWeight: 600 }}>
              {Math.round(weights[key] * 100)}%
            </span>
          </div>
          <p style={{ fontSize: 10, color: '#6B6252', margin: '0 0 6px', lineHeight: 1.4 }}>{desc}</p>
          <div style={{ position: 'relative' }}>
            <input
              type="range"
              min={0} max={40} step={1}
              value={Math.round(weights[key] * 100)}
              onChange={e => set(key, Number(e.target.value))}
              style={{ width: '100%', accentColor: '#B89355', cursor: 'pointer' }}
            />
          </div>
        </div>
      ))}

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(107,98,82,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#6B6252' }}>Total weight</span>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: Math.abs(Object.values(weights).reduce((a, b) => a + b, 0) - 1) < 0.05 ? '#22c55e' : '#f97316',
          }}>
            {Math.round(Object.values(weights).reduce((a, b) => a + b, 0) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
