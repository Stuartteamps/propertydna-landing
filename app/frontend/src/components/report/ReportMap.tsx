// Lazy-loaded map component — isolated so Leaflet crashes don't kill the full report
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  lat: number; lon: number;
  address: string;
  comps: any[];
  priceColor: (p: number) => string;
}

export default function ReportMap({ lat, lon, address, comps, priceColor }: Props) {
  const compsWithCoords = comps.filter((c: any) => c.lat && c.lon);
  const priceRange = compsWithCoords.length > 0
    ? { min: Math.min(...compsWithCoords.map((c: any) => c.rawPrice || 0)), max: Math.max(...compsWithCoords.map((c: any) => c.rawPrice || 1)) }
    : { min: 0, max: 1 };

  return (
    <MapContainer center={[lat, lon]} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='© <a href="https://carto.com/">CARTO</a>'
      />
      {compsWithCoords.map((comp: any, i: number) => (
        <CircleMarker key={i} center={[Number(comp.lat), Number(comp.lon)]}
          radius={8 + Math.min(16, (comp.rawPrice || 500000) / 100000)}
          pathOptions={{ color: '#C9A84C', fillColor: priceColor(comp.rawPrice || 500000), fillOpacity: 0.75, weight: 1 }}>
          <Popup>
            <div style={{ fontFamily: 'sans-serif', fontSize: 13 }}>
              <strong>{comp.address}</strong><br />{comp.price} · {comp.sqft} · {comp.distance}
            </div>
          </Popup>
        </CircleMarker>
      ))}
      <CircleMarker center={[lat, lon]} radius={14}
        pathOptions={{ color: '#C9A84C', fillColor: '#C9A84C', fillOpacity: 1, weight: 2 }}>
        <Popup><strong>Subject Property</strong><br />{address}</Popup>
      </CircleMarker>
    </MapContainer>
  );
}
