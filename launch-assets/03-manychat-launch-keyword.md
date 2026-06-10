# ManyChat — Launch Day Keywords

## New Keyword Triggers

### Trigger: "APP", "IOS", "LAUNCH", "DOWNLOAD"

**Auto-reply:**

> The iOS app is live — free for every buyer, every feature unlocked.
>
> Download: https://apps.apple.com/app/id6768064079
>
> Reply VERIFIED if you want our verified luxury dossier list (Greenwich, Palm Springs, Miami).
>
> Reply REPORT if you want me to run a free DNA report on your address.

---

### Trigger: "FREE"

**Auto-reply:**

> Yes — the iOS app is 100% free. Every feature, every metric, every report. No subscription. No ads. No tracking.
>
> 1.67M parcels indexed in Coachella Valley, Riverside, San Diego, Miami-Dade, Broward, Greenwich, New Canaan, Westport, Darien, Westchester NY.
>
> Get it: https://apps.apple.com/app/id6768064079

---

### Trigger: "AGENT", "REALTOR"

**Auto-reply:**

> For real estate professionals: PropertyDNA Realtor Pro is $149/mo on the web — unlimited client-ready reports, comparable trend charts, listing intelligence, valuation deltas, buyer/seller talking points.
>
> Investor tier ($299/mo) adds bulk CSV lookup, API access, multi-market heat maps, and off-market signal alerts.
>
> Start: https://thepropertydna.com/pricing
>
> The iOS consumer app stays free — the pros pay for power tools, that funds the buyer mission.

---

## Implementation

Use the manychat-orchestrator agent to provision these via the ManyChat Public API. If keyword trigger API is unavailable for free-tier flows, paste the bodies above into the ManyChat UI under Automation → Keywords.

## DM Broadcast (one-time)

Audience: all opted-in subscribers
Send window: Launch Day +24h

**Body:**

> The iOS app is live. The data your agent does not want you to see — free in your pocket.
>
> Download: https://apps.apple.com/app/id6768064079
>
> Reply DEFEND if you want the launch press release sent to your inbox.

---

## Reply "DEFEND" follow-up

Body:

> Press release attached. Share with one buyer who needs this. We exist to end information asymmetry — and we cannot do it alone.
>
> Press release: https://thepropertydna.com/press/ios-launch
> Launch story: https://thepropertydna.com/launch
