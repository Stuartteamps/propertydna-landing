# YouTube Automation Plan — Phased Build

## Phase 1 — Manual + assisted (Week 1-2)

What I do automatically (no Dan involvement):
- Pull DNA reports + comp tables + permit history for each script's subject property
- Capture all screen-share b-roll (heat map, dashboards, reports)
- Generate thumbnail concepts as 1280×720 PNGs
- Write SEO metadata (title, description, tags, hashtags) per script
- Draft Shorts captions/subtitles
- Pre-write top 5 likely comment reply templates

What Dan does:
- Record the 30-60s on-camera segments
- Approve scripts before assembly
- Final eyeball on assembled cuts

What needs manual platform work (no API):
- Account creation across YT/TikTok/IG/Threads (phone verification)
- First-week upload + tag
- Custom thumbnails on YT

## Phase 2 — Engagement automation (Week 3-4)

Build these once Phase 1 has 10+ videos live:

### YouTube Data API v3 — comment auto-reply
- OAuth scope: `youtube.force-ssl`
- Cron: every 15 min
- Logic: scan new comments on `PropertyDNA` channel videos. Match keywords:
  - "how" / "where" / "app" / "download" → reply with App Store link + "Free DNA report on any address: thepropertydna.com"
  - "scan [address]" → forward to a queue Dan reviews + reply with one-day SLA
  - "agent" + sentiment-negative → reply with "Your story is exactly why we built this. DM me if you want to share it." + DM follow-up
- Store: kpi_events with event_type='youtube_comment_replied'
- Built as: `netlify/functions/youtube-engagement.js` (new)

### Newsletter pulls top YouTube comment of the week
- Wed before send, query YouTube API for top-liked comments from prior 7 days
- Surface in send-cc-newsletter as social proof block
- Adds the "we hear you" loop to the weekly send

### Buffer / Hootsuite API for cross-posting
- Single source MP4 → Buffer schedules YT Shorts + IG Reels + TikTok + Threads
- Defer to Phase 2 only if manual cross-post becomes the bottleneck

## Phase 3 — Production automation (Month 2)

### Auto-script generation from weekly market scan
- Cron Monday morning: query Supabase for the 10 most-significant DNA score moves in the last week (mostly downward — those are the buyer-protection stories)
- Run each through Claude with the script template
- Output 5 candidate Shorts scripts in `tools/youtube/queue/`
- Dan picks 2-3 to record that week
- Built as: `netlify/functions/youtube-script-generator.js` (new)

### Voice clone for VO-only Shorts
- Use ElevenLabs API with Dan's voice sample (30 min of cleanly-recorded audio)
- Generate VO for 5-8 of every 10 Shorts, freeing Dan to only record the high-impact ones
- This is the unlock for 5/day cadence without burning Dan out

### Auto-thumbnail generation
- Stable Diffusion XL + LoRA trained on first 50 thumbnails
- 1280×720, brand consistent
- Built into `tools/youtube/gen-thumbnail.ts`

## Phase 4 — Cross-platform amplification (Month 3+)

- Substack auto-import of every long-form video as a written post
- Newsletter pulls top Short weekly as embed
- Site `/youtube` page surfaces playlists by topic
- Site blog auto-generates from long-form transcripts

## Decision gates

**Don't build Phase 2+ until Phase 1 shows:**
- 1,000+ subscribers (engagement automation only matters at scale)
- ≥5 videos with >1% click-through-rate to thepropertydna.com (signals creative is working)
- Dan's bandwidth for recording is the bottleneck, not script quality

**Don't build voice clone until Phase 1 hits:**
- 30+ videos shipped (need the training corpus + voice fingerprint)
- Audience knows Dan's voice (deviation will be obvious; need brand established first)

## Budget envelope (rough)

| Phase | Tools | $/mo |
|-------|-------|------|
| 1 — Manual | YouTube/TikTok/IG free | $0 |
| 2 — Engagement | YouTube API free + Resend (already paid) | $0 |
| 3 — Voice/scripts | ElevenLabs Creator $22 + Anthropic API (already paid) | $22-50 |
| 4 — Full automation | Above + Buffer Pro $15 | $40-80 |

Total ramp: $0 → $80/mo over 3 months. Single Realtor Pro signup ($149) covers it.
