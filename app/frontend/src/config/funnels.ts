// ─────────────────────────────────────────────────────────────────────────────
// Funnel Webhook Configuration
// Paste your n8n webhook URLs in .env (VITE_*) or directly here for testing.
// All webhooks expect a POST with JSON — see test-payloads/ for payload shapes.
// ─────────────────────────────────────────────────────────────────────────────

const N8N = import.meta.env.VITE_N8N_BASE_URL || 'https://dillabean.app.n8n.cloud/webhook';

export const FUNNELS = {
  PROPERTY_DNA:       import.meta.env.VITE_PROPERTY_DNA_WEBHOOK_URL       || `${N8N}/homefax/report`,
  OPEN_HOUSE:         import.meta.env.VITE_OPEN_HOUSE_WEBHOOK_URL         || `${N8N}/stuart-team/open-house`,
  SELLER_VALUATION:   import.meta.env.VITE_SELLER_VALUATION_WEBHOOK_URL   || `${N8N}/stuart-team/seller-valuation`,
  BUYER_KEYS:         import.meta.env.VITE_BUYER_KEYS_WEBHOOK_URL         || `${N8N}/stuart-team/buyer-access`,
  OFF_MARKET:         import.meta.env.VITE_OFF_MARKET_WEBHOOK_URL         || `${N8N}/stuart-team/off-market`,
  NEWSLETTER:         import.meta.env.VITE_NEWSLETTER_SIGNUP_WEBHOOK_URL  || `${N8N}/stuart-team/newsletter`,
  CONTACT:            import.meta.env.VITE_CONTACT_WEBHOOK_URL            || `${N8N}/stuart-team/contact`,
} as const;

export type FunnelType = keyof typeof FUNNELS;

// Agent config — update when adding team members
export const AGENTS = {
  daniel_stuart: {
    name: 'Daniel Stuart',
    email: 'stuartteamps@gmail.com',
    phone: '760-555-0100',
    title: 'Luxury Real Estate Broker',
    market: 'Palm Springs / Coachella Valley',
  },
} as const;

export const DEFAULT_AGENT = AGENTS.daniel_stuart;
