# ManyChat DM Auto-Response — Multi-Step Qualifier

**Last updated:** 2026-05-09
**Status:** Backend live (`/.netlify/functions/manychat-webhook`); ManyChat UI flow needs to be assembled by Dan in app.manychat.com.

---

## What this does

When someone DMs the trigger keyword on **Instagram** or **Facebook Messenger**, ManyChat runs a 3-step qualifier (role → first name → email → optional address), then calls our Netlify webhook. The webhook:

1. Logs the lead to Supabase `campaign_contacts` with `source: manychat_ig` or `manychat_fb`
2. Sends a Resend confirmation email tailored to the role (buyer / seller / agent / investor)
3. If they gave an address, queues a real PropertyDNA report via `queue-report`
4. Returns a personalized `/report-pending?bypass=1&...` URL pre-filled with their info

ManyChat then DMs them back with that link as a button. Tapping it generates the full report on the live site (no payment gate — `bypass=1`).

---

## Required environment variables (set in Netlify before going live)

Add to **Netlify → Site config → Environment variables**:

| Key | Value | Notes |
|---|---|---|
| `MANYCHAT_WEBHOOK_TOKEN` | (generate a random string, e.g. `openssl rand -hex 24`) | Shared secret. ManyChat sends it in the `x-manychat-token` header. |
| `INTERNAL_API_KEY` | (already set) | Used to authenticate fan-out calls to `send-lead-email`. |
| `URL` | (auto-set by Netlify) | Used to construct internal function URLs. |

Already set: `RESEND_API_KEY`, `SUPABASE_SERVICE_KEY`, `SENDER_EMAIL`, etc.

---

## ManyChat flow build steps (do this in app.manychat.com)

### 1. Connect channels
- Settings → Channels → connect **Instagram** (via Meta Business)
- Settings → Channels → connect **Facebook Messenger**
- Both channels share the same flow once a Custom Field/User Input flow is built generically.

### 2. Create custom user fields
Settings → Custom Fields → create:
- `lead_role` (text)
- `lead_email` (email)
- `lead_first_name` (text)
- `lead_address` (text)
- `report_url` (text) — populated by the webhook response
- `lead_funnel` (text) — populated by the webhook response
- `execution_id` (text) — populated by the webhook response

### 3. Create the trigger
Automation → New Automation → Trigger:
- **Instagram:** "User sends DM with a keyword" → keywords: `DNA`, `REPORT`, `VALUE`, `HOUSE`
- **Facebook:** "User sends a message containing keyword" → same keywords
- Optionally add: "Comment on any post" containing same keywords (auto-DMs the user)

### 4. Build the conversation flow

**Step 1 — Greeting + role qualifier (Quick Reply buttons):**
> "Hi! 👋 I'll pull you a free PropertyDNA report — full valuation, flood zone, comps, and a direct verdict. First, are you…"
>
> Quick replies (each saves to `lead_role`):
> - `Buying` → set `lead_role = buyer`
> - `Selling` → set `lead_role = seller`
> - `Agent / broker` → set `lead_role = agent`
> - `Investor` → set `lead_role = investor`

**Step 2 — Capture first name (User Input → save to `lead_first_name`):**
> "Awesome. What's your first name?"

**Step 3 — Capture email (User Input → validation: Email → save to `lead_email`):**
> "{{lead_first_name}}, what's the best email to send your report to?"

**Step 4 — Conditional branch on `lead_role`:**

- **If `seller`:** ask for address (User Input → save to `lead_address`)
  > "What's the address you'd like valued? (Street, city — e.g. 123 Palm Dr, Palm Springs)"
- **All other roles:** skip address step.

**Step 5 — External Request (this is where the magic happens):**

Add an **"External Request"** action with:
- **Method:** `POST`
- **URL:** `https://thepropertydna.com/.netlify/functions/manychat-webhook`
- **Headers:**
  - `Content-Type: application/json`
  - `x-manychat-token: <paste the MANYCHAT_WEBHOOK_TOKEN you set in Netlify>`
- **Body type:** `JSON`
- **Body:**
```json
{
  "role": "{{lead_role}}",
  "firstName": "{{lead_first_name}}",
  "email": "{{lead_email}}",
  "address": "{{lead_address}}",
  "platform": "ig",
  "igHandle": "{{ig_username}}",
  "subscriberId": "{{user_id}}"
}
```
> ⚠️ For the Facebook Messenger version of this flow, change `"platform": "ig"` → `"platform": "fb"` and use `{{first_name}}` instead of `{{ig_username}}` for the handle.

- **Response mapping:** ManyChat's "Dynamic Block" mode will auto-render the `messages` array we return AND auto-set `report_url`, `lead_funnel`, `execution_id` from the `actions` array. No manual mapping needed if you toggle "Use response as message" — but if that toggle isn't there in your ManyChat plan, manually map:
  - `content.messages[0].text` → message body
  - `content.actions[0].value` → `report_url`

**Step 6 — Final message (uses the field set by the webhook):**

If you used "Use response as message" in Step 5, the webhook's reply IS the final message — you're done.

Otherwise add a Send Message block:
> "{{response_text}}"
>
> Button: "Open my report" → URL: `{{report_url}}`

---

## VERIFIED keyword auto-DM flow (comment trigger — DO THIS FIRST)

This is a separate, simpler flow from the full qualifier above. When someone comments "VERIFIED" on a post (or DMs it), ManyChat instantly sends the celebrity-index teaser. No qualifier steps. One External Request, instant reply.

