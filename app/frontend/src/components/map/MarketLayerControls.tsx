// ─────────────────────────────────────────────────────────────────────────────
// MarketLayerControls — the 8 heat-layer pills (horizontal scroll), plus a
// dismissable blurb describing the active layer. Empowerment copy only.
// ─────────────────────────────────────────────────────────────────────────────

import { MAP_LAYERS } from '@/lib/property-dna/mockMapData';
import type { HeatLayerId } from '@/lib/property-dna/types';

const GOLD = '#B89355';

interface Props {
  active: HeatLayerId | null;
  onChange: (id: HeatLayerId | null) => void;
}

export default function MarketLayerControls({ active, onChange }: Props) {
  const activeLayer = MAP_LAYERS.find((l) => l.id === active) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto' }}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 2,
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
        className="pdna-hide-scroll"
      >
        <Pill label="None" selected={active === null} onClick={() => onChange(null)} />
        {MAP_LAYERS.map((layer) => (
          <Pill
            key={layer.id}
            label={layer.shortLabel}
            selected={active === layer.id}
            onClick={() => onChange(layer.id)}
          />
        ))}
      </div>

      {activeLayer && (
        <div
          style={{
            alignSelf: 'flex-start',
            maxWidth: 340,
            padding: '8px 12px',
            borderRadius: 12,
            background: 'rgba(20,18,16,0.72)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div
            style={{
              fontFamily: 'Jost, sans-serif',
              fontSize: 12.5,
              fontWeight: 600,
              color: GOLD,
              letterSpacing: 0.3,
            }}
          >
            {activeLayer.label}
          </div>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11.5, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>
            {activeLayer.blurb}
          </div>
        </div>
      )}

      <style>{`.pdna-hide-scroll::-webkit-scrollbar{display:none;}`}</style>
    </div>
  );
}

function Pill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        whiteSpace: 'nowrap',
        padding: '8px 15px',
        borderRadius: 999,
        cursor: 'pointer',
        fontFamily: 'Jost, sans-serif',
        fontSize: 12.5,
        fontWeight: selected ? 600 : 400,
        letterSpacing: 0.3,
        color: selected ? '#0F0E0D' : 'rgba(255,255,255,0.82)',
        background: selected ? GOLD : 'rgba(20,18,16,0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: selected ? '1px solid transparent' : '1px solid rgba(255,255,255,0.12)',
        boxShadow: selected ? '0 4px 14px rgba(184,147,85,0.4)' : '0 2px 10px rgba(0,0,0,0.25)',
        transition: 'background 0.18s, color 0.18s',
      }}
    >
      {label}
    </button>
  );
}
