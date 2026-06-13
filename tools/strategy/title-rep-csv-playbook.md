# Title-Rep CSV Playbook — How to Use Your Title Rep's Agent Production Data

Dan asked: "I can get lists of all the agents in SoCal from my title rep if that helps and gives me the production numbers. How can we utilize that?"

## Why this is a massive unlock

Title companies maintain agent-production databases as a customer-retention tool — they want every agent to know they're tracking + supporting them. Your rep can pull:
- Every agent in a given county / metro
- 12-month production volume (dollars closed)
- 12-month transaction count
- License #, brokerage, contact info
- Often market-area tags

**This data is normally $400-$2,500/month from commercial sources** (Real Trends, BrokerMetrics, Top Producer). Your title rep gives it to you free as a relationship benefit.

## What to ask your title rep for

Ask for THIS exact pull (most title reps have a one-click export for this):

> "Can you send me a CSV of every CA agent who closed at least 5 transactions in 2025, sorted by total production volume? Include name, email if you have it, phone, brokerage, city, license #, units, and volume. The wider geography the better — SoCal county-level is ideal, statewide is even better."

Most reps will deliver this in 24-72 hours. If they push back on email field, that's normal — title companies are cautious about email lists for legal reasons. You can get email enriched separately via Apollo for $30/mo.

## Once you have the CSV — the import flow

The import endpoint I just built (`netlify/functions/import-title-rep-csv.js`) accepts your CSV via POST + does the following automatically:

1. **Parses the CSV** — flexible column matching (handles "Agent Name", "Name", "Full Name", "Agent" all the same way)
2. **Calculates production tier** for each agent:
   - **Diamond** ≥ $100M volume or ≥ 100 units (rare — top 0.1% of all CA agents)
   - **Platinum** ≥ $50M or ≥ 50 units
   - **Gold** ≥ $25M or ≥ 25 units
   - **Silver** ≥ $10M or ≥ 10 units
   - **Bronze** ≥ $3M or ≥ 5 units
   - **Prospect** — below bronze
3. **Flags out-of-area agents** — agents NOT in Coachella Valley local zips/cities. **These are the highest-value referral prospects** — they have CV listings they can't service well.
4. **Upserts into `agent_referral_network`** keyed by license # or email
5. **Returns a summary** — count by tier, count out-of-area, errors

How to run it (after Dan has the CSV from his rep):

```bash
INTERNAL_KEY=$(netlify env:get INTERNAL_API_KEY)
CSV_CONTENT=$(cat /path/to/title-rep-export.csv)

curl -X POST "https://thepropertydna.com/.netlify/functions/import-title-rep-csv" \
  -H "Content-Type: application/json" \
  -H "x-internal-key: $INTERNAL_KEY" \
  -d "$(jq -n --arg csv "$CSV_CONTENT" --argjson year 2025 --arg source "First American Title 2025 production" \
    '{csv_data: $csv, year: $year, source: $source}')"
```

Or — I can build a simple admin upload UI at `/admin/agent-import` if you'd rather just drag-and-drop the CSV. ~15 min to wire up. Say the word.

## Using the imported data — the strategy

Once your title rep CSV is in `agent_referral_network`, here's the prioritized outreach matrix:

### Tier 1 priority — Out-of-area Gold/Platinum/Diamond
Agents in LA/SD/SF/AZ who closed $25M+ last year AND have Coachella Valley listings (we cross-reference against `stale_listing_tracker`). These are agents who need YOU because they don't have boots on the ground here. **Highest conversion rate. Highest referral fees.**

Outreach: personal email from your Gmail, referencing their specific stale listing + offering 25% referral. 1-by-1, not blast.

### Tier 2 — In-area Bronze/Silver with stale listings
Local agents whose listings are aging. They might be open to co-listing or selling-side help. **Medium conversion, medium fees, but builds your reputation locally.**

Outreach: peer-to-peer DM via LinkedIn, NOT email. Different tone than out-of-area.

### Tier 3 — Out-of-area Bronze/Silver
Agents who are still active enough that they get listings here but small enough they'll be hungry for help. **Long-tail.**

Outreach: automated drip via Apollo workflow once enriched with email. (I can wire this.)

### Tier 4 — In-area Diamond/Platinum
The top 5 agents in your home market. **Do NOT pitch them.** They're competitors. Instead, watch their listings for cross-referral opportunities (their buyers + your listings, etc.).

Watch silently. Pitch only if they reach out first.

## What the data unlocks beyond outreach

1. **Production benchmarks for our own performance.** Once you have the tier distribution for SoCal, you know exactly where your numbers stand. Useful for press pitches + partnership conversations.

2. **Industry research content.** "Top 100 SoCal real estate agents by 2025 production" is its own content piece. We can write the analysis, anonymize names, publish as a `/blog` SEO post that ranks for "best real estate agents Coachella Valley" type queries.

3. **Targeted advertising.** Once we know which brokerages employ the most Diamond/Platinum agents in a market, we can run hyper-targeted LinkedIn ads to "Real Estate Agents at Compass" with $300-500 monthly budgets.

4. **Partnership leverage.** When you talk to a brokerage like Sotheby's or Compass about a partnership, knowing their agent production distribution (vs the market average) is the kind of data that changes the conversation.

## Privacy + legal note

Title company production data is sourced from public MLS records + the title company's own closing files. Sharing it with you for relationship purposes is standard industry practice. BUT:
- Don't share the raw CSV publicly
- Don't email agents using contact info you can't independently confirm is correct (use the title rep's email to validate, or enrich via Apollo)
- Don't disparage specific agents based on production data
- DO use the data internally to prioritize outreach + tier prospects

This is exactly how every major real estate franchise (Re/Max, Berkshire Hathaway, Compass) recruits top agents. We just have the data leverage to do it on our timeline + budget.

## What to do next

1. **Email your title rep today** asking for the export
2. **Once you have the CSV**, run the import (or hand it to me; I'll process it tonight)
3. **Within 24h of import**, I generate the prioritized outreach matrix
4. **You approve which Tier 1 agents to pitch first** (5-10 a week is the sustainable cadence)
5. **I draft the personalized notes**, you send from your Gmail

That's the pipeline. 30-90 days of consistent execution = 5-15 closed referrals = $100K-300K in your pocket.

Save the humans. And the sell-side humans too.
