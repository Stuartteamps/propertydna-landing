# ManyChat Keyword Trigger Configuration

How the comment-bait CTAs in carousel posts map to ManyChat flows.

**Setup in ManyChat:**
1. Go to **Automations** → **Default Reply** (or Instagram Comment Trigger)
2. For each trigger word below, create a **Keyword** automation
3. **Match type:** "Message contains" (so "DOSSIER!" or "send me the dossier please" both fire)
4. **Action:** Send the response message → Tag user → optionally add to email sequence

---

## Trigger word library

| Keyword     | Triggered by post                              | DM response sends | Lead tag         |
|-------------|-----------------------------------------------|-------------------|------------------|
| DOSSIER     | General dossier offer                          | Generic dossier   | dossier_interest |
| VERIFIED    | 70% celebrity claims aren't documentable post  | Verified list     | celebrity_interest |
| SINATRA     | Frank Sinatra 4 homes post                     | Sinatra map       | sinatra_interest |
| FREY        | Frey House II post                             | Frey dossier      | frey_interest    |
| FREY47      | 47 Frey commissions post                       | Frey full list    | architect_interest |
| BOND        | Diamonds Are Forever / Elrod                   | Elrod dossier     | film_provenance  |
| HOPE        | Bob Hope mushroom-roof post                    | Bob Hope dossier  | lautner_interest |
| LIBERACE    | Liberace piano pool                            | Liberace dossier  | celebrity_interest |
| SMOKE       | Walt Disney Smoke Tree Ranch                   | Smoke Tree dossier| neighborhood_interest |
| INDEX       | 16,787 pedigree breakdown                      | Pedigree index    | data_interest    |
| LAUTNER     | Lautner 8 homes / 4.7 yr frequency             | Lautner portfolio | architect_interest |
| STORY       | Every property has a story                     | Custom outreach   | owner_lead       |
| DUE         | Buyer due diligence checklist                  | Checklist PDF     | buyer_lead       |

---

## Recommended ManyChat flow structure (per keyword)

```
[USER comments keyword on post]
  ↓
[ManyChat sends auto DM #1 — see DM library]
  ↓
[Wait 1 minute]
  ↓
[Send DM #2 — the actual link]
  ↓
[Wait 2 days]
  ↓
[If no reply: send follow-up #3]
  ↓
[Add user to Mailchimp "luxury_interest" tag if email captured]
```

---

## Comment auto-reply (public, on the post itself)

When ManyChat triggers, also have it post a public comment reply on the post like:

> "Sent! Check your DMs 📩"
> "DMing the dossier now 📂"
> "On its way — check your inbox ⚡"

These public replies do TWO things:
1. Signal to the algorithm the post is generating engagement → more reach
2. Show other viewers "I should also comment to get it"

---

## Quick setup checklist

- [ ] Open ManyChat dashboard
- [ ] Create one Keyword automation per row above
- [ ] Set match type to "Message contains" (not exact match)
- [ ] Link each to the matching flow in `manychat-dm-library.md`
- [ ] Enable public comment auto-reply per trigger
- [ ] Test on staging Instagram post before going live
- [ ] Set up "no keyword" fallback to send polite "Hi! What can I help with?"
