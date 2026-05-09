// Interactive sales activity map — pans/zooms to load parcels in viewport
// Subject + comps are static gold dots. Surrounding parcels are loaded from
// /.netlify/functions/get-parcels-in-bounds with DNA score color coding.
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  lat: number; lon: number;
  address: string;
  comps: any[];
  priceColor: (p: number) => string;
}

// DNA score → color (high green → low red)
function scoreColor(score: number | null): string {
  if (score == null) return '#3a3a3a';
  if (score >= 80) return '#2D9142';   // dark green
  if (score >= 65) return '#74C69D';   // light green
  if (score >= 50) return '#C9A84C';   // gold
  if (score >= 35) return '#E89255';   // orange
  return '#B85245';                    // red
}

export default function ReportMap({ lat, lon, address, comps, priceColor }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const parcelLayerRef = useRef<L.LayerGroup | null>(null);
  const lastBboxRef = useRef<string>('');
  const fetchTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, {
      center: [lat, lon],
      zoom: 15,
      zoomControl: true,
      preferCanvas: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CARTO · PropertyDNA',
      maxZoom: 19,
    }).addTo(map);

    // Layer groups: parcels (dynamic) + fixed (subject + comps)
    const parcelLayer = L.layerGroup().addTo(map);
    parcelLayerRef.current = parcelLayer;
    const fixedLayer = L.layerGroup().addTo(map);

    // Comp markers — sized + colored by price
    const compsWithCoords = comps.filter((c: any) => c.lat && c.lon);
    compsWithCoords.forEach((comp: any) => {
      const price = comp.rawPrice || 500000;
      const radius = 8 + Math.min(16, price / 200000);
      L.circleMarker([Number(comp.lat), Number(comp.lon)], {
        radius,
        color: '#C9A84C',
        fillColor: priceColor(price),
        fillOpacity: 0.85,
        weight: 1.5,
      })
        .bindPopup(
          `<div style="font-family:sans-serif;font-size:13px"><strong>${comp.address || ''}</strong><br/>${comp.price || ''} · ${comp.sqft || ''} · ${comp.distance || ''}</div>`
        )
        .addTo(fixedLayer);
    });

    // Subject (gold pulse, larger)
    L.circleMarker([lat, lon], {
      radius: 14,
      color: '#C9A84C',
      fillColor: '#C9A84C',
      fillOpacity: 1,
      weight: 2,
    })
      .bindPopup(`<div style="font-family:sans-serif;font-size:13px"><strong>Subject Property</strong><br/>${address}</div>`)
      .addTo(fixedLayer);

    // Fit bounds initially
    const allPoints: [number, number][] = [[lat, lon], ...compsWithCoords.map((c: any) => [Number(c.lat), Number(c.lon)] as [number, number])];
    if (allPoints.length > 1) {
      map.fitBounds(allPoints, { padding: [40, 40], maxZoom: 16 });
    }

    // Throttled parcel fetcher
    const fetchParcels = () => {
      const b = map.getBounds();
      const key = `${b.getSouth().toFixed(3)}_${b.getNorth().toFixed(3)}_${b.getWest().toFixed(3)}_${b.getEast().toFixed(3)}`;
      if (key === lastBboxRef.current) return;
      lastBboxRef.current = key;

      // Only fetch when zoomed in enough — wide views overwhelm the API
      const zoom = map.getZoom();
      if (zoom < 14) {
        parcelLayer.clearLayers();
        return;
      }

      const params = new URLSearchParams({
        minLat: String(b.getSouth()),
        maxLat: String(b.getNorth()),
        minLon: String(b.getWest()),
        maxLon: String(b.getEast()),
        limit: '600',
      });

      fetch(`/.netlify/functions/get-parcels-in-bounds?${params}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data?.parcels) return;
          parcelLayer.clearLayers();
          for (const p of data.parcels) {
            const score = p.conditionScore;
            const fill = scoreColor(score);
            const r = score ? 4 + (score / 100) * 4 : 4; // 4-8px by score
            L.circleMarker([p.lat, p.lon], {
              radius: r,
              color: fill,
              fillColor: fill,
              fillOpacity: 0.55,
              weight: 0.5,
            })
              .bindPopup(
                `<div style="font-family:sans-serif;font-size:12px;line-height:1.5">
                  <strong>${p.address || p.apn}</strong><br/>
                  ${p.city || ''} ${p.zip || ''}<br/>
                  ${p.yearBuilt ? 'Built ' + p.yearBuilt + ' · ' : ''}${p.sqft ? Number(p.sqft).toLocaleString() + ' sqft' : ''}<br/>
                  ${score ? '<strong style="color:' + fill + '">DNA Score: ' + score + '</strong>' : ''}
                  ${p.isRemodeled ? '<br/><em>Recently Remodeled</em>' : p.isOriginal ? '<br/><em>Original Condition</em>' : ''}
                </div>`
              )
              .addTo(parcelLayer);
          }
        })
        .catch(() => { /* swallow */ });
    };

    const onMoveEnd = () => {
      if (fetchTimerRef.current) window.clearTimeout(fetchTimerRef.current);
      fetchTimerRef.current = window.setTimeout(fetchParcels, 400);
    };

    map.on('moveend', onMoveEnd);
    map.on('zoomend', onMoveEnd);

    // Force tile redraw + initial fetch after mount
    setTimeout(() => {
      map.invalidateSize();
      fetchParcels();
    }, 250);

    return () => {
      try {
        map.off('moveend', onMoveEnd);
        map.off('zoomend', onMoveEnd);
        if (fetchTimerRef.current) window.clearTimeout(fetchTimerRef.current);
        map.remove();
      } catch { /* ignore */ }
      mapRef.current = null;
      parcelLayerRef.current = null;
    };
  }, [lat, lon, address, comps, priceColor]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', minHeight: 420, background: '#0a0a0a' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%', minHeight: 420 }} />
      {/* Legend overlay */}
      <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(10,10,10,0.85)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 12px', fontFamily: 'Jost, sans-serif', fontSize: 10, color: '#F0EBE0', zIndex: 1000, letterSpacing: 1 }}>
        <div style={{ marginBottom: 6, color: '#6B6252', textTransform: 'uppercase', letterSpacing: 2 }}>DNA Score</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2D9142' }} /> 80+
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#C9A84C' }} /> 50–64
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#B85245' }} /> &lt;35
        </div>
        <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)', color: '#6B6252', fontSize: 9 }}>
          Pan/zoom to load
        </div>
      </div>
    </div>
  );
}
