#!/usr/bin/env python3
"""
PropertyDNA — Local Florida FDOR Cadastral Indexer
Bypasses Netlify; runs directly against the FDOR ArcGIS API and writes to Supabase.

Usage:
  SUPABASE_SERVICE_KEY=sb_secret_... python3 tools/index_florida_local.py
  SUPABASE_SERVICE_KEY=sb_secret_... python3 tools/index_florida_local.py --counties 23,39,60

CO_NO formula: alphabetical_position + 10 (confirmed from live data)
  23 = Miami-Dade
  39 = Hillsborough (Tampa)
  60 = Palm Beach
"""

import os, sys, time, json, math, requests, argparse
from datetime import datetime, date

SUPABASE_URL = "https://neccpdfhmfnvyjgyrysy.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
FL_BASE = "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0"

RESIDENTIAL_DOR_CODES = ["001","002","003","004","005","006","007","008","009"]
BATCH_SIZE = 1000

# Default target counties. Extend via --counties flag.
DEFAULT_COUNTIES = {23: "Miami-Dade", 39: "Hillsborough", 60: "Palm Beach"}

# IMP_QUAL cost per sqft: "1"=Excellent → "5"=Poor
QUAL_COST = {"1": 380, "2": 300, "3": 230, "4": 175, "5": 130, "default": 220}

FIELDS = ",".join([
    "OBJECTID","PARCEL_ID","CO_NO","PHY_ADDR1","PHY_CITY","PHY_ZIPCD",
    "OWN_NAME","OWN_ADDR1","OWN_CITY","OWN_STATE","OWN_ZIPCD",
    "ACT_YR_BLT","EFF_YR_BLT","TOT_LVG_AR","LND_SQFOOT",
    "NO_RES_UNT","JV","LND_VAL","NCONST_VAL",
    "DOR_UC","IMP_QUAL","ASMNT_YR",
    "SALE_PRC1","SALE_YR1","SALE_MO1",
    "SALE_PRC2","SALE_YR2","SALE_MO2",
])

# ── Helpers ───────────────────────────────────────────────────────────────────

def supa_headers(prefer="return=minimal"):
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }

def intv(v):
    try: return int(v) or None
    except: return None

def fltv(v):
    try: return float(v) or None
    except: return None

def strv(v):
    s = str(v or "").strip()
    return s or None

# ── FDOR Fetch — OBJECTID-range pagination (reliable for large datasets) ──────

def get_oid_range(co_no):
    """Get min/max OBJECTID for this county's residential parcels."""
    codes = ",".join(f"'{c}'" for c in RESIDENTIAL_DOR_CODES)
    where = f"CO_NO={co_no} AND DOR_UC IN ({codes})"
    params = {
        "where": where,
        "outStatistics": json.dumps([
            {"statisticType": "min", "onStatisticField": "OBJECTID", "outStatisticFieldName": "oid_min"},
            {"statisticType": "max", "onStatisticField": "OBJECTID", "outStatisticFieldName": "oid_max"},
            {"statisticType": "count", "onStatisticField": "OBJECTID", "outStatisticFieldName": "cnt"},
        ]),
        "f": "json",
    }
    r = requests.get(f"{FL_BASE}/query", params=params, timeout=45)
    r.raise_for_status()
    d = r.json()
    if "error" in d:
        raise RuntimeError(f"FDOR stats error: {d['error']}")
    attrs = d.get("features", [{}])[0].get("attributes", {})
    return int(attrs.get("oid_min") or 0), int(attrs.get("oid_max") or 0), int(attrs.get("cnt") or 0)

def fetch_batch_by_oid(co_no, oid_min, oid_max):
    """Fetch records in an OBJECTID range — much faster than offset pagination."""
    codes = ",".join(f"'{c}'" for c in RESIDENTIAL_DOR_CODES)
    params = {
        "where": f"CO_NO={co_no} AND DOR_UC IN ({codes}) AND OBJECTID >= {oid_min} AND OBJECTID < {oid_max}",
        "outFields": FIELDS,
        "returnGeometry": "false",
        "resultRecordCount": str(BATCH_SIZE),
        "f": "json",
    }
    r = requests.get(f"{FL_BASE}/query", params=params, timeout=60)
    r.raise_for_status()
    d = r.json()
    if "error" in d:
        raise RuntimeError(f"FDOR: {d['error']}")
    return [f["attributes"] for f in d.get("features", [])]

# ── DNA Scoring ───────────────────────────────────────────────────────────────

