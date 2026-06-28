// ─────────────────────────────────────────────────────────────────────────────
// PropertyMap — the premium "Bloomberg/Fidelity-for-real-estate" map surface.
//
// Apple-Maps-clean base (Mapbox GL) + Fidelity-grade property intelligence. Every
// home renders as a value chip; tapping one opens a draggable position card.
//
// Composition:
//   Mapbox base  ──► style toggle (Standard/Satellite/Hybrid)
//   HeatMapOverlay ─► one of 8 selectable heat layers (MarketLayerControls)
//   PropertyPin[]  ─► React overlay positioned via map.project()
//   PropertyBottomSheet ─► tabbed asset intelligence + charts
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getMockMapData, MOCK_MAP_CENTER, MOCK_MAP_ZOOM } from '@/lib/property-dna/mockMapData';
import type { HeatLayerId, MapStyleId, PropertyDNAAsset } from '@/lib/property-dna/types';
import MapLayerToggle from './MapLayerToggle';
import MarketLayerControls from './MarketLayerControls';
import HeatMapOverlay from './HeatMapOverlay';
import PropertyPin from './PropertyPin';
import PropertyBottomSheet from './PropertyBottomSheet';

mapboxgl.accessToken = (import.meta.env.VITE_MAPBOX_TOKEN as string) || '';

const GOLD = '#B89355';

/** Mapbox base-style URLs for the Standard / Satellite / Hybrid selector. */
const MAP_STYLE_URLS: Record<MapStyleId, string> = {
  standard: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-v9',
  hybrid: 'mapbox://styles/mapbox/satellite-streets-v12',
};

interface PinPos {
  asset: PropertyDNAAsset;
  x: number;
  y: number;
}

interface Props {
  onExit?: () => void;
}

