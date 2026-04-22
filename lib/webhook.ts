// src/lib/webhook.ts
// One file. One function. All n8n submissions go here.

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
  notes: string;
  pageUrl: string;
  userAgent: string;
  submittedAt: string;
}

export type Result =
  | { ok: true; requestId: string }
  | { ok: false; error: string };

type Fields = Partial<
  Omit<WebhookPayload, 'source' | 'intent' | 'pageUrl' | 'userAgent' | 'submittedAt'>
>;

export async function sendToN8n(intent: Intent, fields: Fields): Promise<Result> {
  const url = (import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined) ?? '';
  if (!url) return { ok: false, error: 'VITE_N8N_WEBHOOK_URL is not set.' };

  const payload: WebhookPayload = {
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
    notes: '',
    pageUrl: window.location.href,
    userAgent: navigator.userAgent,
    submittedAt: new Date().toISOString(),
    ...fields,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      return { ok: false, error: `Server ${res.status}${msg ? ': ' + msg : ''}` };
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: true, requestId: (data.requestId as string) ?? 'received' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}
