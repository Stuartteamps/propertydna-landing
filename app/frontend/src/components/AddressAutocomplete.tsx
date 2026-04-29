import { useState, useRef, useEffect, useCallback } from 'react';

export interface AddressResult {
  display: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lon: number | null;
}

interface NominatimHit {
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country_code?: string;
  };
  lat: string;
  lon: string;
}

function parseNominatim(hit: NominatimHit): AddressResult {
  const a = hit.address;
  const streetNum = a.house_number || '';
  const route     = a.road || '';
  const street    = [streetNum, route].filter(Boolean).join(' ');
  const city      = a.city || a.town || a.village || a.county || '';
  const state     = a.state || '';
  const zip       = a.postcode || '';
  const display   = street ? `${street}, ${city}, ${state} ${zip}`.trim().replace(/,\s*$/, '') : hit.display_name;
  return { display, street, city, state, zip, lat: Number(hit.lat) || null, lon: Number(hit.lon) || null };
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSelect: (result: AddressResult) => void;
  placeholder?: string;
  inputStyle?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
  autoFocus?: boolean;
}

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder, inputStyle, containerStyle, autoFocus }: Props) {
  const [suggestions, setSuggestions] = useState<AddressResult[]>([]);
  const [open, setOpen]               = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController>();

  const fetchSuggestions = useCallback((q: string) => {
    if (q.length < 5) { setSuggestions([]); setOpen(false); return; }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      try {
        const params = new URLSearchParams({
          format: 'json',
          addressdetails: '1',
          limit: '6',
          countrycodes: 'us',
          q,
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { 'Accept-Language': 'en' },
          signal: abortRef.current.signal,
        });
        const hits: NominatimHit[] = await res.json();
        // Only show results with a house number (actual addresses, not just cities)
        const filtered = hits
          .filter(h => h.address.house_number || h.address.road)
          .map(parseNominatim)
          .filter(r => r.street);
        setSuggestions(filtered.length ? filtered : hits.slice(0, 4).map(parseNominatim));
        setOpen(filtered.length > 0 || hits.length > 0);
        setHighlighted(-1);
      } catch (e: any) {
        if (e.name !== 'AbortError') setSuggestions([]);
      }
    }, 320);
  }, []);

  useEffect(() => {
    fetchSuggestions(value);
  }, [value, fetchSuggestions]);

  // Close on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (!containerRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const handleSelect = (r: AddressResult) => {
    onChange(r.display);
    onSelect(r);
    setSuggestions([]);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && highlighted >= 0) { e.preventDefault(); handleSelect(suggestions[highlighted]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', ...containerStyle }}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length && setOpen(true)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        style={inputStyle}
      />

      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
          background: '#111', border: '1px solid rgba(201,168,76,0.35)',
          borderTop: 'none', maxHeight: 260, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {suggestions.map((r, i) => (
            <div
              key={i}
              onMouseDown={() => handleSelect(r)}
              style={{
                padding: '11px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: highlighted === i ? 'rgba(201,168,76,0.12)' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, fontWeight: 300, color: '#F0EBE0', lineHeight: 1.3 }}>
                {r.street || r.display.split(',')[0]}
              </div>
              {(r.city || r.state) && (
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: '#6B6252', marginTop: 3, letterSpacing: '0.5px' }}>
                  {[r.city, r.state, r.zip].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          ))}
          <div style={{ padding: '6px 14px', fontFamily: 'Jost, sans-serif', fontSize: 9, color: 'rgba(107,98,82,0.4)', letterSpacing: 1, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            © OpenStreetMap contributors
          </div>
        </div>
      )}
    </div>
  );
}
