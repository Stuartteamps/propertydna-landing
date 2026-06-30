#!/usr/bin/env python3
"""
enrich-matched.py — turn the 1,840 matched CC contacts into a ranked luxury-
prospect list by joining each matched APN to its property_master record
(assessed value, beds, sqft, year, type). Free, no RentCast quota.

Output: cc-matched-homes-enriched.csv, sorted by assessed value desc — so the
highest-value homeowners (Dan's luxury prospects) are at the top.
"""
import json, csv, os, urllib.request, urllib.parse, collections

ANON = "sb_publishable_KTTgVO3mROxubE_A9OQ7Kg_aRrnzPVT"
BASE = "https://neccpdfhmfnvyjgyrysy.supabase.co/rest/v1/property_master"
HERE = os.path.dirname(__file__)

def fetch_props(apns):
    """Batch-fetch property_master rows by APN -> {apn: row}."""
    out = {}
    for i in range(0, len(apns), 80):
        chunk = apns[i:i+80]
        inlist = ",".join(f'"{a}"' for a in chunk)
        qs = urllib.parse.urlencode({
            "select": "apn,address,city,state,beds,sqft,lot_sqft,year_built,tax_assessed_value,rentcast_value,property_type",
            "apn": f"in.({inlist})",
        })
        req = urllib.request.Request(f"{BASE}?{qs}", headers={"apikey": ANON, "Authorization": f"Bearer {ANON}"})
        try:
            for r in json.load(urllib.request.urlopen(req, timeout=40)):
                out[r["apn"]] = r
        except Exception as e:
            print(f"  fetch error chunk {i}: {e}")
    return out

def main():
    d = json.load(open(os.path.join(HERE, "cc-contacts-scrubbed.json")))
    matched = [c for c in d["contacts"] if c.get("matched_apn")]
    apns = list({c["matched_apn"] for c in matched})
    print(f"Enriching {len(matched)} matched contacts ({len(apns)} unique homes)...")
    props = fetch_props(apns)
    print(f"  fetched {len(props)} property records")

    rows = []
    for c in matched:
        p = props.get(c["matched_apn"], {})
        val = p.get("tax_assessed_value") or p.get("rentcast_value") or 0
        rows.append({
            "email": c.get("email"), "first_name": c.get("first_name"), "last_name": c.get("last_name"),
            "phone": c.get("phone"), "address": c.get("street"), "city": c.get("city"), "state": c.get("state"),
            "apn": c["matched_apn"],
            "assessed_value": int(val) if val else "",
            "beds": p.get("beds") or "", "sqft": p.get("sqft") or "",
            "year_built": p.get("year_built") or "", "property_type": p.get("property_type") or "",
        })
    # sort by value desc (luxury prospects first)
    rows.sort(key=lambda r: (r["assessed_value"] if isinstance(r["assessed_value"], int) else 0), reverse=True)

    out = os.path.join(HERE, "cc-matched-homes-enriched.csv")
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)

    vals = [r["assessed_value"] for r in rows if isinstance(r["assessed_value"], int) and r["assessed_value"] > 0]
    band = collections.Counter()
    for v in vals:
        band["$5M+" if v>=5e6 else "$2-5M" if v>=2e6 else "$1-2M" if v>=1e6 else "$500k-1M" if v>=5e5 else "<$500k"] += 1
    print(f"\n=== ENRICHED LUXURY-PROSPECT LIST ===")
    print(f"  contacts enriched: {len(rows)} | with a value: {len(vals)}")
    print(f"  assessed-value bands (NOTE: assessed < market, esp. CA Prop-13):")
    for b in ["$5M+","$2-5M","$1-2M","$500k-1M","<$500k"]:
        if band[b]: print(f"    {b}: {band[b]}")
    print(f"  top 5 prospects by assessed value:")
    for r in rows[:5]:
        print(f"    ${r['assessed_value']:>10,}  {r['first_name'] or ''} {r['last_name'] or ''}  {r['address']}, {r['city']}  ({r['email']})")
    print(f"  wrote -> cc-matched-homes-enriched.csv")

if __name__ == "__main__":
    main()
