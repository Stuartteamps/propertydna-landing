import { Capacitor } from '@capacitor/core';

// Centralized wrappers around Capacitor plugins so calling code doesn't have
// to know about platform detection or do dynamic imports. Each helper is safe
// to call from the web — it becomes a no-op or a sensible fallback.

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

// Haptics — light tap on primary CTAs. On web this is a no-op.
export async function tapHaptic(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch { /* plugin unavailable */ }
}

export async function successHaptic(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Success });
  } catch { /* plugin unavailable */ }
}

// Native Share sheet on iOS/Android, Web Share API fallback on browser.
// Returns true if the share dialog was presented.
export async function shareSheet(opts: { title?: string; text?: string; url?: string; dialogTitle?: string }): Promise<boolean> {
  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: opts.title || 'PropertyDNA Report',
        text: opts.text || '',
        url: opts.url || '',
        dialogTitle: opts.dialogTitle || 'Share this property report',
      });
      return true;
    } catch { return false; }
  }
  if (typeof navigator !== 'undefined' && (navigator as any).share) {
    try {
      await (navigator as any).share({ title: opts.title, text: opts.text, url: opts.url });
      return true;
    } catch { return false; }
  }
  return false;
}

// Current geolocation — returns null if user denies or plugin unavailable.
export async function getCurrentPosition(): Promise<{ lat: number; lon: number } | null> {
  if (!isNative()) {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
          () => resolve(null),
          { timeout: 10000 }
        );
      });
    }
    return null;
  }
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
    return { lat: p.coords.latitude, lon: p.coords.longitude };
  } catch { return null; }
}

export interface ReverseGeocodeResult {
  street: string;
  city: string;
  state: string;
  zip: string;
  display: string;
  lat: number;
  lon: number;
}

// Reverse-geocode lat/lon to a postal address using OpenStreetMap Nominatim
// (same provider AddressAutocomplete uses for forward geocoding — keeps results
// consistent and avoids introducing a new API key).
export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    const street = [a.house_number, a.road].filter(Boolean).join(' ');
    const city = a.city || a.town || a.village || a.county || '';
    const state = a.state || '';
    const zip = a.postcode || '';
    const display = street ? `${street}, ${city}, ${state} ${zip}`.trim().replace(/,\s*$/, '') : (data.display_name || '');
    return { street, city, state, zip, display, lat, lon };
  } catch { return null; }
}

// One-shot helper: ask for permission, get location, reverse-geocode to address.
// Returns null on any failure (denied permission, no signal, network error).
export async function getCurrentAddress(): Promise<ReverseGeocodeResult | null> {
  const pos = await getCurrentPosition();
  if (!pos) return null;
  return reverseGeocode(pos.lat, pos.lon);
}

// ── Native iOS WKScriptMessageHandler bridges ──────────────────────────────
// These are wired in Swift by PropertyDNABridgeViewController. Each helper
// posts a message to a handler registered on the WKWebView's user content
// controller; the native code presents a real UIViewController (Vision OCR
// camera, MKMapView, etc.) and returns the result via a CustomEvent
// dispatched on window. The web layer never renders these surfaces — they
// are native iOS UI, not WebKit DOM.

interface WebkitWindow {
  webkit?: {
    messageHandlers?: Record<string, { postMessage: (msg: unknown) => void }>;
  };
}

function postNativeMessage(handler: string, payload: unknown): boolean {
  if (!isNative()) return false;
  const w = window as unknown as WebkitWindow;
  const mh = w.webkit?.messageHandlers?.[handler];
  if (!mh) return false;
  mh.postMessage(payload);
  return true;
}

let scanCallbackCounter = 0;
const pendingScans = new Map<string, (address: string | null) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('pdnaScanAddressResult', (e: Event) => {
    const detail = (e as CustomEvent).detail || {};
    const cb = pendingScans.get(detail.callbackId);
    if (cb) {
      pendingScans.delete(detail.callbackId);
      cb(detail.address || null);
    }
  });
}

/// Presents the native AVCaptureSession + Vision text-recognition scanner.
/// On a successful match, resolves with the recognized address string. On
/// cancel or platform unavailability, resolves with null.
export function scanAddressFromCamera(): Promise<string | null> {
  if (!isNative()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const callbackId = `scan-${Date.now()}-${++scanCallbackCounter}`;
    pendingScans.set(callbackId, resolve);
    const ok = postNativeMessage('pdnaScanAddress', { callbackId });
    if (!ok) {
      pendingScans.delete(callbackId);
      resolve(null);
    }
    // Safety timeout in case the native side never returns.
    setTimeout(() => {
      if (pendingScans.has(callbackId)) {
        pendingScans.delete(callbackId);
        resolve(null);
      }
    }, 120_000);
  });
}

/// Opens a full-screen native MKMapView centered on the given coordinates.
/// Standard/Satellite/Hybrid toggle + Directions button (launches Apple Maps).
export function openNativeMap(lat: number, lon: number, label?: string): boolean {
  return postNativeMessage('pdnaOpenNativeMap', { lat, lon, label });
}

/// Indexes a report in iOS Spotlight so users can find it from the home
/// screen pull-down search without opening the app first.
export function indexReportInSpotlight(report: {
  id: string;
  address: string;
  dnaScore?: number;
  rating?: string;
  reportUrl?: string;
}): boolean {
  return postNativeMessage('pdnaIndexReport', report);
}

export function removeReportFromSpotlight(id: string): boolean {
  return postNativeMessage('pdnaDeindexReport', { id });
}
