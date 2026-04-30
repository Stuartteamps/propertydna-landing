const VIRIDIS: [number, number, number][] = [
  [68,  1,   84],
  [72,  35,  116],
  [64,  67,  135],
  [52,  94,  141],
  [41,  120, 142],
  [32,  144, 140],
  [34,  167, 132],
  [68,  190, 112],
  [122, 209, 81],
  [189, 223, 38],
  [253, 231, 37],
];

export function heatScoreToRgb(score: number): [number, number, number] {
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

export function heatScoreToHex(score: number): string {
  const [r, g, b] = heatScoreToRgb(score);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function heatScoreToRgba(score: number, alpha = 0.85): string {
  const [r, g, b] = heatScoreToRgb(score);
  return `rgba(${r},${g},${b},${alpha})`;
}
