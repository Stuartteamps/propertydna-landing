declare global {
  interface Window { google?: any; __gPlacesReady?: boolean; }
}

let loadPromise: Promise<void> | null = null;

export function loadGooglePlaces(): Promise<void> {
  if (window.google?.maps?.places) return Promise.resolve();
  if (loadPromise) return loadPromise;

  const key = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
  if (!key) return Promise.reject(new Error('VITE_GOOGLE_PLACES_API_KEY not set'));

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-gplaces]');
    if (existing) {
      const interval = setInterval(() => {
        if (window.google?.maps?.places) { clearInterval(interval); resolve(); }
      }, 80);
      setTimeout(() => { clearInterval(interval); reject(new Error('timeout')); }, 12000);
      return;
    }
    const script = document.createElement('script');
    script.setAttribute('data-gplaces', '1');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Places load failed'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export interface PlaceResult {
  fullAddress: string;
  streetNumber: string;
  route: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lon: number | null;
}

export function attachAutocomplete(
  input: HTMLInputElement,
  onSelect: (result: PlaceResult) => void,
): () => void {
  if (!window.google?.maps?.places) return () => {};

  const ac = new window.google.maps.places.Autocomplete(input, {
    types: ['address'],
    componentRestrictions: { country: 'us' },
    fields: ['address_components', 'formatted_address', 'geometry'],
  });

  const listener = ac.addListener('place_changed', () => {
    const place = ac.getPlace();
    if (!place.address_components) return;

    const get = (type: string, short = false) =>
      place.address_components.find((c: any) => c.types.includes(type))
        ?.[short ? 'short_name' : 'long_name'] ?? '';

    const streetNum = get('street_number');
    const route = get('route');
    onSelect({
      fullAddress: place.formatted_address || `${streetNum} ${route}`.trim(),
      streetNumber: streetNum,
      route,
      city: get('locality') || get('sublocality') || get('administrative_area_level_2'),
      state: get('administrative_area_level_1', true),
      zip: get('postal_code'),
      lat: place.geometry?.location?.lat() ?? null,
      lon: place.geometry?.location?.lng() ?? null,
    });
  });

  // Prevent form submit on Enter when autocomplete is open
  const keydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && document.querySelector('.pac-container')) e.preventDefault();
  };
  input.addEventListener('keydown', keydown);

  return () => {
    window.google?.maps?.event?.removeListener(listener);
    input.removeEventListener('keydown', keydown);
  };
}
