// ─────────────────────────────────────────────────────────────────────────────
// MapLayerToggle — Standard / Satellite / Hybrid base-map pill (bottom-center).
// ─────────────────────────────────────────────────────────────────────────────

import type { MapStyleId } from '@/lib/property-dna/types';

const GOLD = '#B89355';

const OPTIONS: { id: MapStyleId; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'hybrid', label: 'Hybrid' },
];

interface Props {
  value: MapStyleId;
  onChange: (id: MapStyleId) => void;
}

export default function MapLayerToggle({ value, onChange }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        padding: 4,
        borderRadius: 999,
        background: 'rgba(20,18,16,0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 6px 22px rgba(0,0,0,0.32)',
      }}
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              padding: '7px 16px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Jost, sans-serif',
              fontSize: 12.5,
              fontWeight: active ? 600 : 400,
              letterSpacing: 0.3,
              color: active ? '#0F0E0D' : 'rgba(255,255,255,0.78)',
              background: active ? GOLD : 'transparent',
              transition: 'background 0.18s, color 0.18s',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
