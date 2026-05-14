#!/usr/bin/env python3
"""
PropertyDNA — Multi-Market Luxury Indexer (Python local)

Bypasses Netlify (deploys broken). Runs directly against each market's ArcGIS
service and writes to Supabase.

Markets: Travis TX (Austin), Pitkin CO (Aspen), Charleston SC, Pima AZ (Tucson),
Wake NC (Raleigh), Buncombe NC (Asheville), Davidson TN (Nashville),
Fulton GA (Atlanta), Honolulu HI (Oahu), Washoe NV (Reno).

Usage:
  SUPABASE_SERVICE_KEY=... python3 tools/index_luxury_local.py --market tx-travis
  SUPABASE_SERVICE_KEY=... python3 tools/index_luxury_local.py --all
"""

import os, sys, time, json, argparse, requests
from datetime import datetime, date

SUPABASE_URL = "https://neccpdfhmfnvyjgyrysy.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
BATCH_SIZE = 1000

MARKETS = {
    "tx-travis": {
        "label": "Travis County TX (Austin)",
        "base": "https://taxmaps.traviscountytx.gov/arcgis/rest/services/Parcels/MapServer/0",
        "fips": "48453", "state": "TX",
        "where": "py_owner_name IS NOT NULL AND geo_id IS NOT NULL",
        "map": {"apn": "geo_id", "owner": "py_owner_name", "assessed": "assessed_val", "market": "market_value"},
    },
    "co-pitkin": {
        # Fixed: Layer 9 of Parcel_Overlay MapServer
        "label": "Pitkin County CO (Aspen)",
        "base": "https://maps.pitkincounty.com/arcgis/rest/services/Parcel_Overlay/MapServer/9",
        "fips": "08097", "state": "CO",
        "where": "1=1",
        "map": {},
    },
    "sc-charleston": {
        # Sublayers: probe with 1=1, owner field will be found in build_rows fallbacks
        "label": "Charleston County SC",
        "base": "https://gisccapps.charlestoncounty.org/arcgis/rest/services/GIS_VIEWER/Public_Search/MapServer/4",
        "fips": "45019", "state": "SC",
        "where": "1=1",
        "map": {},
    },
    "az-pima": {
        # Pima OpenData portal — use the public hosted version
        "label": "Pima County AZ (Tucson)",
        "base": "https://services1.arcgis.com/3l9bckEDuLNoQUM3/ArcGIS/rest/services/Parcels/FeatureServer/0",
        "fips": "04019", "state": "AZ",
        "where": "1=1",
        "map": {},
    },
    "nc-wake": {
        # Fields confirmed: ownname (not OWNER), parno (APN), mailadd
        "label": "Wake County NC (Raleigh)",
        "base": "https://services8.arcgis.com/eJ9GuQwMsO1iIOw1/ArcGIS/rest/services/parcels/FeatureServer/0",
        "fips": "37183", "state": "NC",
        "where": "ownname IS NOT NULL",
        "map": {"owner": "ownname", "apn": "parno",
                "assessed": "parval", "ownerAddr": "mailadd", "ownerCity": "mcity"},
    },
    "nc-buncombe": {
        "label": "Buncombe County NC (Asheville)",
        # Buncombe alt URL — Asheville hosts an open data hub
        "base": "https://services.arcgis.com/aJ16ENn1AaqdFlqx/ArcGIS/rest/services/Parcels/FeatureServer/0",
        "fips": "37021", "state": "NC",
        "where": "1=1",
        "map": {},
    },
    "tn-davidson": {
        # Fields confirmed: Owner, OwnAddr1, OwnCity, OwnState, OwnZip, STANPAR (APN), PropAddr, SalePrice, TotlAppr
        "label": "Davidson County TN (Nashville)",
        "base": "https://maps.nashville.gov/arcgis/rest/services/Cadastral/Parcels/MapServer/0",
        "fips": "47037", "state": "TN",
        "where": "Owner IS NOT NULL",
        "map": {"owner": "Owner", "apn": "STANPAR",
                "ownerAddr": "OwnAddr1", "ownerCity": "OwnCity",
                "ownerState": "OwnState", "ownerZip": "OwnZip",
                "address": "PropAddr", "city": "PropCity", "zip": "PropZip",
                "assessed": "TotlAppr", "sale": "SalePrice", "saleDate": "OwnDate"},
    },
    "ga-fulton": {
        # Fixed: Layer 11 (Tax Parcel) instead of 0
        "label": "Fulton County GA (Atlanta)",
        "base": "https://gismaps.fultoncountyga.gov/arcgispub2/rest/services/PropertyMapViewer/PropertyMapViewer/MapServer/11",
        "fips": "13121", "state": "GA",
        "where": "1=1",
        "map": {},
    },
    "hi-honolulu": {
        "label": "Honolulu County HI (Oahu)",
        "base": "https://geodata.hawaii.gov/arcgis/rest/services/ParcelsZoning/MapServer/11",
        "fips": "15003", "state": "HI",
        "where": "1=1",
        "map": {"apn": "TMK"},
    },
    "nv-washoe": {
        # Fields confirmed: FIRSTNAME+LASTNAME, APN, MAILING1, MAILCITY, MAILSTATE, MAILZIP, YEARBLT, SQFEET, TOTALASS, SALEPRICE
        "label": "Washoe County NV (Reno)",
        "base": "https://wcgisweb.washoecounty.us/arcgis/rest/services/OpenData/OpenData/FeatureServer/0",
        "fips": "32031", "state": "NV",
        "where": "LASTNAME IS NOT NULL",
        "map": {"apn": "APN",
                "ownerAddr": "MAILING1", "ownerCity": "MAILCITY",
                "ownerState": "MAILSTATE", "ownerZip": "MAILZIP",
                "city": "CITY", "zip": "SITUSZIP",
                "yearBuilt": "YEARBLT", "sqft": "SQFEET",
                "assessed": "TOTALASS", "market": "TOTALAPR",
                "sale": "SALEPRICE", "saleDate": "SALEDATE"},
    },
}

