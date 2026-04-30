import type { Parcel, FilterWeights } from '../types';

export const DEFAULT_WEIGHTS: FilterWeights = {
  comps: 0.20,
  priceDelta: 0.20,
  dom: 0.15,
  permits: 0.15,
  livability: 0.15,
  rentalDemand: 0.15,
};

export function computeScore(p: Parcel, weights: FilterWeights): number {
  const total =
    weights.comps * p.compsScore +
    weights.priceDelta * p.priceDeltaScore +
    weights.dom * p.domScore +
    weights.permits * p.permitsScore +
    weights.livability * p.livability +
    weights.rentalDemand * p.rentalDemand;

  const weightSum =
    weights.comps + weights.priceDelta + weights.dom +
    weights.permits + weights.livability + weights.rentalDemand;

  return Math.round(total / weightSum);
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Strong Buy';
  if (score >= 65) return 'Buy';
  if (score >= 50) return 'Hold';
  if (score >= 35) return 'Watch';
  return 'Underperforming';
}

export function scoreBadgeColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 65) return '#84cc16';
  if (score >= 50) return '#eab308';
  if (score >= 35) return '#f97316';
  return '#ef4444';
}
