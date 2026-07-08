import { useRef, useEffect, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Deck } from '@deck.gl/core';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import { ScatterplotLayer } from '@deck.gl/layers';
import type { HeatParcel, HeatFilterWeights, HeatHoverState } from '@/types/heatmap';
import { heatScoreToRgb } from '@/lib/colorScaleHeatmap';
import { makeHeatValue, metricLabel, METRIC_META, type HeatMetric } from '@/lib/heatMetric';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
// Build-time token. If it's missing (e.g. the native app build shipped without
// VITE_MAPBOX_TOKEN), Mapbox 401s every tile and the map renders as a silent
// blank rectangle. Guard on it so we show a diagnostic instead of nothing.
const HAS_MAPBOX_TOKEN = !!(import.meta.env.VITE_MAPBOX_TOKEN as string | undefined);

const COLOR_RANGE: [number,number,number,number][] = [
  [68,1,84,220],[72,35,116,220],[52,94,141,220],
  [32,144,140,220],[68,190,112,220],[253,231,37,220],
];

interface CityMarket { name: string; lat: number; lon: number; heat: number; medianPrice: number; yoy: number; }

interface Props {
  parcels: HeatParcel[];
  cityMarkets: CityMarket[];
  weights: HeatFilterWeights;
  loading: boolean;
  premium: boolean;
  onHover: (s: HeatHoverState | null) => void;
  onSelect: (p: HeatParcel) => void;
  onCityClick: (city: CityMarket) => void;
}