# ── Supabase ──────────────────────────────────────────────────────────────────

def supa_headers(prefer="return=minimal"):
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }

def upsert_master(rows):
    if not rows: return
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/property_master?on_conflict=apn",
        headers=supa_headers("resolution=merge-duplicates,return=minimal"),
        json=rows, timeout=45,
    )
    if r.status_code >= 400:
        print(f"    ⚠ master {r.status_code}: {r.text[:120]}")

def insert_history(rows):
    if not rows: return
    requests.post(
        f"{SUPABASE_URL}/rest/v1/property_history",
        headers=supa_headers(),
        json=rows, timeout=45,
    )

# ── ArcGIS fetch ──────────────────────────────────────────────────────────────

def fetch_batch(market, offset):
    params = {
        "where": market["where"],
        "outFields": "*",
        "returnGeometry": "false",
        "resultOffset": str(offset),
        "resultRecordCount": str(BATCH_SIZE),
        "orderByFields": "OBJECTID ASC",
        "f": "json",
    }
    r = requests.get(f"{market['base']}/query", params=params, timeout=45)
    r.raise_for_status()
    d = r.json()
    if "error" in d:
        raise RuntimeError(f"ArcGIS: {d['error']}")
    return [f["attributes"] for f in d.get("features", [])]

def fetch_count(market):
    params = {
        "where": market["where"],
        "outStatistics": json.dumps([{"statisticType":"count","onStatisticField":"OBJECTID","outStatisticFieldName":"cnt"}]),
        "f": "json",
    }
    try:
        r = requests.get(f"{market['base']}/query", params=params, timeout=45)
        r.raise_for_status()
        return int(r.json().get("features", [{}])[0].get("attributes", {}).get("cnt") or 0)
    except Exception:
        # Fall back to returnCountOnly
        try:
            r = requests.get(f"{market['base']}/query",
                            params={"where": market["where"], "returnCountOnly": "true", "f": "json"},
                            timeout=45)
            return int(r.json().get("count") or 0)
        except Exception:
            return 0

