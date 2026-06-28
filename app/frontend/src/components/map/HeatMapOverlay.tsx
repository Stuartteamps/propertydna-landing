// ─────────────────────────────────────────────────────────────────────────────
// HeatMapOverlay — imperative controller that paints the active heat layer using
// Mapbox GL's built-in heatmap (no extra map library). Renders nothing; it just
// manages one geojson source + one heatmap layer on the supplied map instance.
//
// The heat grid is decoupled from the property pins so the surface stays smooth.
// Swap MOCK_HEAT_POINTS for live tiles later via the same {lat,lon,values} shape.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import type mapboxgl from 'mapbox-gl';
import { MAP_LAYERS } from '@/lib/property-dna/mockMapData';
import type { HeatLayerId, HeatPoint } from '@/lib/property-dna/types';

const SOURCE_ID = 'pdna-heat-src';
const LAYER_ID = 'pdna-heat-layer';

interface Props {
  map: mapboxgl.Map | null;
  points: HeatPoint[];
  layer: HeatLayerId | null;
  /** Bumped by PropertyMap whenever the base style finishes (re)loading. */
  styleVersion: number;
}

export default function HeatMapOverlay({ map, points, layer, styleVersion }: Props) {
  useEffect(() => {
    if (!map) return;

    const cfg = layer ? MAP_LAYERS.find((l) => l.id === layer) : null;

    const removeLayer = () => {
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };

    const apply = () => {
      if (!map.isStyleLoaded()) return;
      removeLayer();
      if (!cfg) return;

      const features = points.map((p) => ({
        type: 'Feature' as const,
        properties: { w: p.values[cfg.id] },
        geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
      }));

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
      });

      const [c0, c1, c2] = cfg.colorStops;
      map.addLayer({
        id: LAYER_ID,
        type: 'heatmap',
        source: SOURCE_ID,
        maxzoom: 18,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'w'], 0, 0, 1, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.7, 15, 1.6],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.15, hexToRgba(c0, 0.35),
            0.5, hexToRgba(c1, 0.6),
            0.85, hexToRgba(c2, 0.82),
            1, hexToRgba(c2, 0.95),
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 18, 13, 36, 16, 64],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.78, 16, 0.6],
        },
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.once('styledata', apply);

    return () => {
      try {
        removeLayer();
      } catch {
        /* style may already be torn down */
      }
    };
  }, [map, points, layer, styleVersion]);

  return null;
}

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
