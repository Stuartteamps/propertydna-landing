// Data-confidence tiers for map UI. Thresholds (0.8 / 0.5) are intentionally
// distinct from the report PDF thresholds in save-report.js — this is the map's
// at-a-glance trust signal on HeatParcel.confidence (0–1).

export type ConfidenceTier = 'high' | 'moderate' | 'limited';

export function confidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'moderate';
  return 'limited';
}

export interface BadgeStyle {
  label: string;
  dot: string;
  text: string;
  bg: string;
  border: string;
}

/** Dark/gold palette — matches HoverTooltip aesthetic. */
export function confidenceBadgeDark(confidence: number): BadgeStyle {
  switch (confidenceTier(confidence)) {
    case 'high':
      return { label: 'High confidence', dot: '#4CAF7D', text: '#4CAF7D', bg: 'rgba(76,175,125,0.12)', border: 'rgba(76,175,125,0.35)' };
    case 'moderate':
      return { label: 'Moderate confidence', dot: '#B89355', text: '#B89355', bg: 'rgba(184,147,85,0.12)', border: 'rgba(184,147,85,0.35)' };
    case 'limited':
    default:
      return { label: 'Limited data', dot: '#6B6252', text: '#9B9080', bg: 'rgba(107,98,82,0.12)', border: 'rgba(107,98,82,0.35)' };
  }
}

/** Terminal-green palette — matches PropertyDrawer aesthetic. */
export function confidenceBadgeTerminal(confidence: number): BadgeStyle {
  switch (confidenceTier(confidence)) {
    case 'high':
      return { label: 'High confidence', dot: '#00ff88', text: '#00ff88', bg: 'rgba(0,255,136,0.08)', border: 'rgba(0,255,136,0.22)' };
    case 'moderate':
      return { label: 'Moderate confidence', dot: '#ffd166', text: '#ffd166', bg: 'rgba(255,209,102,0.08)', border: 'rgba(255,209,102,0.22)' };
    case 'limited':
    default:
      return { label: 'Limited data', dot: '#556b5f', text: 'rgba(180,220,200,0.45)', bg: 'rgba(85,107,95,0.08)', border: 'rgba(85,107,95,0.22)' };
  }
}