# ── Row builders ──────────────────────────────────────────────────────────────

def pick(row, key, fallbacks):
    if key and row.get(key) not in (None, ""):
        return row.get(key)
    for f in fallbacks:
        if row.get(f) not in (None, ""):
            return row.get(f)
    return None

def strv(v):
    s = str(v or "").strip()
    return s or None

def intv(v):
    try: return int(float(v)) if v not in (None, "", 0) else None
    except: return None

def fltv(v):
    try: return float(v) if v not in (None, "", 0) else None
    except: return None

def build_rows(rows, market, today):
    master, history = [], []
    m = market.get("map", {})
    for row in rows:
        apn_raw = pick(row, m.get("apn"),
            ["PARCEL_ID","PIN","APN","parcel","PARCEL","PARCELID","TMK","geo_id","ParcelID","parcelid","PRINT_KEY"])
        apn_raw = str(apn_raw or row.get("OBJECTID") or "").strip()
        if not apn_raw: continue

        owner = strv(pick(row, m.get("owner"),
            ["OWNER","Owner","OWNER_NAME","OwnerName","owner_name","ownname","name","PRIMARY_OWNER"]))
        # Special case: split FIRSTNAME + LASTNAME (Washoe NV etc.)
        if not owner and row.get("LASTNAME"):
            fn = strv(row.get("FIRSTNAME")) or ""
            ln = strv(row.get("LASTNAME")) or ""
            owner = f"{ln} {fn}".strip() or None
        if not owner: continue

        address = strv(pick(row, m.get("address"),
            ["SITUS_ADDR","SITE_ADDRESS","situs_address","Location","Full_Address","address1","ADDRESS"]))
        city = strv(pick(row, m.get("city"),
            ["SITUS_CITY","CITY","city","Property_City","SITUSCITY","jurisdiction"]))
        zip_raw = pick(row, m.get("zip"),
            ["SITUS_ZIP","ZIP","zip","Property_Zip","SITUSZIP","POSTAL_CODE","PostalCode","LOC_ZIP"])
        zip_code = (str(zip_raw).strip()[:5]) if zip_raw else None

        sqft = intv(pick(row, m.get("sqft"),
            ["TOTAL_LIVING_AREA","SQFT","Living_Area","BLDG_SQFT","SQFT_LIVING","TOTAL_SQFT"]))
        yr_blt = intv(pick(row, m.get("yearBuilt"),
            ["YEAR_BUILT","AYB","YR_BLT","YearBuilt"]))
        if yr_blt and yr_blt <= 1800: yr_blt = None
        tav = fltv(pick(row, m.get("assessed"),
            ["ASSESSED","Assessed_Total","TOTAL_AV","ASSESSED_VALUE","assessed_val","MKTTL"]))
        mv = fltv(pick(row, m.get("market"),
            ["MARKET_VALUE","FULL_MARKET_VAL","market_value","MKT_VAL","MKTTL"]))

        owner_state = strv(pick(row, m.get("ownerState"),
            ["OWNER_STATE","owner_state","OWNERSTATE","Mailing_State"]))
        absentee = (owner_state or "").upper() != market["state"] if owner_state else False

        unique_apn = f"{market['state']}-{market['fips']}-{apn_raw}"

        master.append({
            "apn": unique_apn, "county_fips": market["fips"],
            "address": address, "city": city, "state": market["state"],
            "zip": zip_code, "sqft": sqft, "year_built": yr_blt,
            "tax_assessed_value": tav,
            "last_updated": datetime.utcnow().isoformat(),
        })
        history.append({
            "apn": unique_apn, "event_type": "assessment",
            "event_date": today, "source": f"{market['state'].lower()}_{market['fips']}",
            "data": {
                "marketLabel": market["label"],
                "address": address, "city": city, "zip": zip_code,
                "ownerName": owner,
                "coOwner": strv(pick(row, m.get("coOwner"), ["Owner2","CO_NAME","CoOwner","ADD_OWNER"])),
                "ownerAddr": strv(pick(row, m.get("ownerAddr"), ["OWNER_ADDR","owner_address1","OWNERLINE1","Mailing_Address"])),
                "ownerCity": strv(pick(row, m.get("ownerCity"), ["OWNER_CITY","owner_city","OWNERCITY","Mailing_City"])),
                "ownerState": owner_state,
                "ownerZip": strv(pick(row, m.get("ownerZip"), ["OWNER_ZIP","owner_zip","OWNERZIP","Mailing_Zip"])),
                "absentee": absentee,
                "rawAPN": apn_raw,
                "sqft": sqft, "yearBuilt": yr_blt,
                "assessedValue": tav, "marketValue": mv,
                "salePrice": fltv(pick(row, m.get("sale"), ["SalePrice","SALE_PRICE","Sale_Price"])),
                "saleDate": pick(row, m.get("saleDate"), ["SaleDate","DateAcquired","SALE_DATE","Sale_Date"]),
            },
        })
    return master, history

