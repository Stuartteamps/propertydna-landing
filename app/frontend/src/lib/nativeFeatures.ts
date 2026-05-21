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
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 });
    return { lat: p.coords.latitude, lon: p.coords.longitude };
  } catch { return null; }
}
