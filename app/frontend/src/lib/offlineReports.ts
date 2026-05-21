import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// Local report cache backed by @capacitor/preferences. Lets the iOS/Android app
// surface reports the user has already viewed when the device is offline — a
// feature the web version cannot provide. Stored as a single JSON list keyed
// by report id; capped at 25 entries to bound disk usage.

export interface SavedReport {
  id: string;
  address: string;
  savedAt: number;
  reportUrl?: string;
}

const KEY = 'pdna_saved_reports_v1';
const MAX = 25;

function available(): boolean {
  return Capacitor.isNativePlatform();
}

export async function saveReportOffline(entry: SavedReport): Promise<void> {
  if (!available()) return;
  const list = await listSavedReports();
  const deduped = list.filter(r => r.id !== entry.id);
  deduped.unshift({ ...entry, savedAt: Date.now() });
  const capped = deduped.slice(0, MAX);
  await Preferences.set({ key: KEY, value: JSON.stringify(capped) });
}

export async function listSavedReports(): Promise<SavedReport[]> {
  if (!available()) return [];
  const { value } = await Preferences.get({ key: KEY });
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function removeSavedReport(id: string): Promise<void> {
  if (!available()) return;
  const list = await listSavedReports();
  const filtered = list.filter(r => r.id !== id);
  await Preferences.set({ key: KEY, value: JSON.stringify(filtered) });
}

export async function clearSavedReports(): Promise<void> {
  if (!available()) return;
  await Preferences.remove({ key: KEY });
}
