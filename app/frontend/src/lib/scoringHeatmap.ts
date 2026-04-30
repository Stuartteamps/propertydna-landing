import type { HeatParcel, HeatFilterWeights } from '@/types/heatmap';

export const DEFAULT_HEAT_WEIGHTS: HeatFilterWeights = {
  comps: 0.20, priceDelta: 0.20, dom: 0.15, permits: 0.15, livability: 0.15, rentalDemand: 0.15,
};

export function computeHeatScore(p: HeatParcel, w: HeatFilterWeights): number {
  const total =
    w.comps * p.compsScore + w.priceDelta * p.priceDeltaScore + w.dom * p.domScore +
    w.permits * p.permitsScore + w.livability * p.livability + w.rentalDemand * p.rentalDemand;
  const sum = w.comps + w.priceDelta + w.dom + w.permits + w.livability + w.rentalDemand;
  return Math.round(total / sum);
}

export function heatScoreLabel(score: number): string {
  if (score >= 80) return 'Strong Buy';
  if (score >= 65) return 'Buy';
  if (score >= 50) return 'Hold';
  if (score >= 35) return 'Watch';
  return 'Underperforming';
}

export function heatScoreBadgeColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 65) return '#84cc16';
  if (score >= 50) return '#eab308';
  if (score >= 35) return '#f97316';
  return '#ef4444';
}
