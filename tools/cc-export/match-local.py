#!/usr/bin/env python3
"""
match-local.py — tight normalized-address scrub of the CC export against our
indexed homes (property_master), run locally (no 26s function limit).

CC stores "466 N Farrell Drive"; property_master stores "466 N FARRELL DR PALM
SPRINGS CA". Exact match fails. This normalizes both sides to (house# + street
name tokens) within the same city, which actually matches.

Reads tools/cc-export/cc-contacts-scrubbed.json, writes back the matches +
a matched CSV.
"""
import json, re, urllib.request, urllib.parse, collections, os, sys

ANON = "sb_publishable_KTTgVO3mROxubE_A9OQ7Kg_aRrnzPVT"
BASE = "https://neccpdfhmfnvyjgyrysy.supabase.co/rest/v1/property_master"
HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "cc-contacts-scrubbed.json")

STREET_TYPES = {"DR","DRIVE","AVE","AVENUE","ST","STREET","RD","ROAD","LN","LANE",
 "CT","COURT","PL","PLACE","BLVD","BOULEVARD","CIR","CIRCLE","WAY","TER","TERRACE",
 "TRL","TRAIL","PT","POINT","CYN","CANYON","LOOP","RUN","PATH","COVE","BEND","RDG",
 "RIDGE","REAL","PASEO","VIA","CALLE","PASO","PKWY","PARKWAY","HWY","ROW","WALK"}
DIRECTIONALS = {"N","S","E","W","NE","NW","SE","SW","NORTH","SOUTH","EAST","WEST"}
STATES = {"CA","CT","FL","NC","AZ","WA","TX","NY","NJ","VA","SC","GA","CO","UT","WY",
 "CALIFORNIA","CONNECTICUT","FLORIDA"}

def norm_key(addr, city):
    """-> 'housenum|streetwords' or None."""
    if not addr: return None
    a = addr.upper()
    # strip trailing city + state tail (property_master appends 'CITY STATE')
    if city:
        a = re.sub(r"[ ,]+" + re.escape(city.upper()) + r"\b.*$", "", a)
    a = re.sub(r"\b(" + "|".join(STATES) + r")\b\s*$", "", a)
    a = re.sub(r"[^A-Z0-9 ]", " ", a)
    toks = a.split()
    if not toks: return None
    num = toks[0] if toks[0].isdigit() else None
    if num is None: return None
    rest = [t for t in toks[1:] if t not in STREET_TYPES and t not in DIRECTIONALS]
    if not rest: return None
    return num + "|" + " ".join(rest)

def fetch_city(city, max_rows=120000):
    """Keyset-paginate property_master rows for a city; return {norm_key: row}.
    Keyset (apn > last) instead of offset avoids the deep-offset statement
    timeouts that 500'd the previous run. Retries transient errors."""
    out = {}
    last_apn = ""
    pulled = 0
    while pulled < max_rows:
        qs = urllib.parse.urlencode({
            "select": "apn,address,city,state,zip,rentcast_value",
            "city": f"ilike.{city}",
            "apn": f"gt.{last_apn}",
            "order": "apn.asc",
            "limit": 1000,
        })
        url = f"{BASE}?{qs}"
        rows = None
        for attempt in range(4):
            req = urllib.request.Request(url, headers={"apikey": ANON, "Authorization": f"Bearer {ANON}"})
            try:
                rows = json.load(urllib.request.urlopen(req, timeout=40))
                break
            except Exception as e:
                if attempt == 3:
                    print(f"    [{city}] gave up after retries near apn={last_apn[:14]}: {e}")
                    rows = []
        if not rows:
            break
        for r in rows:
            k = norm_key(r.get("address"), r.get("city"))
            if k and k not in out:
                out[k] = r
        last_apn = rows[-1]["apn"]
        pulled += len(rows)
        if len(rows) < 1000:
            break
    return out

def main():
    d = json.load(open(SRC))
    contacts = d["contacts"]
    wa = [c for c in contacts if c.get("street")]
    # unique cities in the CC with-address set
    cities = sorted({(c.get("city") or "").strip() for c in wa if c.get("city")})
    print(f"Loaded {len(wa)} with-address contacts across {len(cities)} cities. Building indexes...")

    matched = 0
    city_maps = {}
    for city in cities:
        if not city or city == "?": continue
        cm = fetch_city(city)
        city_maps[city.upper()] = cm
        print(f"  {city}: {len(cm)} indexed addresses")

    for c in wa:
        c["matched_apn"] = None; c["matched_value"] = None  # reset, re-match cleanly
        cm = city_maps.get((c.get("city") or "").strip().upper())
        if not cm: continue
        k = norm_key(c.get("street"), c.get("city"))
        if k and k in cm:
            row = cm[k]
            c["matched_apn"] = row["apn"]
            c["matched_value"] = row.get("rentcast_value")
            matched += 1

    d["matched"] = matched
    d["matchMethod"] = "normalized-local"
    json.dump(d, open(SRC, "w"))

    # matched CSV
    import csv
    mrows = [c for c in wa if c.get("matched_apn")]
    with open(os.path.join(HERE, "cc-matched-homes.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["email","first_name","last_name","phone","street","city","state","zip","matched_apn","matched_value"])
        for c in mrows:
            w.writerow([c.get("email"),c.get("first_name"),c.get("last_name"),c.get("phone"),
                        c.get("street"),c.get("city"),c.get("state"),c.get("zip"),
                        c.get("matched_apn"),c.get("matched_value")])

    print(f"\n=== TIGHT SCRUB COMPLETE ===")
    print(f"  total contacts: {d['total']} | with address: {len(wa)}")
    print(f"  MATCHED to indexed homes: {matched}  ({matched*100//max(1,len(wa))}% of with-address)")
    byst = collections.Counter(c.get("state") for c in mrows)
    print(f"  matched by state: {dict(byst)}")
    print(f"  wrote -> cc-matched-homes.csv ({len(mrows)} rows)")

if __name__ == "__main__":
    main()
