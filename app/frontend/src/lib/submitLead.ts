// ─────────────────────────────────────────────────────────────────────────────
// Universal Lead Submission Utility
// Use this everywhere — never call fetch directly from a component.
// ─────────────────────────────────────────────────────────────────────────────

import { FUNNELS, FunnelType } from '../config/funnels';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LeadPayload {
  // Identity
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;

  // Property / context
  propertyAddress?: string;
  propertySlug?: string;
  community?: string;
  homeAddress?: string;

  // Intent
  interest?: string;
  message?: string;
  buyerTimeline?: string;
  sellerTimeline?: string;
  workingWithAgent?: string;
  priceRange?: string;
  bedrooms?: string;
  propertyType?: string;

  // Campaign
  agent?: string;
  campaign?: string;
  leadSource?: string;

  // Auto-populated (do not pass manually)
  funnelType?: FunnelType;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  qrSource?: string;
  pageUrl?: string;
  userAgent?: string;
  referrer?: string;
  timestamp?: string;
}

export type SubmitResult =
  | { success: true; message: string }
  | { success: false; error: string };

// ── UTM / QR helpers ─────────────────────────────────────────────────────────

function getUrlParams(): Partial<LeadPayload> {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  return {
    utmSource:   p.get('utm_source')   || p.get('source') || undefined,
    utmMedium:   p.get('utm_medium')   || undefined,
    utmCampaign: p.get('utm_campaign') || undefined,
    utmContent:  p.get('utm_content')  || undefined,
    qrSource:    p.get('source') === 'qr' ? (p.get('property') || 'unknown') : undefined,
    agent:       p.get('agent')        || undefined,
  };
}

// ── Main submit function ─────────────────────────────────────────────────────

export async function submitLead(
  funnelType: FunnelType,
  data: LeadPayload
): Promise<SubmitResult> {
  const webhookUrl = FUNNELS[funnelType];

  if (!webhookUrl) {
    console.error(`[submitLead] No webhook URL configured for funnel: ${funnelType}`);
    return { success: false, error: 'Funnel not configured. Contact support.' };
  }

  const urlParams = getUrlParams();

  const payload: LeadPayload = {
    funnelType,
    ...urlParams,
    ...data,
    // These always override — populate from browser context
    pageUrl:   typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    referrer:  typeof document !== 'undefined' ? document.referrer : '',
    timestamp: new Date().toISOString(),
  };

  // Merge agent from URL param if not explicitly set
  if (!payload.agent && urlParams.agent) {
    payload.agent = urlParams.agent;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const msg = `Server error ${res.status}${text ? ': ' + text.slice(0, 120) : ''}`;
      console.error(`[submitLead] ${funnelType}:`, msg);
      return { success: false, error: msg };
    }

    return { success: true, message: 'Submission received.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    console.error(`[submitLead] ${funnelType} network error:`, msg);
    // Graceful — don't crash the site
    return { success: false, error: 'Unable to reach server. Please try again.' };
  }
}
