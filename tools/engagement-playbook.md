# PropertyDNA Daily Engagement Playbook

How to drive comments, likes, DMs, and conversions from each carousel post.

---

## The pattern (every post)

```
[7am: post fires via Buffer]
  ↓
[7-8am: reply to every early commenter publicly]
  ↓
[ManyChat keyword fires → auto DM #1]
  ↓
[1 minute → auto DM #2 with link]
  ↓
[Dan checks /admin/ops dashboard end of day]
  ↓
[6pm: daily digest email summarizes the day]
```

---

## Reply rules (public comments)

Reply within 60 minutes — that's the algorithm window. Higher engagement → wider reach.

**If they ask a question:**
> answer in one short sentence + a follow-up question. don't give the whole thing away. drive them to DM.

**If they say "nice post" / "wow" / generic:**
> ❤️ thanks — which one's your favorite? (drives a longer thread)

**If they mention a specific home/architect:**
> "you've got good taste — that's actually a [verified X]. dossier here: [link]" (this is the public closer)

**If they tag a friend:**
> "tag them in! [friend] — you'd want this one"

**If they DM the keyword (instead of commenting):**
> Reply publicly on the post comment thread:
> "send! check your dms" or "incoming 📂"
> ↑ this is the signal to the algorithm that the post is converting

---

## When to post (optimal windows)

- **Instagram:** 7-9am PT or 6-8pm PT — desert demographic checks phone over coffee + after dinner
- **LinkedIn:** Tue-Thu 7-10am PT — they read at desks
- **Facebook:** 9-11am or 8-10pm — older demo
- **TikTok:** 8-11pm PT — late night doomscrolling
- **GBP:** any time, doesn't matter

Buffer 7am AM post hits IG/FB/LinkedIn at their best window. Add an evening Instagram-only post for second hit.

---

## How to read the daily digest email

**Green = good:**
- 0 errors
- ≥1 new lead
- Buffer 5/5 ok

**Yellow = check:**
- Reddit "nothing to post" (means queue is empty, add more)
- 0 new leads for 3+ days running (means CTAs aren't converting → revise)

**Red = act:**
- Any "error" line — open the dashboard, look at the error message
- "session_expired" on Reddit → re-run save-reddit-session.js

---

## What to do EACH morning (5 min)

1. Open /admin/ops (already on phone — bookmark it)
2. Glance at "Recent activity" → confirm Buffer fired
3. Open Instagram → reply to comments on yesterday's post (60-min window matters)
4. If 1+ new lead → answer it personally within 4 hours

---

## What to do EACH evening (3 min)

1. Read the daily digest email
2. If any errors → screenshot, send to Claude session
3. If hot lead came in → DM/email response before bed

---

## Monthly content review (15 min)

1. Open /admin/ops → check 30-day activity
2. Run marketing-stats: `node tools/browser-agent/marketing-stats.js`
3. Identify top-performing posts (by replies/DMs, not likes)
4. Note what worked → tell Claude in next session "the [topic] post got 47 DMs, make 3 more like that"

---

## The viral pattern that works

```
Hook (slide 1)
  → Specific number or claim that creates curiosity
  → "This $30M house has a 70-year secret"
  → "70% of celebrity-home claims aren't documentable"

Story (slides 2-5)
  → One stat per slide
  → Reference specific addresses, dates, names
  → Use the dossier data — it's all verified

Reveal (slide 6)
  → Drop the punchline
  → "It's the Elrod House. James Bond fought here."

CTA (slide 7)
  → Specific trigger word
  → "Comment DOSSIER for the file"
  → NEVER "Visit our website"
```

---

## Pages a comment-bait lead should hit

1. Instagram comments "DOSSIER" → DM with link to /pedigree-index
2. Clicks → lands on /pedigree-index → sees 53 dossiers
3. Clicks any dossier → /dossier/:apn (with the modal request CTA)
4. Submits modal → captured in dossier_requests table → email to Dan → /admin/ops alert
5. Dan answers within 4 hours

That's the full funnel. Everything in production. The bottleneck is at step 1: do we get enough comments? That's what this carousel + ManyChat update fixes.
