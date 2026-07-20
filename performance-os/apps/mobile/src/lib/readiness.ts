import type { ReadinessBand } from "../api/types";

export const READINESS_COLORS: Record<ReadinessBand, string> = {
  green: "#2FBF71",
  yellow: "#F5B301",
  red: "#E5484D",
  unknown: "#8A94A6",
};

export function bandFromScore(score: number | null): ReadinessBand {
  if (score === null || Number.isNaN(score)) return "unknown";
  if (score >= 70) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

export function readinessLabel(band: ReadinessBand): string {
  switch (band) {
    case "green":
      return "Ready to push";
    case "yellow":
      return "Train moderately";
    case "red":
      return "Prioritize recovery";
    default:
      return "Not enough data";
  }
}

export function colorForScore(score: number | null): string {
  return READINESS_COLORS[bandFromScore(score)];
}
