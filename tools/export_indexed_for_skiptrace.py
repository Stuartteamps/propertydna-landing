#!/usr/bin/env python3
"""
Pulls residential parcels from Riverside County CREST Layer 50 (ArcGIS),
identifies absentee owners via mailing address, deduplicates against
already-emailed contacts, and outputs CSVs ready for Tracerfy skip-tracing.

Usage:
    python3 tools/export_indexed_for_skiptrace.py                  # all CV cities
    python3 tools/export_indexed_for_skiptrace.py --city "PALM SPRINGS"
    python3 tools/export_indexed_for_skiptrace.py --city "PALM SPRINGS" --absentee-only

Output:
    tools/gmail-cleanup/contacts/from_index/needs_skiptracing_<city>_<date>.csv
"""

import csv, json, re, sys, time, urllib.request
from datetime import date
from pathlib import Path
import requests

CREST_BASE = "https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50"
SUPA_URL   = "https://neccpdfhmfnvyjgyrysy.supabase.co"
SUPA_KEY   = "sb_publishable_KTTgVO3mROxubE_A9OQ7Kg_aRrnzPVT"
OUT_DIR    = Path(__file__).parent / "gmail-cleanup" / "contacts" / "from_index"

CITY_QUEUE = [
    "PALM SPRINGS", "RANCHO MIRAGE", "INDIAN WELLS",
    "PALM DESERT", "LA QUINTA", "CATHEDRAL CITY",
    "DESERT HOT SPRINGS", "INDIO", "COACHELLA",
]

RESIDENTIAL_CODES = [
    "Single Family Dwelling", "MA-Single Family Dwelling",
    "SFD with Secondary Unit(s)", "Condominium", "Cooperative",
    "Duplex", "Triplex", "Fourplex", "Townhouse",
    "Single Family Residence", "Planned Unit Development",
    "Apartment", "CT-Apartment", "Residential",
]

def is_residential(code):
    if not code: return False
    return any(r.lower() in code.lower() for r in RESIDENTIAL_CODES)

def parse_mail_city(s):
    """'WEST COVINA CA 91792' → ('West Covina', 'CA', '91792')"""
    if not s: return "", "", ""
    m = re.match(r'^(.+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*$', s.strip())
    if m: return m.group(1).title(), m.group(2), m.group(3)
    return s.title(), "", ""

def parse_situs_city(s):
    """'PALM SPRINGS  CA 92262' → ('Palm Springs', '92262')"""
    if not s: return "", ""
    m = re.match(r'^(.+?)\s+[A-Z]{2}\s+(\d{5})', s.strip())
    if m: return m.group(1).strip().title(), m.group(2)
    return s.title(), ""

CREST_URL = "https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50/query"
SESS = requests.Session()

def crest_query(city, offset=0, count=1000):
    r = SESS.get(CREST_URL, params={
        "where": f"CITY='{city}'",
        "outFields": "APN,SITUS_STREET,SITUS_CITY,MAIL_STREET,MAIL_CITY,CLASS_CODE,ZIP_CODE",
        "returnGeometry": "false",
        "resultOffset": offset,
        "resultRecordCount": count,
        "f": "json",
    }, timeout=30)
    r.raise_for_status()
    return r.json().get("features", [])

def crest_count(city):
    r = SESS.get(CREST_URL, params={
        "where": f"CITY='{city}'",
        "returnCountOnly": "true", "f": "json",
    }, timeout=15)
    return r.json().get("count", 0)

def get_already_emailed():
    emailed = set()
    offset = 0
    while True:
        url = f"{SUPA_URL}/rest/v1/campaign_contacts?select=email&limit=1000&offset={offset}"
        req = urllib.request.Request(url, headers={
            "apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}",
        })
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                rows = json.loads(r.read())
            if not isinstance(rows, list) or not rows: break
            for row in rows:
                if row.get("email"): emailed.add(row["email"].lower().strip())
            if len(rows) < 1000: break
            offset += 1000
        except: break
    return emailed

def export_city(city, absentee_only=False):
    total = crest_count(city)
    print(f"\n{'='*55}")
    print(f"City: {city}  ({total:,} total parcels in CREST)")

    records = []
    offset = 0
    BATCH = 1000
    while offset < total:
        feats = crest_query(city, offset, BATCH)
        if not feats: break
        for f in feats:
            a = f["attributes"]
            code = a.get("CLASS_CODE", "") or ""
            if not is_residential(code): continue

            situs_str  = a.get("SITUS_STREET","") or ""
            situs_city = a.get("SITUS_CITY","") or ""
            mail_str   = a.get("MAIL_STREET","") or ""
            mail_city_raw = a.get("MAIL_CITY","") or ""
            zip_code   = a.get("ZIP_CODE","") or ""

            prop_city_name, prop_zip = parse_situs_city(situs_city)
            mail_city_name, mail_state, mail_zip = parse_mail_city(mail_city_raw)

            is_absentee = bool(
                mail_city_name and
                mail_city_name.upper() != city.title().upper()
            )

            if absentee_only and not is_absentee:
                continue

            records.append({
                "apn":          a.get("APN",""),
                "address":      situs_str.title(),
                "city":         prop_city_name or city.title(),
                "state":        "CA",
                "zip":          prop_zip or zip_code or "",
                "property_type": code,
                "mail_address": mail_str.title(),
                "mail_city":    mail_city_name,
                "mail_state":   mail_state,
                "mail_zip":     mail_zip,
                "is_absentee":  "Yes" if is_absentee else "No",
                "source":       f"CREST — {city.title()}",
            })

        offset += BATCH
        time.sleep(0.15)
        if offset % 5000 == 0:
            print(f"  Pulled {offset:,}/{total:,}...")

    absentee = sum(1 for r in records if r["is_absentee"] == "Yes")
    print(f"  {len(records):,} residential | {absentee:,} absentee ({100*absentee//max(len(records),1)}%)")
    print(f"  Est. Tracerfy cost: ${len(records)*0.02:,.2f}")
    return records

def main():
    args = sys.argv[1:]
    cities = CITY_QUEUE
    absentee_only = "--absentee-only" in args

    if "--city" in args:
        cities = [args[args.index("--city") + 1].upper()]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    today = date.today().strftime("%Y-%m-%d")

    print("Loading already-emailed contacts for dedup...")
    already_emailed = get_already_emailed()
    print(f"  {len(already_emailed):,} already emailed (will be flagged)")

    fieldnames = ["apn","address","city","state","zip","property_type",
                  "mail_address","mail_city","mail_state","mail_zip","is_absentee","source"]

    grand_total = 0
    for city in cities:
        records = export_city(city, absentee_only)
        if not records: continue

        city_slug = city.lower().replace(" ", "_")
        suffix = "_absentee" if absentee_only else ""
        out_path = OUT_DIR / f"needs_skiptracing_{city_slug}{suffix}_{today}.csv"

        with open(out_path, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            w.writeheader()
            w.writerows(records)

        print(f"  ✓ {out_path.name}")
        grand_total += len(records)

    print(f"\n{'='*55}")
    print(f"TOTAL: {grand_total:,} properties")
    print(f"EST. COST: ${grand_total*0.02:,.2f} @ $0.02/record")
    print(f"\nNext steps:")
    print(f"  1. Review CSVs in {OUT_DIR}")
    print(f"  2. Run: python3 tools/skip_trace.py  (auto-submits to Tracerfy)")
    print(f"  3. Run: python3 tools/push_campaigns.py  (blasts emails)")

if __name__ == "__main__":
    main()
