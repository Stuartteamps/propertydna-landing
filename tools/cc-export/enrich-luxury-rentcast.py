#!/usr/bin/env python3
"""
enrich-luxury-rentcast.py — add live RentCast market value + rent estimate to
the 157 UHNW prospects ($2M+). Assessed value (county) understates market,
especially CA Prop-13; this gets the real number for Dan's top relationships.

Reads  cc-segment-luxury-2M-plus.csv
Writes cc-luxury-prospects-FINAL.csv  (sorted by market value desc)
"""
import csv, os, json, time, urllib.request, urllib.parse

KEY = os.environ.get("RENTCAST_API_KEY", "6f422758923c4c3392272eb71c035db6")
HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "cc-segment-luxury-2M-plus.csv")

def rentcast_avm(address):
    qs = urllib.parse.urlencode({"address": address})
    req = urllib.request.Request(f"https://api.rentcast.io/v1/avm/value?{qs}",
        headers={"X-Api-Key": KEY, "Accept": "application/json"})
    try:
        d = json.load(urllib.request.urlopen(req, timeout=20))
        return d.get("price"), (d.get("priceRangeLow"), d.get("priceRangeHigh"))
    except Exception:
        return None, (None, None)

def main():
    rows = list(csv.DictReader(open(SRC)))
    print(f"Enriching {len(rows)} UHNW prospects with live RentCast market values...")
    out = []
    hit = 0
    for i, r in enumerate(rows):
        addr = ", ".join(x for x in [r.get("address"), r.get("city"), r.get("state")] if x)
        mv, (lo, hi) = rentcast_avm(addr)
        if mv: hit += 1
        try: assessed = int(r.get("assessed_value") or 0)
        except: assessed = 0
        out.append({
            "first_name": r.get("first_name"), "last_name": r.get("last_name"),
            "email": r.get("email"), "phone": r.get("phone"),
            "address": r.get("address"), "city": r.get("city"), "state": r.get("state"),
            "assessed_value": assessed or "",
            "market_value": int(mv) if mv else "",
            "market_low": int(lo) if lo else "", "market_high": int(hi) if hi else "",
            "beds": r.get("beds"), "sqft": r.get("sqft"), "year_built": r.get("year_built"),
            "apn": r.get("apn"),
        })
        if (i+1) % 25 == 0: print(f"  {i+1}/{len(rows)} ({hit} market values so far)")
        time.sleep(0.25)

    out.sort(key=lambda r: (r["market_value"] if isinstance(r["market_value"], int) else
                            (r["assessed_value"] if isinstance(r["assessed_value"], int) else 0)), reverse=True)
    dst = os.path.join(HERE, "cc-luxury-prospects-FINAL.csv")
    with open(dst, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)

    mvs = [r["market_value"] for r in out if isinstance(r["market_value"], int)]
    print(f"\n=== UHNW PROSPECTS — MARKET-VALUE ENRICHED ===")
    print(f"  prospects: {len(out)} | live market values: {hit}/{len(out)}")
    print(f"  top 10 by market value:")
    for r in out[:10]:
        mv = f"${r['market_value']:,}" if isinstance(r['market_value'],int) else "(assessed) ${:,}".format(r['assessed_value'] if isinstance(r['assessed_value'],int) else 0)
        nm = f"{r['first_name'] or ''} {r['last_name'] or ''}".strip()
        print(f"    {mv:>14}  {nm[:26]:26s}  {r['address']}, {r['city']}")
    print(f"  wrote -> cc-luxury-prospects-FINAL.csv")

if __name__ == "__main__":
    main()
