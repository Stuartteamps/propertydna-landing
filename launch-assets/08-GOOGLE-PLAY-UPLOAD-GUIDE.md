# GOOGLE PLAY STORE — Morning Upload Punch List

**TL;DR:** The Android app is BUILT, SIGNED, and READY. You just need to log into Play Console and upload the AAB. Total time: 15-25 minutes. Review timeline: 3-7 days, like Apple.

---

## What's on your Desktop right now

```
/Users/danstuart/Desktop/PROPERTYDNA-ANDROID-v1.0.0-2026-06-11.aab
```

That's a 50MB signed Android App Bundle. Drop it into Play Console.

**Keystore (don't lose this — required for every future update):**
- File: `/Users/danstuart/.android-keystores/propertydna-release.jks`
- Password: in `/Users/danstuart/.android-keystores/propertydna-keystore-password.txt`
- Key alias: `propertydna`

If you lose this keystore, **you cannot update the app ever again** — you'd have to publish under a new package name. Back it up to 1Password or an encrypted drive immediately.

---

## Step-by-step upload (Play Console)

1. Open <https://play.google.com/console>
2. **All apps → Create app**
3. App name: **PropertyDNA**
4. Default language: **English (United States)**
5. App or game: **App**
6. Free or paid: **Free**
7. Accept declarations → **Create app**

### App content (left sidebar — all required before going live)

8. **Privacy policy:** `https://thepropertydna.com/privacy`
9. **App access:** "All functionality is available without special access" (anonymous app, no login required)
10. **Ads:** "No, my app does not contain ads"
11. **Content rating:** Start questionnaire → Reference/News/Business → No violence/gambling/etc. → Submit
12. **Target audience:** Ages 18 and over (real estate context)
13. **Data safety:** Use the answers in section **Data Safety Form** below

### Store listing (left sidebar → Main store listing)

14. **App name:** PropertyDNA
15. **Short description (80 char max):**
```
Free property intelligence — valuation, flood risk, permit history, comps.
```
16. **Full description:** Paste the **FULL DESCRIPTION** block below
17. **App icon:** Upload `/Users/danstuart/propertydna-landing/app/frontend/public/icon-512.png` (512×512)
18. **Feature graphic (1024×500):** Upload `/Users/danstuart/propertydna-landing/app/frontend/public/og-image.png` (Play will accept this and resize)
19. **Phone screenshots (need 2-8 minimum):** Reuse your iOS screenshots from the Mac — they're already in App Store Connect. Just resize to 1080×1920 or similar (Play accepts any 16:9 ratio).
20. Category: **Finance** (primary), **House & Home** (secondary)
21. Email: `hello@thepropertydna.com`
22. Website: `https://thepropertydna.com`

### Release (left sidebar → Production → Create new release)

23. **Upload the AAB:** Drag `/Users/danstuart/Desktop/PROPERTYDNA-ANDROID-v1.0.0-2026-06-11.aab` into the upload zone
24. **Release name:** Auto-fills to `1.0.0 (2)`
25. **Release notes — English:** Paste the **RELEASE NOTES** block below
26. **Review release → Start rollout to production**

Google review takes 3-7 days first time. After approval, app is LIVE in Play Store.

### Faster path — Internal Testing (live within ~1 hour, 100 testers max)

If you want yourself + your friend to install via Play Store immediately, do this BEFORE production:

a. Left sidebar → **Testing → Internal testing → Create new release**
b. Upload the same AAB
c. Add tester emails: yourself, your friend, anyone else you want immediate access
d. Save + roll out — testers get an opt-in link, can install via Play Store from there in under an hour

---

## FULL DESCRIPTION (paste into Play Console)

```
PropertyDNA gives every American homebuyer the institutional-grade property intelligence that, until now, only real estate professionals could afford. Free on Android. Forever.

WHAT YOU GET — on every U.S. property in our 3.58M-parcel index:

• Live valuation with confidence labels (High / Medium / Low)
• Comparable sales velocity and 90-day market trajectory
• FEMA flood zone designation + Special Flood Hazard Area status
• CalFire wildfire severity zone (where applicable)
• USGS seismic hazard exposure
• Hurricane-code retrofit status (Florida + Gulf Coast)
• County Assessor permit history
• School ratings, demographics, rental demand
• Five-year value trajectory with risk-adjusted projection
• A direct "Would We Buy It?" verdict

WHY FREE?

Because the people who get hurt by real estate information asymmetry — first-time buyers, retirees, military families, anyone shopping outside their network — can't afford institutional data. The agents and the funds pay for our power tools on the web. That subsidizes the consumer mission. We refuse to monetize the people we're trying to protect.

NO TRACKING. NO ADS. NO SUBSCRIPTION.

Every feature, every report, every metric — unlocked at no charge. No in-app purchases. No subscriptions. No advertising. No tracking. Reports live on your device.

EVERY METRIC IS TRACEABLE.

Not a Zestimate. Not a black-box AVM. Every score in PropertyDNA is mathematically derivable from a named public source: RentCast MLS, US Census ACS, FEMA NFHL, CalFire FHSZ, USGS seismic models, county Assessor CREST APIs, and the National Weather Service. We name our sources because we expect buyers to verify them.

INDEXED COVERAGE AT LAUNCH:

• California — Coachella Valley (Palm Springs, Palm Desert, La Quinta, Indio, Rancho Mirage, Cathedral City, Desert Hot Springs, Indian Wells, Coachella) + Riverside, San Diego, LA, Bay Area
• Florida — Miami-Dade, Broward, Palm Beach, Hillsborough, Collier
• Connecticut — Greenwich, New Canaan, Westport, Darien
• New York — Manhattan + Westchester County
• Arizona — Maricopa County (Scottsdale, Phoenix, Paradise Valley)
• Nevada — Clark County
• Washington — Snohomish County
• Texas — Austin, Dallas, Houston

More markets shipping monthly.

THE MISSION.

For sixty years residential real estate has been defined by a single structural imbalance: the agent on the other side of the transaction has the data, the buyer does not. PropertyDNA was built to end that. Free. On Android. Today.

thepropertydna.com
```

---

## RELEASE NOTES (paste into Play Console "What's new")

```
PropertyDNA on Android — 1.0.0 launch.

• 3.58M U.S. parcels indexed
• Free valuation, risk, permits, and comparable trajectory on every property
• FEMA flood, CalFire wildfire, USGS seismic exposure
• Five-year forecast + "Would We Buy It?" verdict
• No subscriptions. No tracking. No ads.

Defend the buyer. Save the human.
```

---

## DATA SAFETY FORM (answers Play Console needs)

- **Does your app collect or share any of the required user data types?** → No (we collect email if user opts in for reports, but that's user-initiated)
  - Actually answer: **Yes**, then:
- **Personal info → Email address:** Collected, NOT shared, optional, used for app functionality (delivering reports)
- **App activity → In-app actions:** Collected for analytics, anonymous
- **Encryption in transit:** Yes
- **Users can request data deletion:** Yes → email hello@thepropertydna.com

---

## CONTENT RATING ANSWERS

- Violence: No
- Sexual content: No
- Profanity: No
- Drugs/Alcohol: No
- Gambling: No
- User-generated content: No
- Health/Wellness: No

Result: **Everyone** rating, suitable for all ages.

---

## TIMELINE EXPECTATION

| Step | Timeframe |
|---|---|
| You finish Play Console upload | ~25 min from start |
| Internal Testing track live | ~1 hour (testers can install) |
| Production review | 3-7 days (Google human review) |
| App live on Play Store globally | Day 4-8 after upload |

This is roughly the same timeline as Apple's review — there is no autonomous shortcut for either side.

---

## CRITICAL: SAVE THE KEYSTORE

```bash
# Backup command — run this NOW
cp /Users/danstuart/.android-keystores/propertydna-release.jks ~/Documents/PROPERTYDNA-keystore-BACKUP.jks
cp /Users/danstuart/.android-keystores/propertydna-keystore-password.txt ~/Documents/PROPERTYDNA-keystore-password-BACKUP.txt
```

Then add both to 1Password. If you lose these, you cannot update PropertyDNA on Android ever again — you'd have to publish a new app with a different package name. This is the biggest single-point-of-failure in the Android pipeline.

---

## PWA — ALREADY LIVE

Your friend doesn't need to wait. Tell him:

1. Open Chrome on Android
2. Go to **thepropertydna.com**
3. Tap the **three-dot menu** → **Install app** (or **Add to Home Screen**)
4. PropertyDNA installs as a standalone app icon. Looks and feels exactly like a Play Store app.

This is live RIGHT NOW. No Play Store review required.
