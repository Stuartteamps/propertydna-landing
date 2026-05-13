#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Collect recent arms-length sales from RentCast for back-test calibration.

Strategy:
  1. For each priority city, page through /v1/properties (bulk, 500/page)
  2. For each property returned, call /v1/properties?address=X to get
     full sale history (the bulk endpoint strips it)
  3. Keep properties with lastSaleDate in target window
  4. For each, call /v1/avm/value to capture RentCast's current AVM estimate
  5. Apply our cohort PSF filter to drop non-arms-length sales
  6. Save to JSON for back-test consumption

Output: tools/data/rentcast_sales_<city>.json
"""
import os, sys, json, time, requests, datetime, statistics, pathlib

RENTCAST_KEY = os.environ.get("RENTCAST_API_KEY", "6f422758923c4c3392272eb71c035db6")
API_BASE = "https://api.rentcast.io/v1"
HEADERS = {"X-Api-Key": RENTCAST_KEY}

DATA_DIR = pathlib.Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

# Priority order per user: Palm Springs first, then highest-value
PRIORITY_CITIES = [
    ("Palm Springs", "CA", 150),
    ("Indian Wells", "CA", 75),
    ("Rancho Mirage", "CA", 75),
    ("Palm Desert",  "CA", 100),
    ("La Quinta",    "CA", 100),
]

CUTOFF_DATE = (datetime.datetime.now() - datetime.timedelta(days=180)).isoformat()
MIN_PRICE = 300000

def get_property_with_history(addr):
    """Single-address lookup returns full sale history."""
    try:
        r = requests.get(f"{API_BASE}/properties", headers=HEADERS,
                         params={"address": addr}, timeout=15)
        if r.status_code != 200:
            return None
        data = r.json()
        return data[0] if isinstance(data, list) and data else None
    except Exception as e:
        return None

def get_avm(addr, city, state, zip_code, beds=None, baths=None, sqft=None):
    """Get RentCast AVM for an address."""
    try:
        params = {
            "address": addr,
            "city": city,
            "state": state,
            "zipCode": zip_code or "",
            "propertyType": "Single Family",
            "compCount": 5,
        }
        if beds: params["bedrooms"] = beds
        if baths: params["bathrooms"] = baths
        if sqft: params["squareFootage"] = sqft
        r = requests.get(f"{API_BASE}/avm/value", headers=HEADERS, params=params, timeout=15)
        if r.status_code != 200:
            return None
        return r.json()
    except Exception:
        return None

def collect_city(city, state, target_n):
    print(f"\n=== {city}, {state} (target: {target_n} qualifying properties) ===")
    bulk_url = f"{API_BASE}/properties"

    # First page — get list of properties
    addresses_seen = set()
    qualifying = []
    offset = 0
    pages_searched = 0
    api_calls = 0

    while len(qualifying) < target_n and pages_searched < 5:
        r = requests.get(bulk_url, headers=HEADERS,
                         params={"city": city, "state": state, "limit": 500, "offset": offset},
                         timeout=30)
        api_calls += 1
        if r.status_code != 200:
            print(f"  bulk fetch failed: {r.status_code} {r.text[:200]}")
            break
        batch = r.json() or []
        if not batch:
            break
        print(f"  page {pages_searched+1}: {len(batch)} properties returned, scanning sale history...")

        for p in batch:
            if len(qualifying) >= target_n:
                break
            addr = p.get("formattedAddress") or p.get("addressLine1")
            if not addr or addr in addresses_seen:
                continue
            addresses_seen.add(addr)

            # Bulk endpoint may already have lastSale fields
            ls_date = p.get("lastSaleDate")
            ls_price = p.get("lastSalePrice")

            # If bulk didn't have it, query the single-address endpoint
            if not ls_date or not ls_price:
                detail = get_property_with_history(addr)
                api_calls += 1
                if not detail: continue
                ls_date = detail.get("lastSaleDate")
                ls_price = detail.get("lastSalePrice")
                if not ls_date or not ls_price: continue
                # Merge property details
                p = detail
                time.sleep(0.05)

            # Apply filters
            if ls_date < CUTOFF_DATE: continue
            if ls_price < MIN_PRICE: continue
            sqft = p.get("squareFootage")
            if not sqft or sqft < 600: continue
            psf = ls_price / sqft
            if psf < 200 or psf > 3000: continue  # sanity bounds

            qualifying.append({
                "address": addr,
                "city": p.get("city"),
                "state": p.get("state"),
                "zip": p.get("zipCode"),
                "beds": p.get("bedrooms"),
                "baths": p.get("bathrooms"),
                "sqft": sqft,
                "lot_sqft": p.get("lotSize"),
                "year_built": p.get("yearBuilt"),
                "property_type": p.get("propertyType"),
                "lastSalePrice": ls_price,
                "lastSaleDate": ls_date[:10],
                "psf": round(psf, 1),
                "features": p.get("features") or {},
                "lat": p.get("latitude"),
                "lon": p.get("longitude"),
            })
            print(f"    + {ls_date[:10]} | ${ls_price:>10,} | {sqft}sqft | ${round(psf):>4}/sqft | {addr}")

        offset += 500
        pages_searched += 1
        if len(batch) < 500: break  # last page

    print(f"  qualifying: {len(qualifying)} / api_calls so far: {api_calls}")

    # Now apply COHORT PSF FILTER to drop non-arms-length sales
    if len(qualifying) >= 5:
        psfs = sorted(q["psf"] for q in qualifying)
        median_psf = psfs[len(psfs) // 2]
        before = len(qualifying)
        qualifying = [q for q in qualifying if 0.5 * median_psf <= q["psf"] <= 2.0 * median_psf]
        print(f"  PSF filter (median ${round(median_psf)}): {before} -> {len(qualifying)} (dropped {before - len(qualifying)} non-arms-length)")

    # Get AVM for each
    print(f"  fetching AVMs for {len(qualifying)} properties...")
    for i, q in enumerate(qualifying):
        avm = get_avm(q["address"], q["city"], q["state"], q["zip"],
                      q.get("beds"), q.get("baths"), q.get("sqft"))
        api_calls += 1
        if avm:
            q["avm_mid"]  = avm.get("price")
            q["avm_low"]  = avm.get("priceRangeLow")
            q["avm_high"] = avm.get("priceRangeHigh")
            q["avm_comps"] = avm.get("comparables", [])
        else:
            q["avm_mid"] = None
        if (i + 1) % 10 == 0:
            print(f"    {i+1}/{len(qualifying)} AVMs fetched")
        time.sleep(0.1)

    # Final filter: only keep ones with AVM
    with_avm = [q for q in qualifying if q.get("avm_mid")]
    print(f"  final: {len(with_avm)} properties with both sale + AVM data  | total API calls: {api_calls}")

    return with_avm

def main():
    print(f"RentCast data collection — cutoff: {CUTOFF_DATE[:10]}")
    print(f"Target cities (priority order):")
    for c, s, n in PRIORITY_CITIES:
        print(f"  {c}, {s}: {n}")

    all_results = {}
    total_calls = 0
    for city, state, target_n in PRIORITY_CITIES:
        results = collect_city(city, state, target_n)
        all_results[city] = results
        # Save per-city
        out = DATA_DIR / f"rentcast_sales_{city.lower().replace(' ', '_')}.json"
        with open(out, "w") as f:
            json.dump(results, f, indent=2, default=str)
        print(f"  saved -> {out}")
        # Continue to next city only if Palm Springs hits target
        if city == "Palm Springs" and len(results) < 30:
            print(f"  WARNING: Palm Springs returned only {len(results)} samples; stopping further collection.")
            break

    # Summary
    print("\n=== Summary ===")
    for city, results in all_results.items():
        print(f"  {city}: {len(results)} properties")
    out = DATA_DIR / "rentcast_sales_all.json"
    with open(out, "w") as f:
        json.dump(all_results, f, indent=2, default=str)
    print(f"\nAll saved to {out}")

if __name__ == "__main__":
    main()
