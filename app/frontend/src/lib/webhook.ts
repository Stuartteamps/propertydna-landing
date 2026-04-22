// src/lib/webhook.ts
// Single source of truth for all n8n submissions.
// Import this everywhere — never call fetch directly from components.

export type Intent = 'report_request' | 'access_request';

export interface WebhookPayload {
  source: 'propertydna-site';
  intent: Intent;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  company: string;
  role: string;
  notes: string;
  pageUrl: string;
  userAgent: string;
  submittedAt: string;
  requestId: string;
}

export interface WebhookResponse {
  ok: boolean;
  message: string;
  requestId: string;
}

export type SubmitResult =
  | { success: true; requestId: string }
  | { success: false; error: string };

// ─────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────

function generateRequestId(): string {
  return `pdna-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getWebhookUrl(): string {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined;
  if (!url) {
    throw new Error(
      'VITE_N8N_WEBHOOK_URL is not defined. Add it to your .env file.'
    );
  }
  return url;
}

function buildPayload(
  intent: Intent,
  overrides: Partial<Omit<WebhookPayload, 'source' | 'intent' | 'pageUrl' | 'userAgent' | 'submittedAt' | 'requestId'>>
): WebhookPayload {
  return {
    source: 'propertydna-site',
    intent,
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    company: '',
    role: '',
    notes: '',
    pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    submittedAt: new Date().toISOString(),
    requestId: generateRequestId(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

export async function submitToN8n(
  intent: Intent,
  fields: Partial<Omit<WebhookPayload, 'source' | 'intent' | 'pageUrl' | 'userAgent' | 'submittedAt' | 'requestId'>>
): Promise<SubmitResult> {
  const payload = buildPayload(intent, fields);

  try {
    const res = await fetch(getWebhookUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown server error');
      return {
        success: false,
        error: `Server responded with ${res.status}: ${text}`,
      };
    }

    const data = (await res.json()) as WebhookResponse;

    if (!data.ok) {
      return {
        success: false,
        error: data.message ?? 'Submission rejected by server',
      };
    }

    return { success: true, requestId: data.requestId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { success: false, error: message };
  }
}