export default function HeatMapCanvas({ parcels, cityMarkets, weights, loading, premium, onHover, onSelect, onCityClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const deckRef      = useRef<Deck | null>(null);
  const [zoom, setZoom] = useState(4);
  const [metric, setMetric] = useState<HeatMetric>('dna');

  // Refs to keep mapbox event handlers (registered once) in sync with current props/state.
  // Without these, the handlers capture stale `parcels = []` from first render and
  // hover/click at parcel zoom (≥12) silently do nothing.
  const parcelsRef = useRef<HeatParcel[]>(parcels);
  const onHoverRef = useRef(onHover);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { parcelsRef.current = parcels; }, [parcels]);
  useEffect(() => { onHoverRef.current = onHover; onSelectRef.current = onSelect; }, [onHover, onSelect]);

  const buildLayers = useCallback((pts: HeatParcel[], mkts: CityMarket[], z: number) => {
    if (z < 8) {
      // National: city scatter
      return [
        new ScatterplotLayer({
          id: 'city-scatter',
          data: mkts,
          getPosition: (d: CityMarket) => [d.lon, d.lat] as [number,number],
          getRadius: (d: CityMarket) => 40000 + d.heat * 60000,
          getFillColor: (d: CityMarket) => {
            const s = Math.round(d.heat * 100);
            const [r,g,b] = heatScoreToRgb(s);
            return [r,g,b,180] as [number,number,number,number];
          },
          stroked: true,
          getLineColor: [255,255,255,30] as [number,number,number,number],
          lineWidthMinPixels: 1,
          opacity: 0.75,
          pickable: true,
          onClick: (info: any) => { if (info.object) onCityClick(info.object as CityMarket); },
          onHover: (info: any) => {
            if (info.object) {
              const m = info.object as CityMarket;
              onHover({ parcel: cityToFakeParcel(m), x: info.x, y: info.y });
            } else { onHover(null); }
          },
        }),
      ];
    }

    if (pts.length === 0) return [];

    const heatVal = makeHeatValue(pts, metric);

    if (z < 12) {
      return [new HexagonLayer({
        id: 'hex',
        data: pts,
        getPosition: (d: HeatParcel) => [d.lon, d.lat] as [number,number],
        getColorWeight: (d: HeatParcel) => heatVal(d),
        colorAggregation: 'MEAN',
        radius: 200,
        extruded: false,
        pickable: true,
        colorRange: COLOR_RANGE,
        opacity: 0.85,
        onHover: (info: any) => {
          if (info.object?.points?.length) {
            const top = [...info.object.points]
              .sort((a: any, b: any) => heatVal(b.source) - heatVal(a.source))[0].source as HeatParcel;
            onHover({ parcel: top, x: info.x, y: info.y });
          } else { onHover(null); }
        },
        onClick: (info: any) => {
          if (info.object?.points?.length) {
            const top = [...info.object.points]
              .sort((a: any, b: any) => heatVal(b.source) - heatVal(a.source))[0].source as HeatParcel;
            onSelect(top);
          }
        },
      })];
    }

    return [];
  }, [onHover, onSelect, onCityClick, metric]);

  useEffect(() => {
    if (!containerRef.current || !HAS_MAPBOX_TOKEN) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-98.5, 39.5],
      zoom: 4,
      antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;width:100%;height:100%;';
    canvas.width  = containerRef.current.clientWidth;
    canvas.height = containerRef.current.clientHeight;
    containerRef.current.appendChild(canvas);

    const deck = new Deck({
      canvas, width: '100%', height: '100%', controller: false, layers: [],
    });
    deckRef.current = deck;

    const syncDeck = () => {
      const { lng, lat } = map.getCenter();
      deck.setProps({
        viewState: { longitude: lng, latitude: lat, zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() },
      });
    };

    map.on('move', syncDeck);
    map.on('zoom', () => { setZoom(map.getZoom()); syncDeck(); });

    map.on('load', () => {
      map.addSource('parcels-fill', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'parcels-fill', type: 'fill', source: 'parcels-fill',
        paint: { 'fill-color': ['get', 'fillColor'], 'fill-opacity': ['get', 'fillOpacity'] } });
      map.addLayer({ id: 'parcels-outline', type: 'line', source: 'parcels-fill',
        paint: { 'line-color': ['get', 'fillColor'], 'line-width': 1, 'line-opacity': 0.5 } });

      map.addSource('parcel-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'parcel-labels', type: 'symbol', source: 'parcel-labels', minzoom: 14,
        layout: { 'text-field': ['get', 'score'], 'text-size': 10, 'text-allow-overlap': false,
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'] },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.6)', 'text-halo-width': 1 } });
    });

    map.on('click', 'parcels-fill', (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (!id) return;
      const p = parcelsRef.current.find(x => x.id === id);
      if (p) onSelectRef.current(p);
    });
    map.on('mousemove', 'parcels-fill', (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (!id) return;
      const p = parcelsRef.current.find(x => x.id === id);
      if (p) onHoverRef.current({ parcel: p, x: e.originalEvent.clientX, y: e.originalEvent.clientY });
    });
    map.on('mouseleave', 'parcels-fill', () => onHoverRef.current(null));
    // Pointer cursor over interactive parcel polygons
    map.on('mouseenter', 'parcels-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'parcels-fill', () => { map.getCanvas().style.cursor = 'crosshair'; });
    map.getCanvas().style.cursor = 'crosshair';

    mapRef.current = map;
    return () => { deck.finalize(); map.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update layers when data changes
  useEffect(() => {
    const map = mapRef.current;
    const deck = deckRef.current;
    if (!map || !deck) return;

    const updateLayers = () => {
      deck.setProps({ layers: buildLayers(parcels, cityMarkets, zoom) });

      if (!map.isStyleLoaded() || !map.getSource('parcels-fill')) return;

      if (zoom >= 12 && parcels.length) {
        const heatVal = makeHeatValue(parcels, metric);
        const features = parcels.map(p => {
          const [r,g,b] = heatScoreToRgb(Math.round(heatVal(p)));
          return { type: 'Feature' as const,
            properties: { id: p.id, score: metricLabel(p, metric), fillColor: `rgb(${r},${g},${b})`, fillOpacity: 0.5 + p.confidence * 0.3 },
            geometry: { type: 'Polygon' as const, coordinates: [p.polygon] } };
        });
        (map.getSource('parcels-fill') as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features });
        const labelFeats = parcels.map(p => ({ type: 'Feature' as const,
          properties: { id: p.id, score: metricLabel(p, metric) },
          geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] } }));
        (map.getSource('parcel-labels') as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features: labelFeats });
        map.setLayoutProperty('parcels-fill',    'visibility', 'visible');
        map.setLayoutProperty('parcels-outline', 'visibility', 'visible');
        deck.setProps({ layers: [] });
      } else if (map.getSource('parcels-fill')) {
        map.setLayoutProperty('parcels-fill',    'visibility', 'none');
        map.setLayoutProperty('parcels-outline', 'visibility', 'none');
        (map.getSource('parcel-labels') as mapboxgl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: [] });
      }
    };

    if (map.isStyleLoaded()) { updateLayers(); }
    else { map.once('load', updateLayers); }
  }, [parcels, cityMarkets, zoom, weights, buildLayers, metric]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {!HAS_MAPBOX_TOKEN && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: 24, background: '#0A0908',
          fontFamily: 'Jost, sans-serif', color: '#B89355',
        }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>Map unavailable</div>
          <div style={{ fontSize: 12, color: '#6B6252', maxWidth: 320, lineHeight: 1.6 }}>
            The map couldn’t load because <code>VITE_MAPBOX_TOKEN</code> isn’t set
            in this build. Set it in the build environment to enable the live map.
          </div>
        </div>
      )}

      {/* Heat-metric toggle */}
      <div style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', gap: 4,
        background: 'rgba(10,9,8,0.85)', border: '1px solid rgba(107,98,82,0.3)',
        borderRadius: 8, padding: 4, fontFamily: 'Jost, sans-serif',
      }}>
        {(Object.keys(METRIC_META) as HeatMetric[]).map((m) => (
          <button key={m} onClick={() => setMetric(m)} style={{
            cursor: 'pointer', border: 'none', borderRadius: 5, padding: '5px 12px',
            fontSize: 11, fontFamily: 'Jost, sans-serif',
            background: metric === m ? '#B89355' : 'transparent',
            color: metric === m ? '#0A0908' : '#B89355',
          }}>{METRIC_META[m].label}</button>
        ))}
      </div>

      {loading && (
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,9,8,0.9)', border: '1px solid rgba(184,147,85,0.2)',
          borderRadius: 8, padding: '7px 14px', zIndex: 10,
          fontSize: 11, color: '#B89355', fontFamily: 'Jost, sans-serif',
        }}>
          Loading real listings…
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(10,9,8,0.85)', border: '1px solid rgba(107,98,82,0.3)',
        borderRadius: 8, padding: '5px 12px', fontFamily: 'Jost, sans-serif', whiteSpace: 'nowrap',
      }}>
        <span style={{ fontSize: 9, color: '#6B6252' }}>Low</span>
        <div style={{ width: 100, height: 6, borderRadius: 3, background: 'linear-gradient(90deg,rgb(68,1,84),rgb(52,94,141),rgb(32,144,140),rgb(68,190,112),rgb(253,231,37))' }} />
        <span style={{ fontSize: 9, color: '#6B6252' }}>High</span>
        <span style={{ fontSize: 10, color: '#B89355', marginLeft: 4 }}>{METRIC_META[metric].legend}</span>
        {zoom < 8 && <span style={{ fontSize: 9, color: '#6B6252', marginLeft: 8 }}>Click city to drill in</span>}
        {zoom >= 8 && zoom < 12 && parcels.length > 0 && <span style={{ fontSize: 9, color: '#6B6252', marginLeft: 8 }}>{parcels.length} listings · zoom for parcels</span>}
        {zoom >= 12 && <span style={{ fontSize: 9, color: '#22c55e', marginLeft: 8 }}>Parcel mode</span>}
      </div>

      <style>{`
        .mapboxgl-ctrl-group { background: rgba(10,9,8,0.9) !important; border: 1px solid rgba(107,98,82,0.3) !important; }
        .mapboxgl-ctrl button.mapboxgl-ctrl-zoom-in .mapboxgl-ctrl-icon,
        .mapboxgl-ctrl button.mapboxgl-ctrl-zoom-out .mapboxgl-ctrl-icon { filter: invert(0.6); }
      `}</style>
    </div>
  );
}

function cityToFakeParcel(m: CityMarket): HeatParcel {
  return {
    id: m.name, address: m.name, street: m.name,
    city: m.name.split(',')[0], state: m.name.split(', ')[1] || 'US', zip: '',
    lat: m.lat, lon: m.lon,
    score: Math.round(m.heat * 100), confidence: 0.8,
    price: m.medianPrice, pricePerSqft: 0, sqft: 0,
    bedrooms: 0, bathrooms: 0, yearBuilt: 0, dom: 0, permits: 0,
    propertyType: 'single_family',
    compsScore: 70, priceDeltaScore: 70, domScore: 70, permitsScore: 50, livability: 70, rentalDemand: 70,
    sparkline: Array.from({ length: 30 }, (_, i) => 100 + m.yoy / 12 * (i / 30)),
    polygon: [], neighborhood: m.name,
  };
}
