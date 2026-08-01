-- Remove David Whitefield from all future marketing
-- Run this in the Supabase SQL editor.
-- Step 1 — Find the email (verify before running steps 2-4)
SELECT DISTINCT
  email,
  first_name,
  last_name,
  created_at
FROM campaign_contacts
WHERE LOWER(first_name) = 'david'
  AND LOWER(last_name)  = 'whitefield'
ORDER BY created_at DESC;

-- Step 2 — Permanent global unsubscribe (CAN-SPAM)
-- Replace 'EMAIL_HERE' with the email found above.
INSERT INTO campaign_unsubscribes (email, created_at)
VALUES ('EMAIL_HERE', NOW())
ON CONFLICT (email) DO NOTHING;

-- Step 3 — Suppress engagement emails
INSERT INTO notification_preferences (email, agent, channel, enabled, updated_at)
VALUES ('EMAIL_HERE', 'all', 'all', false, NOW())
ON CONFLICT (email, agent, channel)
DO UPDATE SET enabled = false, updated_at = NOW();

-- Step 4 — Mark all campaign_contacts rows as unsubscribed
UPDATE campaign_contacts
SET status = 'unsubscribed'
WHERE LOWER(email) = LOWER('EMAIL_HERE')
  AND status NOT IN ('unsubscribed', 'bounced');

-- Step 5 — Add to marketing_consent toggle table (for the record)
INSERT INTO marketing_consent (email, opted_in, reason, updated_at, opted_out_at)
VALUES ('EMAIL_HERE', false, 'admin_removal', NOW(), NOW())
ON CONFLICT (email)
DO UPDATE SET opted_in = false, reason = 'admin_removal', updated_at = NOW(), opted_out_at = NOW();
