// Lazy-loaded map component — isolated so Leaflet crashes don't kill the full report
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  lat: number; lon: number;
  address: string;
  comps: any[];
  priceColor: (p: number) => string;
}

export default function ReportMap({ lat, lon, address, comps, priceColor }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef       = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Tear down any existing map (React StrictMode double-mount safety)
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, {
      center: [lat, lon],
      zoom: 14,
      zoomControl: true,
      preferCanvas: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CARTO',
      maxZoom: 19,
    }).addTo(map);

    // Comp markers — sized + colored by price
    const compsWithCoords = comps.filter((c: any) => c.lat && c.lon);
    const prices = compsWithCoords.map((c: any) => c.rawPrice || 0);
    const minP = prices.length ? Math.min(...prices) : 0;
    const maxP = prices.length ? Math.max(...prices) : 1;

    compsWithCoords.forEach((comp: any) => {
      const price = comp.rawPrice || 500000;
      const radius = 8 + Math.min(16, price / 200000);
      const fill   = priceColor(price);
      L.circleMarker([Number(comp.lat), Number(comp.lon)], {
        radius,
        color: '#C9A84C',
        fillColor: fill,
        fillOpacity: 0.75,
        weight: 1,
      })
        .bindPopup(
          `<div style="font-family:sans-serif;font-size:13px"><strong>${comp.address || ''}</strong><br/>${comp.price || ''} · ${comp.sqft || ''} · ${comp.distance || ''}</div>`
        )
        .addTo(map);
    });

    // Subject marker (gold pulse)
    L.circleMarker([lat, lon], {
      radius: 14,
      color: '#C9A84C',
      fillColor: '#C9A84C',
      fillOpacity: 1,
      weight: 2,
    })
      .bindPopup(`<div style="font-family:sans-serif;font-size:13px"><strong>Subject Property</strong><br/>${address}</div>`)
      .addTo(map);

    // Fit bounds so subject + comps are all in view
    const allPoints: [number, number][] = [[lat, lon], ...compsWithCoords.map((c: any) => [Number(c.lat), Number(c.lon)] as [number, number])];
    if (allPoints.length > 1) {
      map.fitBounds(allPoints, { padding: [40, 40], maxZoom: 16 });
    }

    // Force tile redraw after mount (fixes 0-height race)
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      try { map.remove(); } catch { /* ignore */ }
      mapRef.current = null;
    };
  }, [lat, lon, address, comps, priceColor]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%', minHeight: 420, background: '#0a0a0a' }} />;
}