def compute_dna(row):
    act_yr = intv(row.get("ACT_YR_BLT")) or 0
    eff_yr = intv(row.get("EFF_YR_BLT")) or act_yr
    sqft   = fltv(row.get("TOT_LVG_AR")) or 0
    jv     = fltv(row.get("JV")) or 0
    lnd    = fltv(row.get("LND_VAL")) or 0
    nc     = fltv(row.get("NCONST_VAL")) or 0
    qual   = strv(row.get("IMP_QUAL")) or "default"
    now    = datetime.now().year

    improv  = max(0, jv - lnd)
    cost    = QUAL_COST.get(qual, QUAL_COST["default"])
    eff_age = (now - eff_yr) if eff_yr > 1800 else 30
    act_age = (now - act_yr) if act_yr > 1800 else 30
    depr    = max(0.20, 1 - eff_age * 0.009)
    exp     = sqft * cost * depr if sqft > 0 else 0
    rr      = round(improv / exp, 2) if exp > 0 else 1.0

    renov = eff_yr > 1800 and act_yr > 1800 and eff_yr > act_yr + 10
    fully = rr > 1.35 and renov
    cond  = (93 if rr > 1.5 else 82 if rr > 1.3 else 72 if rr > 1.1 else
             63 if rr > 0.9 else 50 if rr > 0.7 else 38)

    return dict(
        renovationRatio=rr, conditionScore=cond,
        effectiveYearBuilt=eff_yr or None,
        landValue=lnd or None, improvValue=improv or None, totalValue=jv or None,
        detectedFeatures=dict(
            renovation_recognized=renov, new_construction=nc > 5000,
            fully_remodeled=fully, updated=rr >= 1.15 and not fully,
            original_condition=rr < 0.75 and act_age > 20,
        ),
        dataQuality="complete" if sqft > 0 and act_yr > 0 and jv > 0 else "partial",
    )

# ── Row builders ──────────────────────────────────────────────────────────────

def build_rows(rows, county_fips, today):
    master, history = [], []
    for row in rows:
        pid = strv(row.get("PARCEL_ID"))
        if not pid:
            continue
        dna  = compute_dna(row)
        addr = strv(row.get("PHY_ADDR1"))
        zip_raw = row.get("PHY_ZIPCD")
        zip_code = str(int(float(zip_raw))).zfill(5) if zip_raw else None

        master.append({
            "apn": pid, "county_fips": county_fips,
            "address": addr, "city": strv(row.get("PHY_CITY")),
            "state": "FL", "zip": zip_code,
            "property_type": strv(row.get("DOR_UC")),
            "sqft": intv(row.get("TOT_LVG_AR")),
            "year_built": intv(row.get("ACT_YR_BLT")) if (intv(row.get("ACT_YR_BLT")) or 0) > 1800 else None,
            "tax_assessed_value": fltv(row.get("JV")),
            "last_updated": datetime.utcnow().isoformat(),
        })
        history.append({
            "apn": pid, "event_type": "assessment",
            "event_date": today, "source": "fl_fdor_cadastral",
            "data": {
                "address": addr, "city": strv(row.get("PHY_CITY")),
                "zip": zip_code,
                "ownerName": strv(row.get("OWN_NAME")),
                "ownerAddr": strv(row.get("OWN_ADDR1")),
                "ownerCity": strv(row.get("OWN_CITY")),
                "ownerState": strv(row.get("OWN_STATE")),
                "ownerZip": strv(row.get("OWN_ZIPCD")),
                "actYearBuilt": intv(row.get("ACT_YR_BLT")),
                "effYearBuilt": intv(row.get("EFF_YR_BLT")),
                "sqft": intv(row.get("TOT_LVG_AR")),
                "lotSqft": intv(row.get("LND_SQFOOT")),
                "numResUnits": intv(row.get("NO_RES_UNT")),
                "justValue": fltv(row.get("JV")),
                "landValue": fltv(row.get("LND_VAL")),
                "newConstVal": fltv(row.get("NCONST_VAL")),
                "dorUseCode": strv(row.get("DOR_UC")),
                "impQuality": strv(row.get("IMP_QUAL")),
                "sale1Price": fltv(row.get("SALE_PRC1")),
                "sale1Year": intv(row.get("SALE_YR1")),
                "sale1Month": strv(row.get("SALE_MO1")),
                "sale2Price": fltv(row.get("SALE_PRC2")),
                "sale2Year": intv(row.get("SALE_YR2")),
                **dna,
            },
        })
    return master, history