### Build steps (in app.manychat.com — 5 min)

**Part A: Comment trigger (catches Instagram post comments)**

1. Automation → New Automation → name it "Keyword Reply: VERIFIED"
2. Trigger → "Comment on post" → keyword: `VERIFIED` (match: contains, case-insensitive)
   - Toggle "Auto-reply to comment" OFF (you want a DM, not a comment reply)
   - Toggle "Send DM to commenter" ON
3. Add action → External Request:
   - Method: `POST`
   - URL: `https://thepropertydna.com/.netlify/functions/manychat-webhook`
   - Headers:
     - `Content-Type: application/json`
     - `x-manychat-token: f0eb57c3a9b6d4bc1770426a5823f8d97e1a23ac0a65a39e`
   - Body (JSON):
     ```json
     { "message_text": "VERIFIED", "platform": "ig", "subscriber_id": "{{subscriber_id}}" }
     ```
   - Toggle **"Use response as messages"** ON
4. Add action → Add Tag: `lead_celebrity`
5. Publish

**Part B: DM trigger (catches DMs containing "VERIFIED")**

1. Automation → New Automation → name it "DM Reply: VERIFIED"
2. Trigger → "User sends message" → keyword: `VERIFIED` (contains)
3. Same External Request as above (identical body)
4. Toggle **"Use response as messages"** ON
5. Publish

**Part C: Repeat for DOSSIER, SINATRA, FREY, BOND, HOPE, LAUTNER, LIBERACE (optional)**

The webhook handles all 13 keywords. For each: duplicate the flow, change the body keyword value and the tag name. Or use one "Default Reply" with `"message_text": "{{last_input_text}}"` and the webhook routes everything — but that fires on ALL DMs.

**Webhook token:** `f0eb57c3a9b6d4bc1770426a5823f8d97e1a23ac0a65a39e`

What the webhook returns (smoke-tested 2026-05-28):
- Message 1: celebrity teaser copy (Sinatra, Elvis, Hope, Liberace, Kaufmann)
- Message 2: pedigree-index link + free account hook + engagement question, with a "See the full index" button → `https://thepropertydna.com/pedigree-index`
- Actions: adds tags `lead_celebrity` + `lead_carousel_comment`, sets `lead_funnel = carousel_dm`

---

## Test the webhook locally before turning on the ManyChat flow

```bash
curl -X POST https://thepropertydna.com/.netlify/functions/manychat-webhook \
  -H "Content-Type: application/json" \
  -H "x-manychat-token: YOUR_TOKEN_HERE" \
  -d '{
    "role": "buyer",
    "firstName": "Test",
    "email": "stuartteamps@gmail.com",
    "platform": "ig"
  }'
```

Expected response:
```json
{
  "version": "v2",
  "content": {
    "messages": [{
      "type": "text",
      "text": "Awesome, Test. Tap below to run your free PropertyDNA report — ...",
      "buttons": [{"type": "url", "caption": "Run my free report", "url": "https://thepropertydna.com/report-pending?bypass=1&fullName=Test&email=stuartteamps%40gmail.com&role=Buyer&utm_source=manychat&..."}]
    }],
    "actions": [
      {"action": "set_field_value", "field_name": "report_url", "value": "..."},
      {"action": "set_field_value", "field_name": "lead_funnel", "value": "buyer"},
      {"action": "set_field_value", "field_name": "execution_id", "value": "mc_..."}
    ]
  }
}
```

Within ~10 seconds you should also receive the buyer confirmation email at `stuartteamps@gmail.com` and see a row in Supabase `campaign_contacts` with `metadata.source = "manychat_ig"`.

---

## Seller test (with address — should kick off a real report)

```bash
curl -X POST https://thepropertydna.com/.netlify/functions/manychat-webhook \
  -H "Content-Type: application/json" \
  -H "x-manychat-token: YOUR_TOKEN_HERE" \
  -d '{
    "role": "seller",
    "firstName": "Test",
    "email": "stuartteamps@gmail.com",
    "address": "123 Palm Canyon Dr",
    "city": "Palm Springs",
    "state": "CA",
    "zip": "92262",
    "platform": "ig"
  }'
```

This triggers `queue-report` in addition to `send-lead-email`. Within ~3 minutes the full DNA report should arrive at the email.

---

## What gets attribution

Every contact captured via this flow:
- Supabase `campaign_contacts.metadata.source` = `manychat_ig` or `manychat_fb`
- Resend email log: `metadata.source = "propertydna_lead"`, `funnel_type` set per-role
- KPI event: `manychat_lead` with `source`, `role`, `platform`, `has_address` flags
- All `/report-pending` URLs include `utm_source=manychat&utm_medium=ig_dm&utm_campaign=dm_qualifier` so it shows up cleanly in any analytics.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| 401 Unauthorized | `x-manychat-token` header missing or doesn't match Netlify env. |
| Webhook returns "Hmm — that email doesn't look right" | ManyChat passed an empty/invalid `lead_email` — check the User Input validation step. |
| No confirmation email arrives | Resend domain unverified or `RESEND_API_KEY` rotated. Check `email_delivery_events` table. |
| Report not generated for sellers | `address` was captured but `city` was empty. The webhook only fires `queue-report` when both are present. Add a "city" capture step in the seller branch, or merge city into the address prompt. |
