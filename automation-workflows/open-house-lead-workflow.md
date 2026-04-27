# Open House Lead Workflow

**Webhook path**: `POST /webhook/stuart-team/open-house`
**Trigger**: QR code scan → form submit on `/open-house?property=SLUG&agent=daniel&source=qr`

---

## n8n Node Chain

```
[1] Webhook Trigger
      ↓
[2] Normalize Lead Data (Code)
      ↓
[3] Save to Supabase (HTTP Request → /rest/v1/leads)
      ↓
[4] Gmail: Instant Reply to Lead
      ↓
[5] Gmail: Internal Alert to Daniel
      ↓
[6] SMS Alert to Daniel (Twilio) ← [NEEDS TWILIO KEY]
      ↓
[7] Constant Contact: Add/Update Contact + Tag
      ↓
[8] Google Sheets: Append Row (optional)
      ↓
[9] Wait 2 hours → [10] Follow-up Email #1 (3-day sequence)
```

---

## Node Configs

### [1] Webhook Trigger
- Method: POST
- Path: `stuart-team/open-house`
- Response mode: Immediately

### [2] Normalize Lead Data
```javascript
const b = $input.item.json;
return [{
  json: {
    funnelType: 'OPEN_HOUSE',
    fullName: [b.firstName, b.lastName].filter(Boolean).join(' ') || 'Guest',
    firstName: b.firstName || '',
    lastName: b.lastName || '',
    email: b.email || '',
    phone: b.phone || '',
    propertyAddress: b.propertyAddress || '',
    community: b.community || '',
    campaign: b.campaign || '',
    interest: b.interest || '',
    buyerTimeline: b.buyerTimeline || '',
    workingWithAgent: b.workingWithAgent || '',
    message: b.message || '',
    leadSource: b.leadSource || 'qr_open_house',
    qrSource: b.qrSource || '',
    agent: b.agent || 'daniel_stuart',
    timestamp: b.timestamp || new Date().toISOString(),
    pageUrl: b.pageUrl || '',
  }
}];
```

### [4] Gmail: Instant Reply to Lead
- **To**: `{{ $json.email }}`
- **Subject**: `Welcome to {{ $json.propertyAddress || 'the open house' }} — Daniel Stuart`
- **Body**:
```html
<p>Hi {{ $json.firstName }},</p>
<p>Thanks for stopping by{{ $json.propertyAddress ? ' ' + $json.propertyAddress : '' }}. I'll send you the full property details and a list of similar homes in the area shortly.</p>
<p>If you have any questions, reply directly to this email or text me at [YOUR PHONE].</p>
<p>— Daniel Stuart<br>Stuart Team Real Estate<br>Palm Springs / Coachella Valley</p>
```

### [5] Gmail: Internal Alert to Daniel
- **To**: `stuartteamps@gmail.com`
- **Subject**: `[Open House Lead] {{ $json.fullName }} — {{ $json.propertyAddress }}`
- **Body**: Full lead payload as HTML table

### [6] SMS Alert (Twilio)
- **To**: `[DANIEL_PHONE]` — replace with real number
- **Message**:
```
New Open House lead: {{ $json.fullName }}
{{ $json.email }} | {{ $json.phone }}
Property: {{ $json.propertyAddress }}
Timeline: {{ $json.buyerTimeline }}
Interest: {{ $json.interest }}
```
**Placeholder**: Replace with Twilio HTTP Request node when `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are set.

### [7] Constant Contact
- **Action**: Add or update contact
- **Email**: `{{ $json.email }}`
- **Lists**: Open House Visitors + `{{ $json.campaign }}`
- **Custom fields**: buyerTimeline, workingWithAgent, propertyAddress

### Follow-up Sequence (days 1, 3, 7)
- Day 1: "Here are similar homes in [community]"
- Day 3: "Still interested in [address]? Here's what I know about the area."
- Day 7: "Any questions from your visit? I'm happy to chat."
