// ─────────────────────────────────────────────────────────────────────────────
// PropertyPin — a "position" marker on the map. Shows the asset's compact value
// like a stock chip. Rendered as an absolutely-positioned React overlay by
// PropertyMap (positions come from map.project()), so it stays a pure component.
// ─────────────────────────────────────────────────────────────────────────────

import { fmtCompactUSD } from '@/lib/property-dna/calculatePropertyDNA';
import type { HeatLayerId, PropertyDNAAsset } from '@/lib/property-dna/types';

const GOLD = '#B89355';
const INK = '#0F0E0D';

/** Low→high tint for a heat value (used when a heat layer is active). */
function heatTint(v: number): string {
  // cool slate → gold → warm
  if (v < 0.34) return '#3D6FB0';
  if (v < 0.67) return GOLD;
  return '#C94B3A';
}

interface Props {
  asset: PropertyDNAAsset;
  /** Screen position from map.project(). */
  x: number;
  y: number;
  active: boolean;
  /** When a heat layer is active, tint the pin by its value. */
  heatLayer?: HeatLayerId | null;
  onClick: (asset: PropertyDNAAsset) => void;
}

export default function PropertyPin({ asset, x, y, active, heatLayer, onClick }: Props) {
  const tint = heatLayer ? heatTint(asset.heatValues[heatLayer]) : GOLD;
  const bg = active ? INK : '#FFFFFF';
  const fg = active ? '#FFFFFF' : INK;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(asset);
      }}
      aria-label={`${asset.address} — ${fmtCompactUSD(asset.dnaValue)}`}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -100%) scale(${active ? 1.06 : 1})`,
        zIndex: active ? 30 : 20,
        cursor: 'pointer',
        border: 'none',
        background: 'transparent',
        padding: 0,
        transition: 'transform 0.16s ease',
        willChange: 'transform',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 11px',
            borderRadius: 999,
            background: bg,
            border: `1.5px solid ${tint}`,
            boxShadow: active ? '0 8px 22px rgba(0,0,0,0.4)' : '0 3px 12px rgba(0,0,0,0.25)',
            fontFamily: 'Jost, sans-serif',
            fontSize: 12.5,
            fontWeight: 600,
            letterSpacing: 0.2,
            color: fg,
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: tint,
              flexShrink: 0,
              boxShadow: active ? `0 0 8px ${tint}` : 'none',
            }}
          />
          {fmtCompactUSD(asset.dnaValue)}
        </div>
        {/* pointer tail */}
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: `7px solid ${bg}`,
            marginTop: -1,
            filter: 'drop-shadow(0 2px 1px rgba(0,0,0,0.2))',
          }}
        />
      </div>
    </button>
  );
}
