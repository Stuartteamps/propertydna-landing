import React, { useRef, useEffect, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Deck } from '@deck.gl/core';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import type { Parcel, FilterWeights, HoverState } from '../types';
import { scoreToRgb } from '../utils/colorScale';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || 'MAPBOX_TOKEN';

// Viridis stops for deck.gl colorRange
const COLOR_RANGE: [number, number, number, number][] = [
  [68,  1,   84,  220],
  [72,  35,  116, 220],
  [52,  94,  141, 220],
  [32,  144, 140, 220],
  [68,  190, 112, 220],
  [253, 231, 37,  220],
];

interface Props {
  parcels: Parcel[];
  weights: FilterWeights;
  loading: boolean;
  onHover: (state: HoverState | null) => void;
  onSelect: (parcel: Parcel) => void;
}

export default function HeatMap({ parcels, weights, loading, onHover, onSelect }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const deckRef = useRef<Deck | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(11);
  const [tokenMissing] = useState(mapboxgl.accessToken === 'MAPBOX_TOKEN');

  const buildLayers = useCallback((pts: Parcel[], z: number) => {
    if (z < 12) {
      return [new HexagonLayer({
        id: 'hex',
        data: pts,
        getPosition: (d: Parcel) => [d.lon, d.lat] as [number, number],
        getColorWeight: (d: Parcel) => d.score,
        colorAggregation: 'MEAN',
        getElevationWeight: (d: Parcel) => d.score,
        elevationAggregation: 'MEAN',
        radius: 250,
        elevationScale: 0,
        extruded: false,
        pickable: true,
        colorRange: COLOR_RANGE,
        opacity: 0.85,
        onHover: (info: any) => {
          if (info.object && info.object.points?.length) {
            const topParcel = info.object.points
              .map((p: any) => p.source as Parcel)
              .sort((a: Parcel, b: Parcel) => b.score - a.score)[0];
            onHover({ parcel: topParcel, x: info.x, y: info.y });
          } else {
            onHover(null);
          }
        },
        onClick: (info: any) => {
          if (info.object?.points?.length) {
            const topParcel = info.object.points
              .map((p: any) => p.source as Parcel)
              .sort((a: Parcel, b: Parcel) => b.score - a.score)[0];
            onSelect(topParcel);
          }
        },
      })];
    }
    return [];
  }, [onHover, onSelect]);

  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: tokenMissing
        ? { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0a0908' } }] }
        : 'mapbox://styles/mapbox/dark-v11',
      center: [-116.5453, 33.8303],
      zoom: 11,
      antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    // Create overlay canvas for deck.gl
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
    canvas.width = mapContainer.current.clientWidth;
    canvas.height = mapContainer.current.clientHeight;
    mapContainer.current.appendChild(canvas);
    canvasRef.current = canvas;

    const deck = new Deck({
      canvas,
      width: '100%',
      height: '100%',
      controller: false,
      layers: [],
      onWebGLInitialized: () => {},
      _customRender: () => {},
    });
    deckRef.current = deck;

    map.on('move', () => {
      const { lng, lat } = map.getCenter();
      deck.setProps({
        viewState: {
          longitude: lng,
          latitude: lat,
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
        },
      });
    });

    map.on('zoom', () => {
      const z = map.getZoom();
      setZoom(z);
    });

    map.on('load', () => {
      // Parcel polygon source (shown at zoom >= 12)
      map.addSource('parcels-fill', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'parcels-fill',
        type: 'fill',
        source: 'parcels-fill',
        paint: {
          'fill-color': ['get', 'fillColor'],
          'fill-opacity': ['get', 'fillOpacity'],
        },
      });

      map.addLayer({
        id: 'parcels-outline',
        type: 'line',
        source: 'parcels-fill',
        paint: {
          'line-color': ['get', 'fillColor'],
          'line-width': 1,
          'line-opacity': 0.6,
        },
      });

      // Parcel label layer
      map.addSource('parcel-labels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'parcel-labels',
        type: 'symbol',
        source: 'parcel-labels',
        layout: {
          'text-field': ['get', 'score'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 11,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.6)',
          'text-halo-width': 1,
        },
        minzoom: 14,
      });
    });

    map.on('click', 'parcels-fill', (e) => {
      const props = e.features?.[0]?.properties;
      if (props?.id) {
        const p = parcels.find(x => x.id === props.id);
        if (p) onSelect(p);
      }
    });

    map.on('mousemove', 'parcels-fill', (e) => {
      const props = e.features?.[0]?.properties;
      if (props?.id) {
        const p = parcels.find(x => x.id === props.id);
        if (p) onHover({ parcel: p, x: e.originalEvent.clientX, y: e.originalEvent.clientY });
      }
    });

    map.on('mouseleave', 'parcels-fill', () => onHover(null));

    map.getCanvas().style.cursor = 'crosshair';

    mapRef.current = map;

    return () => {
      deck.finalize();
      map.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update deck.gl layers + mapbox parcel polygons when data/zoom changes
  useEffect(() => {
    const map = mapRef.current;
    const deck = deckRef.current;
    if (!map || !deck || !map.isStyleLoaded()) return;

    const layers = buildLayers(parcels, zoom);
    deck.setProps({ layers });

    if (zoom >= 12 && map.getSource('parcels-fill')) {
      const features = parcels.map(p => {
        const [r, g, b] = scoreToRgb(p.score);
        return {
          type: 'Feature' as const,
          properties: {
            id: p.id,
            score: String(p.score),
            fillColor: `rgb(${r},${g},${b})`,
            fillOpacity: 0.55 + p.confidence * 0.3,
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [p.polygon],
          },
        };
      });

      (map.getSource('parcels-fill') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features,
      });

      const labelFeatures = parcels.map(p => ({
        type: 'Feature' as const,
        properties: { id: p.id, score: p.score },
        geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
      }));
      (map.getSource('parcel-labels') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: labelFeatures,
      });

      map.setLayoutProperty('parcels-fill', 'visibility', 'visible');
      map.setLayoutProperty('parcels-outline', 'visibility', 'visible');
      deck.setProps({ layers: [] }); // hide hex when parcels are shown
    } else if (map.getSource('parcels-fill')) {
      map.setLayoutProperty('parcels-fill', 'visibility', 'none');
      map.setLayoutProperty('parcels-outline', 'visibility', 'none');
      (map.getSource('parcel-labels') as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
    }
  }, [parcels, zoom, weights, buildLayers]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {tokenMissing && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          background: 'rgba(15,14,13,0.9)', border: '1px solid rgba(184,147,85,0.4)',
          borderRadius: 10, padding: '20px 28px', textAlign: 'center', zIndex: 10,
          fontFamily: 'Jost, sans-serif',
        }}>
          <div style={{ fontSize: 13, color: '#B89355', fontWeight: 600, marginBottom: 6 }}>
            Map tiles need a Mapbox token
          </div>
          <div style={{ fontSize: 11, color: '#6B6252', marginBottom: 10 }}>
            Add your token to <code style={{ color: '#F4F0E8', background: 'rgba(107,98,82,0.2)', padding: '1px 5px', borderRadius: 3 }}>.env</code>
          </div>
          <code style={{ fontSize: 10, color: '#6B6252' }}>VITE_MAPBOX_TOKEN=pk.eyJ1...</code>
          <div style={{ fontSize: 10, color: '#6B6252', marginTop: 8 }}>
            All UI components still work — hover/click/drawer/scores active
          </div>
        </div>
      )}

      {loading && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,9,8,0.9)', border: '1px solid rgba(184,147,85,0.2)',
          borderRadius: 8, padding: '8px 16px', zIndex: 10,
          fontSize: 11, color: '#B89355', fontFamily: 'Jost, sans-serif',
        }}>
          Loading 500 parcels…
        </div>
      )}

      {/* Zoom hint */}
      <div style={{
        position: 'absolute', bottom: 20, left: 20, zIndex: 10,
        background: 'rgba(10,9,8,0.85)', border: '1px solid rgba(107,98,82,0.3)',
        borderRadius: 8, padding: '6px 12px',
        fontSize: 10, color: '#6B6252', fontFamily: 'Jost, sans-serif',
      }}>
        {zoom < 12 ? 'Zoom in past 12 for parcel view' : `Zoom ${zoom.toFixed(1)} — parcel mode`}
      </div>

      {/* Score legend */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(10,9,8,0.85)', border: '1px solid rgba(107,98,82,0.3)',
        borderRadius: 8, padding: '6px 14px',
        fontFamily: 'Jost, sans-serif',
      }}>
        <span style={{ fontSize: 9, color: '#6B6252' }}>Low</span>
        <div style={{
          width: 120, height: 8, borderRadius: 4,
          background: 'linear-gradient(90deg, rgb(68,1,84), rgb(52,94,141), rgb(32,144,140), rgb(68,190,112), rgb(253,231,37))',
        }} />
        <span style={{ fontSize: 9, color: '#6B6252' }}>High</span>
        <span style={{ fontSize: 10, color: '#B89355', marginLeft: 4 }}>DNA Score</span>
      </div>
    </div>
  );
}
