// Viridis palette sampled at 10 stops (score 0–100)
const VIRIDIS: [number, number, number][] = [
  [68,  1,   84],   // 0
  [72,  35,  116],  // 10
  [64,  67,  135],  // 20
  [52,  94,  141],  // 30
  [41,  120, 142],  // 40
  [32,  144, 140],  // 50
  [34,  167, 132],  // 60
  [68,  190, 112],  // 70
  [122, 209, 81],   // 80
  [189, 223, 38],   // 90
  [253, 231, 37],   // 100
];

export function scoreToRgb(score: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(100, score));
  const idx = clamped / 10;
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, 10);
  const t = idx - lo;
  const [r0, g0, b0] = VIRIDIS[lo];
  const [r1, g1, b1] = VIRIDIS[hi];
  return [
    Math.round(r0 + t * (r1 - r0)),
    Math.round(g0 + t * (g1 - g0)),
    Math.round(b0 + t * (b1 - b0)),
  ];
}

export function scoreToHex(score: number): string {
  const [r, g, b] = scoreToRgb(score);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function scoreToRgba(score: number, alpha = 0.85): string {
  const [r, g, b] = scoreToRgb(score);
  return `rgba(${r},${g},${b},${alpha})`;
}
