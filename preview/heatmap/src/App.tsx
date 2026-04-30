import React, { useState, useCallback, useRef } from 'react';
import type { FilterWeights, HoverState, Parcel } from './types';
import { DEFAULT_WEIGHTS } from './utils/scoring';
import { useParcelData } from './hooks/useParcelData';
import HeatMap from './components/HeatMap';
import HoverTooltip from './components/HoverTooltip';
import FilterPanel from './components/FilterPanel';
import PropertyDrawer from './components/PropertyDrawer';

export default function App() {
  const [weights, setWeights] = useState<FilterWeights>(DEFAULT_WEIGHTS);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [selected, setSelected] = useState<Parcel | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { parcels, loading } = useParcelData(weights);

  const handleHover = useCallback((state: HoverState | null) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (!state) {
      hoverTimer.current = setTimeout(() => setHover(null), 80);
      return;
    }
    // 150ms debounce on enter
    hoverTimer.current = setTimeout(() => setHover(state), 150);
  }, []);

  const handleSelect = useCallback((parcel: Parcel) => {
    setHover(null);
    setSelected(parcel);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0908', position: 'relative', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        background: 'rgba(10,9,8,0.9)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(184,147,85,0.15)',
        padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
        fontFamily: 'Jost, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: 18, fontWeight: 600, color: '#F4F0E8', letterSpacing: '0.02em',
          }}>
            PropertyDNA
          </span>
          <span style={{
            fontSize: 9, fontWeight: 600, color: '#B89355',
            border: '1px solid rgba(184,147,85,0.4)',
            borderRadius: 4, padding: '2px 6px',
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            Heat Map Preview
          </span>
        </div>

        <div style={{ height: 18, width: 1, background: 'rgba(107,98,82,0.4)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 11, color: '#6B6252' }}>
            <span style={{ color: '#B89355', fontWeight: 600 }}>{parcels.length}</span> parcels · Palm Springs metro
          </div>
          {loading && (
            <div style={{ fontSize: 10, color: '#B89355', display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#B89355', animation: 'pulse 0.8s ease-in-out infinite' }} />
              Loading
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ fontSize: 10, color: '#6B6252' }}>
          ⚠ Preview build — mock data only
        </div>
      </div>

      {/* Map (fills screen, offset for top bar) */}
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, bottom: 0 }}>
        <HeatMap
          parcels={parcels}
          weights={weights}
          loading={loading}
          onHover={handleHover}
          onSelect={handleSelect}
        />
      </div>

      {/* Filter panel */}
      <div style={{ position: 'absolute', top: 60, right: 0, zIndex: 20 }}>
        <FilterPanel weights={weights} onChange={setWeights} />
      </div>

      {/* Hover tooltip */}
      <HoverTooltip hover={hover} />

      {/* Property drawer */}
      <PropertyDrawer parcel={selected} onClose={() => setSelected(null)} />

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }
        .mapboxgl-ctrl-group { background: rgba(10,9,8,0.9) !important; border: 1px solid rgba(107,98,82,0.3) !important; }
        .mapboxgl-ctrl button { color: #6B6252 !important; }
      `}</style>
    </div>
  );
}