export default function PropertyMap({ onExit }: Props) {
  const { assets, heatPoints } = useMemo(() => getMockMapData(), []);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const appliedStyleRef = useRef<MapStyleId>('standard');
  const locMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [styleId, setStyleId] = useState<MapStyleId>('standard');
  const [styleVersion, setStyleVersion] = useState(0);
  const [heatLayer, setHeatLayer] = useState<HeatLayerId | null>(null);
  const [selected, setSelected] = useState<PropertyDNAAsset | null>(null);
  const [pins, setPins] = useState<PinPos[]>([]);
  const [search, setSearch] = useState('');

  const hasToken = Boolean(mapboxgl.accessToken);

  // ── Map init (once) ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !hasToken) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URLS[appliedStyleRef.current],
      center: MOCK_MAP_CENTER,
      zoom: MOCK_MAP_ZOOM,
      attributionControl: false,
      antialias: true,
    });
    mapRef.current = map;

    const updatePins = () => {
      const w = map.getContainer().clientWidth;
      const h = map.getContainer().clientHeight;
      const next: PinPos[] = [];
      for (const asset of assets) {
        const p = map.project([asset.lng, asset.lat]);
        if (p.x < -60 || p.y < -60 || p.x > w + 60 || p.y > h + 60) continue;
        next.push({ asset, x: p.x, y: p.y });
      }
      setPins(next);
    };

    map.on('load', () => {
      setMapReady(true);
      setStyleVersion((v) => v + 1);
      updatePins();
    });
    map.on('style.load', () => setStyleVersion((v) => v + 1));
    map.on('move', updatePins);
    map.on('resize', updatePins);

    return () => {
      locMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [assets, hasToken]);

  // ── Base-style switching ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || appliedStyleRef.current === styleId) return;
    appliedStyleRef.current = styleId;
    map.setStyle(MAP_STYLE_URLS[styleId]);
  }, [styleId, mapReady]);

  // ── Interactions ────────────────────────────────────────────────────────────
  const flyToAsset = useCallback((asset: PropertyDNAAsset) => {
    setSelected(asset);
    mapRef.current?.flyTo({ center: [asset.lng, asset.lat], zoom: Math.max(14.5, mapRef.current.getZoom()), duration: 700 });
  }, []);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = search.trim().toLowerCase();
      if (!q) return;
      const hit = assets.find(
        (a) =>
          a.address.toLowerCase().includes(q) ||
          a.neighborhood.name.toLowerCase().includes(q) ||
          a.city.toLowerCase().includes(q) ||
          a.zip.includes(q),
      );
      if (hit) flyToAsset(hit);
    },
    [search, assets, flyToAsset],
  );

  const goToMyLocation = useCallback(() => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const map = mapRef.current;
        if (!map) return;
        map.flyTo({ center: [longitude, latitude], zoom: 14, duration: 900 });
        locMarkerRef.current?.remove();
        const el = document.createElement('div');
        el.style.cssText = `width:16px;height:16px;border-radius:50%;background:${GOLD};border:3px solid #fff;box-shadow:0 0 0 4px rgba(184,147,85,0.3);`;
        locMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map);
      },
      () => {
        /* permission denied — silently ignore */
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  // ── Token-missing fallback ──────────────────────────────────────────────────
  if (!hasToken) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#14110E', color: '#fff', fontFamily: 'Jost, sans-serif', textAlign: 'center', padding: 24 }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: GOLD }}>Map unavailable</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>
            Set <code>VITE_MAPBOX_TOKEN</code> to enable the live map.
          </div>
        </div>
      </div>
    );
  }

  const isSatellite = styleId !== 'standard';

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#0F0E0D' }}>
      {/* Base map */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Heat overlay controller */}
      <HeatMapOverlay map={mapReady ? mapRef.current : null} points={heatPoints} layer={heatLayer} styleVersion={styleVersion} />

      {/* Property pins (React overlay) */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {mapReady &&
          pins.map((p) => (
            <div key={p.asset.id} style={{ pointerEvents: 'auto' }}>
              <PropertyPin
                asset={p.asset}
                x={p.x}
                y={p.y}
                active={selected?.id === p.asset.id}
                heatLayer={heatLayer}
                onClick={flyToAsset}
              />
            </div>
          ))}
      </div>

      {/* ── Premium dark translucent header ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 35,
          padding: 'max(12px, env(safe-area-inset-top)) 16px 14px',
          background: 'linear-gradient(180deg, rgba(15,14,13,0.82) 0%, rgba(15,14,13,0.45) 70%, rgba(15,14,13,0) 100%)',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, pointerEvents: 'auto' }}>
          {onExit && (
            <button
              onClick={onExit}
              aria-label="Back"
              style={{ width: 36, height: 36, borderRadius: 999, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(20,18,16,0.6)', color: '#fff', fontSize: 18, cursor: 'pointer', flexShrink: 0, backdropFilter: 'blur(12px)' }}
            >
              ‹
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: 3, color: GOLD, fontWeight: 600 }}>PROPERTYDNA</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#fff', lineHeight: 1.05 }}>Map</div>
          </div>
          <div style={{ marginLeft: 'auto', fontFamily: 'Jost, sans-serif', fontSize: 11.5, color: 'rgba(255,255,255,0.7)', textAlign: 'right', maxWidth: 150 }}>
            Track your home like a portfolio
          </div>
        </div>

        {/* Floating search bar */}
        <form onSubmit={handleSearch} style={{ marginTop: 12, pointerEvents: 'auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.94)',
              boxShadow: '0 6px 22px rgba(0,0,0,0.28)',
            }}
          >
            <span style={{ color: '#6B5F55', fontSize: 15 }}>⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search an address, neighborhood, or ZIP"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'Jost, sans-serif', fontSize: 14, color: '#2C2825' }}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Clear" style={{ border: 'none', background: 'transparent', color: '#6B5F55', cursor: 'pointer', fontSize: 14 }}>
                ×
              </button>
            )}
          </div>
        </form>

        {/* Heat-layer pills */}
        <div style={{ marginTop: 12, pointerEvents: 'auto' }}>
          <MarketLayerControls active={heatLayer} onChange={setHeatLayer} />
        </div>
      </div>

      {/* Current-location button (bottom-right) */}
      <button
        onClick={goToMyLocation}
        aria-label="My location"
        style={{
          position: 'absolute',
          right: 16,
          bottom: 'calc(86px + env(safe-area-inset-bottom))',
          zIndex: 35,
          width: 46,
          height: 46,
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.16)',
          background: 'rgba(20,18,16,0.72)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 6px 22px rgba(0,0,0,0.32)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LocationIcon />
      </button>

      {/* Base-style toggle (bottom-center) */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(20px + env(safe-area-inset-bottom))', zIndex: 35 }}>
        <MapLayerToggle value={styleId} onChange={setStyleId} />
      </div>

      {/* Attribution (required, kept minimal) */}
      <div style={{ position: 'absolute', left: 8, bottom: 2, zIndex: 30, fontFamily: 'Jost, sans-serif', fontSize: 9, color: isSatellite ? 'rgba(255,255,255,0.6)' : 'rgba(44,40,37,0.5)' }}>
        © Mapbox © OpenStreetMap
      </div>

      {/* Bottom sheet */}
      <PropertyBottomSheet asset={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function LocationIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
    </svg>
  );
}