# ── Supabase writes ───────────────────────────────────────────────────────────

def upsert_master(rows):
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/property_master?on_conflict=apn",
        headers=supa_headers("resolution=merge-duplicates,return=minimal"),
        json=rows, timeout=45,
    )
    if r.status_code >= 400:
        print(f"    ⚠ master {r.status_code}: {r.text[:150]}")

def insert_history(rows):
    requests.post(
        f"{SUPABASE_URL}/rest/v1/property_history",
        headers=supa_headers(),
        json=rows, timeout=45,
    )
    # duplicate conflicts silently ignored

# ── County indexer ────────────────────────────────────────────────────────────

def index_county(co_no, county_name, start_offset=0):
    county_fips = f"12_{co_no}"
    today = date.today().isoformat()
    total = 0

    print(f"\n{'='*60}")
    print(f"  {county_name} (CO_NO={co_no})")
    print(f"{'='*60}")

    # Get OID range for this county
    print("  Getting OID range...", end=" ", flush=True)
    try:
        oid_min, oid_max, count = get_oid_range(co_no)
        print(f"OIDs {oid_min:,} → {oid_max:,} ({count:,} parcels)")
    except Exception as e:
        print(f"FAILED: {e}")
        return 0

    if count == 0:
        print(f"  No residential records for CO_NO={co_no}. Check county number.")
        return 0

    # Resume: skip OIDs that correspond to already-indexed records
    # start_offset is a record count; convert to approximate OID start
    oid_step = BATCH_SIZE
    oid_span = oid_max - oid_min
    if start_offset > 0 and count > 0:
        skip_fraction = start_offset / count
        resume_oid = oid_min + int(oid_span * skip_fraction)
        print(f"  Resuming from approx OID {resume_oid:,} ({start_offset:,} already done)")
    else:
        resume_oid = oid_min

    current_oid = resume_oid
    consecutive_errors = 0

    while current_oid <= oid_max:
        next_oid = current_oid + oid_step
        pct = int((current_oid - oid_min) / max(oid_span, 1) * 100)
        print(f"  OID {current_oid:>10,} ({pct}%) | fetching...", end=" ", flush=True)

        try:
            rows = fetch_batch_by_oid(co_no, current_oid, next_oid)
            consecutive_errors = 0
        except Exception as e:
            consecutive_errors += 1
            wait = min(30 * consecutive_errors, 120)
            print(f"ERROR ({consecutive_errors}): {e} — retry in {wait}s")
            if consecutive_errors >= 5:
                print(f"  Skipping OID range {current_oid}-{next_oid}")
                current_oid = next_oid
                consecutive_errors = 0
            time.sleep(wait)
            continue

        if rows:
            print(f"{len(rows):>5} records → writing...", end=" ", flush=True)
            master_rows, history_rows = build_rows(rows, county_fips, today)
            seen = {}
            for r in master_rows:
                seen[r["apn"]] = r
            master_rows = list(seen.values())
            upsert_master(master_rows)
            insert_history(history_rows)
            total += len(master_rows)
            print(f"✓ ({total:,} total)")
        else:
            print("empty")

        current_oid = next_oid
        time.sleep(0.3)

    print(f"\n  {county_name} complete — {total:,} records indexed.")
    return total

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not SUPABASE_KEY:
        print("ERROR: SUPABASE_SERVICE_KEY not set.")
        sys.exit(1)

    parser = argparse.ArgumentParser()
    parser.add_argument("--counties", help="Comma-separated CO_NO values, e.g. 23,39,60")
    parser.add_argument("--start-offset", type=int, default=0,
                        help="Start offset for the FIRST county only (use to resume)")
    args = parser.parse_args()

    if args.counties:
        target = {}
        for n in args.counties.split(","):
            n = n.strip()
            if n.isdigit():
                co = int(n)
                target[co] = DEFAULT_COUNTIES.get(co, f"FL County {co}")
    else:
        target = DEFAULT_COUNTIES

    print(f"Indexing {len(target)} Florida counties: {', '.join(target.values())}")
    grand_total = 0
    for i, (co_no, name) in enumerate(target.items()):
        start = args.start_offset if i == 0 else 0
        grand_total += index_county(co_no, name, start_offset=start)

    print(f"\n{'='*60}")
    print(f"ALL DONE — {grand_total:,} records indexed into Supabase")
    print(f"Next: run tools/skip_trace_fl.py to export for Tracerfy")

if __name__ == "__main__":
    main()