# ── Index a single market ─────────────────────────────────────────────────────

def index_market(market_key):
    market = MARKETS[market_key]
    today = date.today().isoformat()
    offset, total = 0, 0
    consecutive_errors = 0

    print(f"\n{'='*60}\n  {market['label']}\n{'='*60}")
    try:
        total = fetch_count(market)
    except Exception as e:
        print(f"  Could not get count: {e}")
    print(f"  Total residential parcels: {total:,}" if total else "  Count unknown — paginating until empty")

    while True:
        print(f"  offset={offset:>7,} | fetching...", end=" ", flush=True)
        try:
            rows = fetch_batch(market, offset)
            consecutive_errors = 0
        except Exception as e:
            consecutive_errors += 1
            wait = min(30 * consecutive_errors, 120)
            print(f"ERR {consecutive_errors}: {str(e)[:80]} — retry {wait}s")
            if consecutive_errors >= 5:
                print(f"  Skipping ahead by {BATCH_SIZE}")
                offset += BATCH_SIZE
                consecutive_errors = 0
            time.sleep(wait)
            continue

        if not rows:
            print(f"empty — done ({offset:,} fetched)")
            break

        master, history = build_rows(rows, market, today)
        # Dedupe by APN within batch
        seen = {}
        for r in master: seen[r["apn"]] = r
        master = list(seen.values())

        upsert_master(master)
        insert_history(history)
        offset += len(rows)
        print(f"{len(rows):>5} fetched, {len(master):>5} written ✓ ({offset:,} total)")

        if len(rows) < BATCH_SIZE:
            print(f"  Final batch ({offset:,} total)")
            break

        time.sleep(0.4)

    return offset

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not SUPABASE_KEY:
        print("ERROR: SUPABASE_SERVICE_KEY not set")
        sys.exit(1)

    p = argparse.ArgumentParser()
    p.add_argument("--market", help=f"One of: {','.join(MARKETS.keys())}")
    p.add_argument("--all", action="store_true", help="Index ALL markets sequentially")
    args = p.parse_args()

    if args.all:
        targets = list(MARKETS.keys())
    elif args.market:
        if args.market not in MARKETS:
            print(f"Unknown market. Valid: {','.join(MARKETS.keys())}")
            sys.exit(1)
        targets = [args.market]
    else:
        print(f"Specify --market <key> or --all\nValid: {','.join(MARKETS.keys())}")
        sys.exit(1)

    grand_total = 0
    for k in targets:
        grand_total += index_market(k)

    print(f"\n{'='*60}\n  ALL DONE — {grand_total:,} records indexed\n{'='*60}")

if __name__ == "__main__":
    main()
