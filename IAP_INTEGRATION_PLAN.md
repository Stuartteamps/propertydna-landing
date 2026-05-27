# Build 15 — StoreKit IAP Integration Plan

This document is the playbook for adding In-App Purchase to PropertyDNA iOS. **Not integrated in Build 14.** Hold for after Build 14 passes review (or for an emergency Build 15 if 14 fails again with 3.1.1).

## Why this is the right answer

Apple's 3.1.1 has two related clauses we've been fighting:
1. **No external payment in-app** — Build 12-14 closed this by stripping all payment UI from iOS.
2. **No access to externally-purchased content without IAP** — Build 13 first violation, Build 14 closes via the runtime check-usage interception.

The above two are *workarounds*. The actual answer Apple wants is: **offer the same subscriptions via In-App Purchase**, and then web-purchased users can access their content on iOS (because IAP is also available as a path).

Real monetization on iOS = StoreKit2.

## What's already written (this session)

- **`app/frontend/ios/App/App/StoreKitManager.swift`** — StoreKit2 wrapper. Product fetch, purchase flow, transaction listener, restore purchases, entitlement sync to backend. Not added to pbxproj yet.
- **`netlify/functions/verify-apple-receipt.js`** — backend that receives transaction JSON from iOS, parses it, writes entitlement to Supabase.
- **`supabase/migrations/030_apple_iap_entitlements.sql`** — schema additions for `provider`, `apple_original_transaction_id`, `apple_product_id`.

## Steps to ship Build 15

### 1. ASC product setup (Dan does manually — no API for product creation)

Go to https://appstoreconnect.apple.com/apps/6768064079/distribution/ios/subscriptions and create:

- **Subscription Group**: "PropertyDNA Pro"
  - **Product** `com.thepropertydna.app.pro.monthly` — $49.99/mo
  - **Product** `com.thepropertydna.app.pro.yearly` — $479.99/yr (~20% discount vs monthly)
- Localization for both: US English, with the same feature copy that's on the web pricing page.
- Privacy policy URL: https://thepropertydna.com/privacy
- Submit IAP products for review (separate flow from app review; can be reviewed in parallel).

### 2. Generate the App Store Server API key

Different from the App Store Connect API key we already have (QWGUF3DZ4F is for app submission).

Go to https://appstoreconnect.apple.com/access/api/subs → "App Store Server API" tab → create new key with role "App Manager" or similar.

- Note the Key ID, Issuer ID, and download the `.p8` private key.
- Store in Netlify environment variables:
  - `APPLE_BUNDLE_ID=com.thepropertydna.app`
  - `APPLE_ISSUER_ID=<the issuer ID>`
  - `APPLE_KEY_ID=<the new key ID>`
  - `APPLE_PRIVATE_KEY=<paste contents of .p8>`

### 3. Apply Supabase migration

```bash
cd /Users/danstuart/propertydna-landing
supabase db push
# Or manually:
psql "$DATABASE_URL" < supabase/migrations/030_apple_iap_entitlements.sql
```

### 4. Register the Swift file

```bash
GEM_HOME=/opt/homebrew/Cellar/cocoapods/1.16.2_2/libexec /opt/homebrew/opt/ruby/bin/ruby <<'RUBY'
require 'xcodeproj'
project = Xcodeproj::Project.open('/Users/danstuart/propertydna-landing/app/frontend/ios/App/App.xcodeproj')
target  = project.targets.find { |t| t.name == 'App' }
app_group = project.main_group.find_subpath('App', false)
ref = app_group.new_reference('StoreKitManager.swift')
ref.last_known_file_type = 'sourcecode.swift'
target.add_file_references([ref])
project.save
RUBY
```

### 5. Wire StoreKitManager into the bridge

Edit `PropertyDNABridgeViewController.swift`:

```swift
override func capacitorDidLoad() {
    super.capacitorDidLoad()
    // ... existing handlers ...

    if #available(iOS 16.0, *) {
        StoreKitManager.shared.startObserving()
    }

    // Add JS bridge for the web layer to invoke purchases
    controller.add(PurchaseBridge.shared, name: "pdnaPurchase")
    controller.add(PurchaseBridge.shared, name: "pdnaRestorePurchases")
}
```

(PurchaseBridge.swift is a small Capacitor-style coordinator that turns JS `postMessage` calls into Swift StoreKit calls. ~50 lines.)

### 6. Surface a paywall

Replace the current "no payment surfaces" approach with a SwiftUI paywall presented from the Account tab. The "Upgrade to Pro" button calls `pdnaPurchase.postMessage({ productId: 'com.thepropertydna.app.pro.monthly' })` which invokes StoreKitManager.

The paywall MUST include:
- Product titles + prices (from StoreKit, not hardcoded)
- Subscribe buttons
- **Restore Purchases** button (Apple requires this)
- Terms of Service link (https://thepropertydna.com/terms)
- Privacy Policy link (https://thepropertydna.com/privacy)
- Auto-renewal disclosure copy (Apple-required boilerplate)

### 7. Update `check-usage` to honor Apple entitlements

In `netlify/functions/check-usage.js`, add to the `isSubscribed` calculation:

```javascript
const { data: appleSub } = await supabase
  .from('subscriptions')
  .select('plan, expires_at, status')
  .eq('user_email', email)
  .eq('provider', 'apple')
  .eq('status', 'active')
  .gte('expires_at', new Date().toISOString())
  .maybeSingle();

const isSubscribed = !!stripeSub || !!appleSub;
const plan = stripeSub?.plan || appleSub?.plan || null;
```

### 8. Remove the iOS check-usage rewrite in main.tsx

Once IAP works end-to-end, the Build 14 workaround that forces `isSubscribed=false` on iOS becomes wrong — paid iOS users SHOULD see their Pro features. Remove the rewrite block.

### 9. Re-add tier UI on iOS

The Nav tier badge, Dashboard subscription bar, ReportView tier banner — all re-enabled now that we have IAP. The whole iOS payment story is legitimate.

### 10. App Store Server Notifications v2 webhook

Optional but recommended for handling renewals/cancellations/refunds without waiting for the user to open the app. Create `netlify/functions/apple-notifications.js` and register the URL in ASC:
- App Store Connect → Apps → PropertyDNA → App Information → App Store Server Notifications → URL = `https://thepropertydna.com/.netlify/functions/apple-notifications`

## Commission

Apple takes 30% on first year; 15% in year 2+ for the same subscriber. Effective:
- $49.99/mo → $34.99 net year 1; $42.49 net year 2+.
- $479.99/yr → $335.99 net year 1; $407.99 net year 2+.

Cross-platform note: Apple allows web-purchased subscribers to access content on iOS *as long as* IAP is also available as a purchase path. So existing Stripe subs continue to work on iOS via the existing `check-usage` flow — no double charging.

## Estimated time

- ASC product setup: 30-45 min (manual, Dan)
- Swift integration: 1-2 hours
- Backend: 1-2 hours
- Testing in TestFlight: 1-2 hours
- Total: ~6-8 hours focused work, plus Apple's IAP product review (24-72 hours).
