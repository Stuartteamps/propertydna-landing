# PropertyDNA — Supabase & Stripe Setup Guide

## 1. Run Database Migrations

Open your Supabase project → **SQL Editor** → paste and run each file in order:

| Step | File | What it does |
|------|------|--------------|
| 1 | `migrations/001_schema.sql` | Creates all tables, indexes, triggers, and helper functions |
| 2 | `migrations/002_rls.sql` | Enables Row Level Security on all tables |
| 3 | `migrations/003_storage.sql` | Creates 5 storage buckets with access policies |

Go to: https://app.supabase.com/project/neccpdfhmfnvyjgyrysy/sql/new

---

## 2. Required Netlify Environment Variables

Set these in **Netlify → Site Settings → Environment Variables**:

### Supabase
| Variable | Value | Where to find |
|----------|-------|---------------|
| `SUPABASE_URL` | `https://neccpdfhmfnvyjgyrysy.supabase.co` | Supabase project Settings > API |
| `SUPABASE_SERVICE_KEY` | `sb_secret_...` | Supabase Settings > API > service_role key |
| `VITE_SUPABASE_URL` | same as above | For frontend builds |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_...` | Supabase Settings > API > anon key |

### Stripe
| Variable | Value | Where to find |
|----------|-------|---------------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | Stripe Dashboard > Developers > API Keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Auto-set by setup script (Stripe webhook endpoint) |
| `STRIPE_PRICE_ID` | `price_1TQviT...` | $49 per report (original) |
| `STRIPE_PRICE_PER_REPORT` | `price_1TQwGC...` | $4.99 per report |
| `STRIPE_PRICE_SUBSCRIPTION` | `price_1TQwGD...` | $49/month unlimited |
| `STRIPE_PRICE_ENTERPRISE` | `price_1TQwGE...` | $149/month enterprise |

### Internal
| Variable | Value |
|----------|-------|
| `INTERNAL_API_KEY` | Auto-generated 64-char hex (already set) |
| `VITE_N8N_WEBHOOK_URL` | `https://dillabean.app.n8n.cloud/webhook/homefax/report` |

---

## 3. Stripe Webhook

**Already registered** at:
```
https://thepropertydna.com/.netlify/functions/stripe-webhook
```

Webhook ID: `we_1TQwjpFtMY7bffn8wJRYzc5F`

Events handled:
- `checkout.session.completed` → creates payment + subscription or report record
- `customer.subscription.created/updated` → syncs subscription status
- `customer.subscription.deleted` → marks subscription canceled
- `invoice.paid` → renews subscription period, records payment
- `invoice.payment_failed` → marks subscription `past_due`, logs KPI

---

## 4. Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | One row per email — stores Stripe customer ID |
| `subscriptions` | Active/inactive subscription records from Stripe |
| `payments` | Every payment (one-time reports + subscription charges) |
| `property_reports` | Every DNA report (pending → completed/failed) |
| `leads` | All funnel form submissions (open house, seller, buyer, etc.) |
| `report_searches` | Address lookup history for analytics |
| `stripe_events` | Raw Stripe webhook events (idempotent audit log) |
| `kpi_events` | Analytics events (free_report, paid_report, sub_start, etc.) |
| `dashboard_activity` | User actions in the dashboard |

### KPI Event Types

| Event | When fired |
|-------|-----------|
| `free_report` | User runs their first free report |
| `paid_report_initiated` | User starts $4.99 checkout |
| `paid_report` | $4.99 payment confirmed |
| `sub_initiated` | User starts subscription checkout |
| `sub_start` | Subscription payment confirmed |
| `sub_cancel` | Subscription canceled |
| `subscription_renewal` | Monthly invoice paid |
| `failed_payment` | Invoice payment failed |
| `report_completed` | n8n delivers completed report |
| `report_error` | Report generation failed |
| `dashboard_login` | User looks up reports in dashboard |
| `usage_check` | Form pre-submit usage check |

---

## 5. Netlify Functions

| Function | Route | Purpose |
|----------|-------|---------|
| `check-usage` | `POST /.netlify/functions/check-usage` | Pre-submit: check reportCount + isSubscribed |
| `create-checkout` | `POST /.netlify/functions/create-checkout` | Create Stripe session or free bypass |
| `verify-payment` | `POST /.netlify/functions/verify-payment` | Confirm payment, write DB records |
| `stripe-webhook` | `POST /.netlify/functions/stripe-webhook` | Handle all Stripe events |
| `get-reports` | `POST /.netlify/functions/get-reports` | Dashboard: fetch report history |
| `save-report` | `POST /.netlify/functions/save-report` | n8n callback: mark report completed |

---

## 6. n8n Integration — save-report callback

After generating a report, add an HTTP Request node to your n8n workflow:

```
POST https://thepropertydna.com/.netlify/functions/save-report
Headers:
  Content-Type: application/json
  x-internal-key: {{$env.INTERNAL_API_KEY}}
Body:
{
  "email": "{{$json.email}}",
  "address": "{{$json.address}}",
  "city": "{{$json.city}}",
  "state": "{{$json.state}}",
  "zip": "{{$json.zip}}",
  "reportUrl": "{{$json.reportUrl}}",
  "stripeSessionId": "{{$json.stripeSessionId}}",
  "status": "completed",
  "n8nRequestId": "{{$execution.id}}"
}
```

Set `INTERNAL_API_KEY` as an n8n environment variable (copy from Netlify).

---

## 7. Storage Buckets

| Bucket | Public | Purpose |
|--------|--------|---------|
| `report-pdfs` | No | Generated PDF reports (signed URL access) |
| `report-json` | No | Raw report JSON data |
| `property-images` | Yes | Street view / property photos |
| `user-uploads` | No | User-submitted files |
| `exports` | No | Bulk exports / CSVs |

File path convention:
```
report-pdfs/{email}/{report-id}.pdf
report-json/{email}/{report-id}.json
property-images/{report-id}/{filename}
```

---

## 8. Security Notes

- `SUPABASE_SERVICE_KEY` is used **only** in Netlify functions (server-side). Never expose in frontend.
- `VITE_SUPABASE_ANON_KEY` is public but protected by RLS. Only `property_reports` (read-only) is accessible to anon.
- All financial data (`payments`, `subscriptions`, `stripe_events`) has `FOR ALL TO anon USING (false)` — completely blocked from frontend.
- Stripe webhook verifies `stripe-signature` header using `STRIPE_WEBHOOK_SECRET`.
- `save-report` requires `x-internal-key` header.

---

## 9. Legacy Compatibility

The original `reports` table (used by n8n Stuart Team workflows) is **not modified**. All new data goes into the new tables. Both systems run in parallel.
