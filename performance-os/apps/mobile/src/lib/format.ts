export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function fmtHours(h: number | null | undefined): string {
  if (h === null || h === undefined) return "—";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins.toString().padStart(2, "0")}m`;
}

export function confidenceLabel(c: number): string {
  if (c >= 0.8) return "High";
  if (c >= 0.6) return "Medium";
  return "Low";
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
