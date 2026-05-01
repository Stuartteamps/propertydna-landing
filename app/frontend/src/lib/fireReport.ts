/**
 * Fires the n8n report webhook directly — used by the one-click submit flow
 * when the user is already signed in and doesn't need the full /analyze form.
 */

const N8N_URL = import.meta.env.VITE_N8N_WEBHOOK_URL
  || 'https://dillabean.app.n8n.cloud/webhook/homefax/report';

export interface ReportParams {
  email: string;
  fullName: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  role?: string;
  phone?: string;
}

export async function fireReport(params: ReportParams): Promise<{ requestId?: string }> {
  try {
    const res = await fetch(N8N_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName:        params.fullName  || '',
        email:           params.email,
        phone:           params.phone     || '',
        role:            params.role      || 'Buyer',
        address:         params.address,
        city:            params.city      || '',
        state:           params.state     || '',
        zip:             params.zip       || '',
        stripeSessionId: 'bypass',
        paid:            true,
        leadSource:      'property_dna_web',
        pageUrl:         'https://thepropertydna.com',
        timestamp:       new Date().toISOString(),
      }),
    });
    return await res.json().catch(() => ({}));
  } catch {
    return {};
  }
}
