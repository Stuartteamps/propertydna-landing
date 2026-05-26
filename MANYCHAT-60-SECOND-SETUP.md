# ManyChat 60-Second Setup (Phone OK)

The webhook is **live and tested**. Comments on today's carousel posts already drive Instagram engagement (algo loves comment volume). To complete the loop and have ManyChat auto-DM users who comment the trigger words, you need ONE setting in ManyChat.

**Open this URL on your phone:** https://app.manychat.com/

---

## The 60-second setup

1. **Automation → New Automation** (or Default Reply)
2. **Trigger:** *"User sends a message"* → match: **Any** (or specifically: containing any of `DOSSIER, SINATRA, FREY, BOND, HOPE, LIBERACE, SMOKE, INDEX, LAUTNER, FREY47, VERIFIED, STORY, DUE`)
3. **Action:** **External Request** (NOT a normal message)
4. **Configure:**
   - Method: `POST`
   - URL: `https://thepropertydna.com/.netlify/functions/manychat-webhook`
   - Headers:
     ```
     Content-Type: application/json
     x-manychat-token: f0eb57c3a9b6d4bc1770426a5823f8d97e1a23ac0a65a39e
     ```
   - Body (JSON):
     ```json
     {
       "message_text": "{{last_input_text}}",
       "subscriber_id": "{{user_id}}",
       "platform": "ig",
       "ig_handle": "{{ig_username}}"
     }
     ```
   - **Enable "Use response as message"** (so ManyChat renders our 2 DMs back to the user)
5. **Save + Publish**

That's it. Test it by DMing your own Instagram with the word "DOSSIER" — you should get two messages back with the dossier index link.

---

## What happens after setup

User comments **"DOSSIER"** on a carousel post → ManyChat auto-DMs them →
ManyChat fires External Request to our webhook → Webhook detects "DOSSIER" in the message text →
Returns 2 messages + tags the user with `lead_dossier` + `lead_carousel_comment` →
ManyChat renders both DMs to the user back-to-back →
Lead lands in `ops_activity_log` (visible at /admin/ops) →
Lead shows up in tomorrow's 6 PM digest email.

---

## All 13 keywords are already configured in the webhook code

You DON'T need to set up 13 separate automations. Just the ONE external-request rule above. The webhook detects which keyword the user typed and sends the right response automatically.

---

## If you have time for the polish version

Add a "Comment Growth Tool" in ManyChat that fires on **post comments** specifically (not just DMs):
- Trigger: Instagram → "User comments on a specific post"
- Match: any text containing any of the 13 keywords above
- Action: same External Request to the webhook

This converts public post comments (not DMs) into auto-DMs. Today's carousel CTAs ("Comment DOSSIER for the file") will then fire end-to-end.

---

**TL;DR for tomorrow:** Check the 6 PM digest. If you see `manychat keyword_trigger` events in there, it's working.
